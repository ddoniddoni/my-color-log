create function public.remove_room_member(p_room_id uuid, p_member_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role text;
  target_role text;
  active_member_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_room_id is null or p_member_user_id is null or p_member_user_id = current_user_id then
    raise exception 'room_member_remove_target_invalid' using errcode = '22023';
  end if;

  select membership.role
  into current_role
  from public.room_members as membership
  join public.rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active'
  for update of membership, room;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;

  if current_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  select membership.role
  into target_role
  from public.room_members as membership
  where membership.room_id = p_room_id
    and membership.user_id = p_member_user_id
    and membership.status = 'active'
  for update;

  if not found then
    raise exception 'room_member_remove_target_invalid' using errcode = '22023';
  end if;

  if target_role = 'owner' then
    raise exception 'room_member_remove_owner_forbidden' using errcode = '22023';
  end if;

  update public.room_members
  set status = 'removed',
      left_at = now()
  where room_id = p_room_id
    and user_id = p_member_user_id
    and status = 'active';

  -- A removed member must not be able to reuse a code they already received.
  -- The owner can issue a fresh code if they want to invite someone again.
  update public.room_invites
  set revoked_at = now()
  where room_id = p_room_id
    and revoked_at is null;

  select count(*)::integer
  into active_member_count
  from public.room_members as membership
  where membership.room_id = p_room_id
    and membership.status = 'active';

  update public.rooms
  set status = case when active_member_count = 1 then 'draft' else 'active' end
  where id = p_room_id
    and status in ('draft', 'active');
end;
$$;

revoke all on function public.remove_room_member(uuid, uuid) from public;
revoke all on function public.remove_room_member(uuid, uuid) from anon;
grant execute on function public.remove_room_member(uuid, uuid) to authenticated;

create table public.room_photo_reactions (
  room_id uuid not null references public.rooms(id) on delete cascade,
  photo_id uuid not null references public.entry_photos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('heart', 'sparkles', 'wow', 'palette')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, photo_id, user_id)
);

create index room_photo_reactions_photo_idx
on public.room_photo_reactions (room_id, photo_id, emoji);

alter table public.room_photo_reactions enable row level security;

create policy "room_photo_reactions_select_active_members"
on public.room_photo_reactions
for select
to authenticated
using (
  exists (
    select 1
    from public.entry_photos as photo
    join public.daily_entries as entry
      on entry.id = photo.entry_id
    join public.entry_room_shares as share
      on share.entry_id = entry.id
      and share.room_id = room_photo_reactions.room_id
      and share.revoked_at is null
    join public.room_members as viewer_membership
      on viewer_membership.room_id = room_photo_reactions.room_id
      and viewer_membership.user_id = (select auth.uid())
      and viewer_membership.status = 'active'
    join public.rooms as room
      on room.id = room_photo_reactions.room_id
      and room.status in ('draft', 'active')
    where photo.id = room_photo_reactions.photo_id
      and (viewer_membership.joined_at at time zone 'Asia/Seoul')::date <= entry.date_key
  )
);

