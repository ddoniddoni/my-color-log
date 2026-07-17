create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 20 and name = btrim(name)),
  emoji text check (emoji is null or char_length(emoji) between 1 and 8),
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'active', 'ended')),
  max_members smallint not null default 6 check (max_members between 2 and 6),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'left', 'removed')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id, user_id)
);

create unique index room_members_one_active_room_per_user_idx
on public.room_members (user_id)
where status = 'active';

create unique index room_members_one_active_owner_per_room_idx
on public.room_members (room_id)
where status = 'active' and role = 'owner';

create index room_members_active_room_idx
on public.room_members (room_id, joined_at)
where status = 'active';

create table public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete restrict,
  token_hash text not null unique,
  display_code text not null unique check (display_code ~ '^[0-9]{6}$'),
  expires_at timestamptz not null,
  max_uses smallint not null check (max_uses between 1 and 5),
  use_count smallint not null default 0 check (use_count between 0 and max_uses),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index room_invites_room_active_idx
on public.room_invites (room_id, expires_at)
where revoked_at is null;

create table public.room_invite_uses (
  invite_id uuid not null references public.room_invites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  primary key (invite_id, user_id)
);

create table public.room_daily_missions (
  room_id uuid not null references public.rooms(id) on delete cascade,
  challenge_date date not null,
  mission_id uuid not null references public.daily_missions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (room_id, challenge_date)
);

create index room_daily_missions_mission_id_idx
on public.room_daily_missions (mission_id);

create table public.entry_room_shares (
  entry_id uuid not null references public.daily_entries(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete cascade,
  shared_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (entry_id, room_id)
);

create index entry_room_shares_room_active_idx
on public.entry_room_shares (room_id, shared_at)
where revoked_at is null;

create function public.validate_room_daily_mission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.daily_missions as mission
    where mission.id = new.mission_id
      and mission.challenge_date = new.challenge_date
  ) then
    raise exception 'room_daily_mission_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_room_daily_mission() from public;
revoke all on function public.validate_room_daily_mission() from anon;
revoke all on function public.validate_room_daily_mission() from authenticated;

create trigger room_daily_missions_validate_mission
before insert or update on public.room_daily_missions
for each row
execute function public.validate_room_daily_mission();

create function public.validate_entry_room_share()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_owner_id uuid;
  entry_mission_id uuid;
  entry_date_key date;
begin
  select entry.user_id, entry.mission_id, entry.date_key
  into entry_owner_id, entry_mission_id, entry_date_key
  from public.daily_entries as entry
  where entry.id = new.entry_id;

  if entry_owner_id is null or entry_owner_id <> new.shared_by then
    raise exception 'entry_room_share_owner_mismatch' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.room_members as membership
    where membership.room_id = new.room_id
      and membership.user_id = new.shared_by
      and membership.status = 'active'
      and (membership.joined_at at time zone 'Asia/Seoul')::date <= entry_date_key
  ) then
    raise exception 'entry_room_share_requires_active_membership' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.room_daily_missions as room_mission
    where room_mission.room_id = new.room_id
      and room_mission.challenge_date = entry_date_key
      and room_mission.mission_id = entry_mission_id
  ) then
    raise exception 'entry_room_share_mission_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_entry_room_share() from public;
revoke all on function public.validate_entry_room_share() from anon;
revoke all on function public.validate_entry_room_share() from authenticated;

create trigger entry_room_shares_validate
before insert or update on public.entry_room_shares
for each row
execute function public.validate_entry_room_share();

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_invites enable row level security;
alter table public.room_invite_uses enable row level security;
alter table public.room_daily_missions enable row level security;
alter table public.entry_room_shares enable row level security;

grant select on public.rooms, public.room_members, public.room_daily_missions, public.entry_room_shares to authenticated;

create function public.has_active_room_membership(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.room_members as membership
      join public.rooms as room
        on room.id = membership.room_id
        and room.status in ('draft', 'active')
      where membership.room_id = p_room_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    );
$$;

create function public.can_view_room_day(p_room_id uuid, p_date_key date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.room_members as membership
      join public.rooms as room
        on room.id = membership.room_id
        and room.status in ('draft', 'active')
      where membership.room_id = p_room_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and (membership.joined_at at time zone 'Asia/Seoul')::date <= p_date_key
    );
$$;

create function public.can_view_shared_entry(p_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.entry_room_shares as share
      join public.daily_entries as entry on entry.id = share.entry_id
      join public.room_members as membership on membership.room_id = share.room_id
      join public.rooms as room
        on room.id = share.room_id
        and room.status in ('draft', 'active')
      where share.entry_id = p_entry_id
        and share.revoked_at is null
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and (membership.joined_at at time zone 'Asia/Seoul')::date <= entry.date_key
    );
$$;

create function public.can_view_shared_storage_path(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.entry_photos as photo
      join public.entry_room_shares as share on share.entry_id = photo.entry_id
      join public.room_members as membership on membership.room_id = share.room_id
      join public.rooms as room
        on room.id = share.room_id
        and room.status in ('draft', 'active')
      where photo.storage_path = p_storage_path
        and share.revoked_at is null
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and (membership.joined_at at time zone 'Asia/Seoul')::date <= photo.date_key
    );
$$;

revoke all on function public.has_active_room_membership(uuid) from public;
revoke all on function public.has_active_room_membership(uuid) from anon;
grant execute on function public.has_active_room_membership(uuid) to authenticated;

revoke all on function public.can_view_room_day(uuid, date) from public;
revoke all on function public.can_view_room_day(uuid, date) from anon;
grant execute on function public.can_view_room_day(uuid, date) to authenticated;

revoke all on function public.can_view_shared_entry(uuid) from public;
revoke all on function public.can_view_shared_entry(uuid) from anon;
grant execute on function public.can_view_shared_entry(uuid) to authenticated;

revoke all on function public.can_view_shared_storage_path(text) from public;
revoke all on function public.can_view_shared_storage_path(text) from anon;
grant execute on function public.can_view_shared_storage_path(text) to authenticated;

create policy "rooms_select_active_member"
on public.rooms
for select
to authenticated
using (
  public.has_active_room_membership(id)
);

create policy "room_members_select_own"
on public.room_members
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "room_daily_missions_select_active_member"
on public.room_daily_missions
for select
to authenticated
using (
  public.can_view_room_day(room_id, challenge_date)
);

create policy "entry_room_shares_select_author_or_active_member"
on public.entry_room_shares
for select
to authenticated
using (
  shared_by = (select auth.uid())
  or public.can_view_shared_entry(entry_id)
);

create policy "daily_entries_select_shared_room"
on public.daily_entries
for select
to authenticated
using (
  public.can_view_shared_entry(id)
);

create policy "entry_photos_select_shared_room"
on public.entry_photos
for select
to authenticated
using (
  public.can_view_shared_entry(entry_id)
);

create policy "entry_photos_storage_select_shared_room"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'entry-photos'
  and public.can_view_shared_storage_path(name)
);