create function public.get_room_photo_reactions(p_room_id uuid, p_photo_id uuid)
returns table (
  emoji text,
  reaction_count integer,
  reacted_by_me boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  can_view boolean := false;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select true
  into can_view
  from public.entry_photos as photo
  join public.daily_entries as entry
    on entry.id = photo.entry_id
  join public.entry_room_shares as share
    on share.entry_id = entry.id
    and share.room_id = p_room_id
    and share.revoked_at is null
  join public.room_members as viewer_membership
    on viewer_membership.room_id = p_room_id
    and viewer_membership.user_id = current_user_id
    and viewer_membership.status = 'active'
  join public.rooms as room
    on room.id = p_room_id
    and room.status in ('draft', 'active')
  where photo.id = p_photo_id
    and (viewer_membership.joined_at at time zone 'Asia/Seoul')::date <= entry.date_key;

  if not coalesce(can_view, false) then
    raise exception 'room_photo_reaction_not_available' using errcode = '42501';
  end if;

  return query
  select
    choices.emoji,
    count(reaction.user_id)::integer,
    coalesce(bool_or(reaction.user_id = current_user_id), false)
  from (
    values ('heart'::text), ('sparkles'::text), ('wow'::text), ('palette'::text)
  ) as choices(emoji)
  left join public.room_photo_reactions as reaction
    on reaction.room_id = p_room_id
    and reaction.photo_id = p_photo_id
    and reaction.emoji = choices.emoji
  group by choices.emoji
  order by choices.emoji;
end;
$$;

revoke all on function public.get_room_photo_reactions(uuid, uuid) from public;
revoke all on function public.get_room_photo_reactions(uuid, uuid) from anon;
grant execute on function public.get_room_photo_reactions(uuid, uuid) to authenticated;

create function public.toggle_room_photo_reaction(p_room_id uuid, p_photo_id uuid, p_emoji text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  photo_owner_id uuid;
  existing_emoji text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_emoji not in ('heart', 'sparkles', 'wow', 'palette') then
    raise exception 'room_photo_reaction_emoji_invalid' using errcode = '22023';
  end if;

  select photo.owner_id
  into photo_owner_id
  from public.entry_photos as photo
  join public.daily_entries as entry
    on entry.id = photo.entry_id
  join public.entry_room_shares as share
    on share.entry_id = entry.id
    and share.room_id = p_room_id
    and share.revoked_at is null
  join public.room_members as viewer_membership
    on viewer_membership.room_id = p_room_id
    and viewer_membership.user_id = current_user_id
    and viewer_membership.status = 'active'
  join public.rooms as room
    on room.id = p_room_id
    and room.status in ('draft', 'active')
  where photo.id = p_photo_id
    and (viewer_membership.joined_at at time zone 'Asia/Seoul')::date <= entry.date_key;

  if not found or photo_owner_id = current_user_id then
    raise exception 'room_photo_reaction_not_available' using errcode = '42501';
  end if;

  select reaction.emoji
  into existing_emoji
  from public.room_photo_reactions as reaction
  where reaction.room_id = p_room_id
    and reaction.photo_id = p_photo_id
    and reaction.user_id = current_user_id
  for update;

  if existing_emoji = p_emoji then
    delete from public.room_photo_reactions
    where room_id = p_room_id
      and photo_id = p_photo_id
      and user_id = current_user_id;
    return false;
  end if;

  insert into public.room_photo_reactions (room_id, photo_id, user_id, emoji)
  values (p_room_id, p_photo_id, current_user_id, p_emoji)
  on conflict (room_id, photo_id, user_id)
  do update set emoji = excluded.emoji, updated_at = now();

  return true;
end;
$$;

revoke all on function public.toggle_room_photo_reaction(uuid, uuid, text) from public;
revoke all on function public.toggle_room_photo_reaction(uuid, uuid, text) from anon;
grant execute on function public.toggle_room_photo_reaction(uuid, uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_photo_reactions'
  ) then
    alter publication supabase_realtime add table public.room_photo_reactions;
  end if;
end;
$$;

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique check (char_length(expo_push_token) between 16 and 255),
  platform text not null check (platform in ('android', 'ios')),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_devices_enabled_user_idx
on public.push_devices (user_id)
where is_enabled;

alter table public.push_devices enable row level security;

create policy "push_devices_select_own"
on public.push_devices
for select
to authenticated
using ((select auth.uid()) = user_id);

create function public.register_my_push_device(p_expo_push_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_expo_push_token is null
    or p_expo_push_token !~ '^(ExponentPushToken|ExpoPushToken)\\[[^]]+\\]$'
    or p_platform not in ('android', 'ios') then
    raise exception 'push_device_invalid' using errcode = '22023';
  end if;

  insert into public.push_devices (user_id, expo_push_token, platform, is_enabled)
  values (current_user_id, p_expo_push_token, p_platform, true)
  on conflict (expo_push_token)
  do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    is_enabled = true,
    updated_at = now();
end;
$$;

revoke all on function public.register_my_push_device(text, text) from public;
revoke all on function public.register_my_push_device(text, text) from anon;
grant execute on function public.register_my_push_device(text, text) to authenticated;

create function public.disable_my_push_device(p_expo_push_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  update public.push_devices
  set is_enabled = false,
      updated_at = now()
  where user_id = current_user_id
    and expo_push_token = p_expo_push_token;
end;
$$;

revoke all on function public.disable_my_push_device(text) from public;
revoke all on function public.disable_my_push_device(text) from anon;
grant execute on function public.disable_my_push_device(text) to authenticated;

create table public.room_photo_push_deliveries (
  room_id uuid not null references public.rooms(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  source_user_id uuid not null references auth.users(id) on delete cascade,
  date_key date not null,
  created_at timestamptz not null default now(),
  primary key (room_id, recipient_user_id, source_user_id, date_key)
);

alter table public.room_photo_push_deliveries enable row level security;

create function public.claim_room_photo_push_delivery(
  p_room_id uuid,
  p_recipient_user_id uuid,
  p_source_user_id uuid,
  p_date_key date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  did_claim boolean := false;
begin
  insert into public.room_photo_push_deliveries (room_id, recipient_user_id, source_user_id, date_key)
  values (p_room_id, p_recipient_user_id, p_source_user_id, p_date_key)
  on conflict do nothing
  returning true into did_claim;

  return coalesce(did_claim, false);
end;
$$;

revoke all on function public.claim_room_photo_push_delivery(uuid, uuid, uuid, date) from public;
revoke all on function public.claim_room_photo_push_delivery(uuid, uuid, uuid, date) from anon;
revoke all on function public.claim_room_photo_push_delivery(uuid, uuid, uuid, date) from authenticated;
grant execute on function public.claim_room_photo_push_delivery(uuid, uuid, uuid, date) to service_role;