create function public.ensure_room_daily_mission(p_room_id uuid, p_challenge_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  mission_id uuid;
begin
  if p_challenge_date > (now() at time zone 'Asia/Seoul')::date then
    raise exception 'future_room_mission_not_allowed' using errcode = '22023';
  end if;

  if not exists (select 1 from public.rooms as room where room.id = p_room_id and room.status in ('draft', 'active')) then
    raise exception 'room_not_available' using errcode = 'P0001';
  end if;

  select mission.id
  into mission_id
  from public.get_daily_mission(p_challenge_date) as mission;

  insert into public.room_daily_missions (room_id, challenge_date, mission_id)
  values (p_room_id, p_challenge_date, mission_id)
  on conflict (room_id, challenge_date) do nothing;

  select room_mission.mission_id
  into mission_id
  from public.room_daily_missions as room_mission
  where room_mission.room_id = p_room_id
    and room_mission.challenge_date = p_challenge_date;

  return mission_id;
end;
$$;

revoke all on function public.ensure_room_daily_mission(uuid, date) from public;
revoke all on function public.ensure_room_daily_mission(uuid, date) from anon;
revoke all on function public.ensure_room_daily_mission(uuid, date) from authenticated;

create function public.create_room_with_invite(p_name text, p_emoji text default null)
returns table (
  room_id uuid,
  room_name text,
  room_emoji text,
  invite_code text,
  invite_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
  created_room_id uuid;
  generated_code text;
  invite_token text;
  expires_at timestamptz := now() + interval '24 hours';
  attempt integer;
  today_date date := (now() at time zone 'Asia/Seoul')::date;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 20 then
    raise exception 'room_name_invalid' using errcode = '22023';
  end if;

  if normalized_emoji is not null and char_length(normalized_emoji) > 8 then
    raise exception 'room_emoji_invalid' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.room_members as membership
    where membership.user_id = current_user_id
      and membership.status = 'active'
  ) then
    raise exception 'active_room_already_exists' using errcode = 'P0001';
  end if;

  for attempt in 1..50 loop
    generated_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
    exit when not exists (
      select 1
      from public.room_invites as invite
      where invite.display_code = generated_code
    );
  end loop;

  if generated_code is null or exists (select 1 from public.room_invites as invite where invite.display_code = generated_code) then
    raise exception 'invite_code_generation_failed' using errcode = 'P0001';
  end if;

  insert into public.rooms (name, emoji, created_by)
  values (normalized_name, normalized_emoji, current_user_id)
  returning id into created_room_id;

  insert into public.room_members (room_id, user_id, role, status)
  values (created_room_id, current_user_id, 'owner', 'active');

  perform public.ensure_room_daily_mission(created_room_id, today_date);

  invite_token := encode(gen_random_bytes(32), 'hex');
  insert into public.room_invites (room_id, inviter_id, token_hash, display_code, expires_at, max_uses)
  values (
    created_room_id,
    current_user_id,
    encode(digest(invite_token, 'sha256'), 'hex'),
    generated_code,
    expires_at,
    5
  );

  insert into public.entry_room_shares (entry_id, room_id, shared_by)
  select entry.id, created_room_id, current_user_id
  from public.daily_entries as entry
  join public.room_daily_missions as room_mission
    on room_mission.room_id = created_room_id
    and room_mission.challenge_date = entry.date_key
    and room_mission.mission_id = entry.mission_id
  where entry.user_id = current_user_id
    and entry.date_key = today_date
  on conflict (entry_id, room_id) do nothing;

  return query
  select created_room_id, normalized_name, normalized_emoji, generated_code, expires_at;
end;
$$;

revoke all on function public.create_room_with_invite(text, text) from public;
revoke all on function public.create_room_with_invite(text, text) from anon;
grant execute on function public.create_room_with_invite(text, text) to authenticated;

create function public.get_room_invite_preview(p_display_code text)
returns table (
  room_id uuid,
  room_name text,
  room_emoji text,
  owner_nickname text,
  member_count integer,
  max_members smallint,
  expires_at timestamptz
)
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

  return query
  select
    room.id,
    room.name,
    room.emoji,
    coalesce(owner_profile.nickname, '친구'),
    count(member.user_id)::integer,
    room.max_members,
    invite.expires_at
  from public.room_invites as invite
  join public.rooms as room on room.id = invite.room_id
  join public.room_members as owner_membership
    on owner_membership.room_id = room.id
    and owner_membership.role = 'owner'
    and owner_membership.status = 'active'
  left join public.profiles as owner_profile on owner_profile.id = owner_membership.user_id
  left join public.room_members as member
    on member.room_id = room.id
    and member.status = 'active'
  where invite.display_code = btrim(coalesce(p_display_code, ''))
    and invite.revoked_at is null
    and invite.expires_at > now()
    and invite.use_count < invite.max_uses
    and room.status in ('draft', 'active')
  group by room.id, room.name, room.emoji, owner_profile.nickname, room.max_members, invite.expires_at;
end;
$$;

revoke all on function public.get_room_invite_preview(text) from public;
revoke all on function public.get_room_invite_preview(text) from anon;
grant execute on function public.get_room_invite_preview(text) to authenticated;

create function public.join_room_by_code(p_display_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_invite public.room_invites%rowtype;
  target_room public.rooms%rowtype;
  active_member_count integer;
  today_date date := (now() at time zone 'Asia/Seoul')::date;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select invite.*
  into target_invite
  from public.room_invites as invite
  where invite.display_code = btrim(coalesce(p_display_code, ''))
    and invite.revoked_at is null
    and invite.expires_at > now()
    and invite.use_count < invite.max_uses
  for update;

  if not found then
    raise exception 'room_invite_not_available' using errcode = 'P0001';
  end if;

  if target_invite.inviter_id = current_user_id then
    raise exception 'room_invite_cannot_join_self' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.room_members as membership
    where membership.user_id = current_user_id
      and membership.status = 'active'
  ) then
    raise exception 'active_room_already_exists' using errcode = 'P0001';
  end if;

  select room.*
  into target_room
  from public.rooms as room
  where room.id = target_invite.room_id
    and room.status in ('draft', 'active')
  for update;

  if not found then
    raise exception 'room_not_available' using errcode = 'P0001';
  end if;

  select count(*)::integer
  into active_member_count
  from public.room_members as membership
  where membership.room_id = target_room.id
    and membership.status = 'active';

  if active_member_count >= target_room.max_members then
    raise exception 'room_member_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.room_members (room_id, user_id, role, status)
  values (target_room.id, current_user_id, 'member', 'active');

  update public.rooms
  set status = 'active'
  where id = target_room.id;

  update public.room_invites
  set use_count = use_count + 1
  where id = target_invite.id;

  insert into public.room_invite_uses (invite_id, user_id)
  values (target_invite.id, current_user_id);

  perform public.ensure_room_daily_mission(target_room.id, today_date);

  insert into public.entry_room_shares (entry_id, room_id, shared_by)
  select entry.id, target_room.id, current_user_id
  from public.daily_entries as entry
  join public.room_daily_missions as room_mission
    on room_mission.room_id = target_room.id
    and room_mission.challenge_date = entry.date_key
    and room_mission.mission_id = entry.mission_id
  where entry.user_id = current_user_id
    and entry.date_key = today_date
  on conflict (entry_id, room_id) do nothing;

  return target_room.id;
end;
$$;

revoke all on function public.join_room_by_code(text) from public;
revoke all on function public.join_room_by_code(text) from anon;
grant execute on function public.join_room_by_code(text) to authenticated;

create function public.share_entry_to_active_room(p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_entry public.daily_entries%rowtype;
  target_membership public.room_members%rowtype;
  room_mission_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select entry.*
  into target_entry
  from public.daily_entries as entry
  where entry.id = p_entry_id
    and entry.user_id = current_user_id;

  if not found then
    raise exception 'daily_entry_not_found' using errcode = 'P0001';
  end if;

  select membership.*
  into target_membership
  from public.room_members as membership
  join public.rooms as room on room.id = membership.room_id
  where membership.user_id = current_user_id
    and membership.status = 'active'
    and room.status in ('draft', 'active')
  limit 1;

  if not found or (target_membership.joined_at at time zone 'Asia/Seoul')::date > target_entry.date_key then
    return false;
  end if;

  room_mission_id := public.ensure_room_daily_mission(target_membership.room_id, target_entry.date_key);
  if room_mission_id <> target_entry.mission_id then
    raise exception 'entry_room_share_mission_mismatch' using errcode = '23514';
  end if;

  insert into public.entry_room_shares (entry_id, room_id, shared_by)
  values (target_entry.id, target_membership.room_id, current_user_id)
  on conflict (entry_id, room_id) do nothing;

  return true;
end;
$$;

revoke all on function public.share_entry_to_active_room(uuid) from public;
revoke all on function public.share_entry_to_active_room(uuid) from anon;
grant execute on function public.share_entry_to_active_room(uuid) to authenticated;

create function public.get_active_room()
returns table (
  room_id uuid,
  room_name text,
  room_emoji text,
  room_status text,
  max_members smallint,
  member_user_id uuid,
  member_nickname text,
  member_role text,
  member_joined_at timestamptz,
  invite_code text,
  invite_expires_at timestamptz
)
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

  return query
  select
    room.id,
    room.name,
    room.emoji,
    room.status,
    room.max_members,
    member.user_id,
    coalesce(profile.nickname, '친구'),
    member.role,
    member.joined_at,
    case when current_member.role = 'owner' then invite.display_code else null end,
    case when current_member.role = 'owner' then invite.expires_at else null end
  from public.room_members as current_member
  join public.rooms as room
    on room.id = current_member.room_id
    and room.status in ('draft', 'active')
  join public.room_members as member
    on member.room_id = room.id
    and member.status = 'active'
  left join public.profiles as profile on profile.id = member.user_id
  left join lateral (
    select active_invite.display_code, active_invite.expires_at
    from public.room_invites as active_invite
    where active_invite.room_id = room.id
      and active_invite.revoked_at is null
      and active_invite.expires_at > now()
      and active_invite.use_count < active_invite.max_uses
    order by active_invite.created_at desc
    limit 1
  ) as invite on true
  where current_member.user_id = current_user_id
    and current_member.status = 'active'
  order by member.joined_at;
end;
$$;

revoke all on function public.get_active_room() from public;
revoke all on function public.get_active_room() from anon;
grant execute on function public.get_active_room() to authenticated;
