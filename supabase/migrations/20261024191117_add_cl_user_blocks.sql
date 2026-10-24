-- FR-ROOM-012: bilateral shared-content blocking; personal records and membership stay intact.
begin;
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('colorlog:install', 0));

create table public.cl_user_blocks (
  blocker_id uuid not null references public.cl_profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.cl_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  check (blocker_id <> blocked_user_id)
);
create index cl_user_blocks_subject_idx on public.cl_user_blocks(blocked_user_id);
alter table public.cl_user_blocks enable row level security;
revoke all on public.cl_user_blocks from public, anon, authenticated, service_role;
grant select on public.cl_user_blocks to authenticated;
grant select, insert, update, delete on public.cl_user_blocks to service_role;
create policy cl_user_blocks_select_own on public.cl_user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

-- Never grant this two-party helper to clients: it must not expose third-party relationships.
create function cl_private.are_users_blocked(p_first uuid, p_second uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cl_user_blocks b
    where (b.blocker_id = p_first and b.blocked_user_id = p_second)
      or (b.blocker_id = p_second and b.blocked_user_id = p_first));
$$;
revoke all on function cl_private.are_users_blocked(uuid, uuid) from public, anon, authenticated, service_role;

create function cl_private.is_user_blocked(p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select cl_private.are_users_blocked((select auth.uid()), p_other);
$$;
revoke all on function cl_private.is_user_blocked(uuid) from public, anon, authenticated, service_role;
grant execute on function cl_private.is_user_blocked(uuid) to authenticated;

create function cl_private.set_user_block(p_blocked_user_id uuid, p_should_block boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  session_value uuid := nullif((select auth.jwt())->>'session_id', '')::uuid;
begin
  if actor is null or coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'false'
    or session_value is null or not exists (select 1 from auth.sessions s
      where s.id = session_value and s.user_id = actor and (s.not_after is null or s.not_after > now())) then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_blocked_user_id is null or p_blocked_user_id = actor or p_should_block is null then
    raise exception 'user_block_invalid_input' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'colorlog:block:' || least(actor, p_blocked_user_id)::text || ':' || greatest(actor, p_blocked_user_id)::text, 0));
  if p_should_block then
    if not exists (select 1 from public.cl_user_blocks b where b.blocker_id = actor and b.blocked_user_id = p_blocked_user_id)
      and not exists (select 1 from public.cl_room_members me
        join public.cl_room_members other on other.room_id = me.room_id and other.status = 'active' and other.user_id = p_blocked_user_id
        join public.cl_rooms room on room.id = me.room_id and room.status in ('draft', 'active')
        where me.user_id = actor and me.status = 'active') then
      raise exception 'user_block_not_available' using errcode = '42501';
    end if;
    insert into public.cl_user_blocks(blocker_id, blocked_user_id) values(actor, p_blocked_user_id) on conflict do nothing;
    -- Cancel unsent work, including leased jobs. Already handed-off pushes cannot be recalled.
    update public.cl_room_push_jobs set state = 'cancelled', lease_token = null, lease_until = null,
      last_error_code = 'user_blocked', updated_at = now()
    where state = 'pending' and ((recipient_user_id = actor and source_user_id = p_blocked_user_id)
      or (recipient_user_id = p_blocked_user_id and source_user_id = actor));
  else
    delete from public.cl_user_blocks where blocker_id = actor and blocked_user_id = p_blocked_user_id;
  end if;
  return p_should_block;
end;
$$;
revoke all on function cl_private.set_user_block(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function cl_private.set_user_block(uuid, boolean) to authenticated;
create function public.cl_set_user_block(p_blocked_user_id uuid, p_should_block boolean)
returns boolean language sql security invoker set search_path = '' as $$
  select cl_private.set_user_block(p_blocked_user_id, p_should_block);
$$;
revoke all on function public.cl_set_user_block(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.cl_set_user_block(uuid, boolean) to authenticated;

create function cl_private.get_my_blocked_users()
returns table(user_id uuid, nickname text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.blocked_user_id, p.nickname, b.created_at from public.cl_user_blocks b
  join public.cl_profiles p on p.id = b.blocked_user_id
  where b.blocker_id = (select auth.uid()) order by b.created_at desc, b.blocked_user_id;
$$;
revoke all on function cl_private.get_my_blocked_users() from public, anon, authenticated, service_role;
grant execute on function cl_private.get_my_blocked_users() to authenticated;
create function public.cl_get_my_blocked_users()
returns table(user_id uuid, nickname text, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from cl_private.get_my_blocked_users(); $$;
revoke all on function public.cl_get_my_blocked_users() from public, anon, authenticated, service_role;
grant execute on function public.cl_get_my_blocked_users() to authenticated;

-- Other users' reactions on third-party photos also obey the block boundary.
create policy cl_room_photo_reactions_block_boundary on public.cl_room_photo_reactions
  as restrictive for select to authenticated using (not cl_private.is_user_blocked(user_id));

-- Replace existing readers without changing their grants or response shapes.
create or replace function cl_private.can_view_shared_entry(p_entry_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.cl_entry_room_shares as share
      join public.cl_daily_entries as entry on entry.id = share.entry_id
      where share.entry_id = p_entry_id
        and share.revoked_at is null
        and not cl_private.are_users_blocked((select auth.uid()), entry.user_id)
        and cl_private.can_view_room_day(share.room_id, entry.date_key)
    );
$function$;

create or replace function public.cl_get_room_day_board(p_room_id uuid, p_date_key date)
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, date_key date, mission_id uuid, mission_title_ko text, mission_prompt_ko text, color_name_ko text, color_name_en text, color_hex text, member_user_id uuid, member_nickname text, member_role text, member_joined_at timestamp with time zone, entry_id uuid, photo_id uuid, storage_path text, photo_position smallint, photo_caption text, photo_captured_at timestamp with time zone, photo_width integer, photo_height integer, photo_byte_size bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  current_member_joined_at timestamptz;
  room_time_zone text;
  target_mission_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.joined_at, room.timezone
  into current_member_joined_at, room_time_zone
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active';

  if not found
    or p_date_key is null
    or p_date_key > cl_private.current_date_in_time_zone(room_time_zone)
    or (current_member_joined_at at time zone room_time_zone)::date > p_date_key then
    return;
  end if;

  target_mission_id := public.cl_ensure_room_daily_mission(p_room_id, p_date_key);

  return query
  select
    room.id,
    room.name,
    room.emoji,
    room_mission.challenge_date,
    mission.id,
    mission.title_ko,
    mission.prompt_ko,
    palette.name_ko,
    palette.name_en,
    palette.hex,
    member.user_id,
    coalesce(profile.nickname, '친구'),
    member.role,
    member.joined_at,
    entry.id,
    photo.id,
    photo.storage_path,
    photo.position,
    photo.caption,
    photo.captured_at,
    photo.width,
    photo.height,
    photo.byte_size
  from public.cl_rooms as room
  join public.cl_room_daily_missions as room_mission
    on room_mission.room_id = room.id
    and room_mission.challenge_date = p_date_key
    and room_mission.mission_id = target_mission_id
  join public.cl_daily_missions as mission
    on mission.id = room_mission.mission_id
    and mission.challenge_date = room_mission.challenge_date
  join public.cl_color_palette as palette on palette.id = mission.color_id
  join public.cl_room_members as member
    on member.room_id = room.id
    and member.status = 'active'
    and not cl_private.are_users_blocked(current_user_id, member.user_id)
    and (member.joined_at at time zone room.timezone)::date <= p_date_key
  left join public.cl_profiles as profile on profile.id = member.user_id
  left join public.cl_entry_room_shares as share
    on share.room_id = room.id
    and share.shared_by = member.user_id
    and share.revoked_at is null
  left join public.cl_daily_entries as entry
    on entry.id = share.entry_id
    and entry.user_id = member.user_id
    and entry.date_key = p_date_key
    and entry.mission_id = room_mission.mission_id
  left join public.cl_entry_photos as photo on photo.entry_id = entry.id
  where room.id = p_room_id
    and room.status in ('draft', 'active')
  order by member.joined_at, photo.position nulls last;
end;
$function$;

create or replace function public.cl_get_room_history(p_room_id uuid)
 RETURNS TABLE(date_key date, mission_id uuid, mission_title_ko text, mission_prompt_ko text, color_name_ko text, color_name_en text, color_hex text, participant_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  current_member_joined_at timestamptz;
  room_time_zone text;
  today_date date;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.joined_at, room.timezone
  into current_member_joined_at, room_time_zone
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active';

  if not found then return; end if;
  today_date := cl_private.current_date_in_time_zone(room_time_zone);
  perform public.cl_ensure_room_daily_mission(p_room_id, today_date);

  return query
  select
    room_mission.challenge_date,
    mission.id,
    mission.title_ko,
    mission.prompt_ko,
    palette.name_ko,
    palette.name_en,
    palette.hex,
    count(distinct case when entry.id is not null then share.shared_by end)::integer
  from public.cl_room_daily_missions as room_mission
  join public.cl_daily_missions as mission
    on mission.id = room_mission.mission_id
    and mission.challenge_date = room_mission.challenge_date
  join public.cl_color_palette as palette on palette.id = mission.color_id
  left join public.cl_entry_room_shares as share
    on share.room_id = room_mission.room_id
    and share.revoked_at is null
    and not cl_private.are_users_blocked(current_user_id, share.shared_by)
  left join public.cl_daily_entries as entry
    on entry.id = share.entry_id
    and entry.user_id = share.shared_by
    and entry.date_key = room_mission.challenge_date
    and entry.mission_id = room_mission.mission_id
  where room_mission.room_id = p_room_id
    and room_mission.challenge_date >= (current_member_joined_at at time zone room_time_zone)::date
    and room_mission.challenge_date <= today_date
  group by room_mission.challenge_date, mission.id, mission.title_ko, mission.prompt_ko,
    palette.name_ko, palette.name_en, palette.hex
  order by room_mission.challenge_date desc;
end;
$function$;

create or replace function public.cl_get_room_photo_reactions(p_room_id uuid, p_photo_id uuid)
 RETURNS TABLE(emoji text, reaction_count integer, reacted_by_me boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  can_view boolean := false;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select true into can_view
  from public.cl_entry_photos as photo
  join public.cl_daily_entries as entry on entry.id = photo.entry_id
  join public.cl_entry_room_shares as share
    on share.entry_id = entry.id
    and share.room_id = p_room_id
    and share.revoked_at is null
  join public.cl_room_members as viewer_membership
    on viewer_membership.room_id = p_room_id
    and viewer_membership.user_id = current_user_id
    and viewer_membership.status = 'active'
  join public.cl_rooms as room
    on room.id = p_room_id
    and room.status in ('draft', 'active')
  where photo.id = p_photo_id
    and not cl_private.are_users_blocked(current_user_id, photo.owner_id)
    and (viewer_membership.joined_at at time zone room.timezone)::date <= entry.date_key;

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
  left join public.cl_room_photo_reactions as reaction
    on reaction.room_id = p_room_id
    and reaction.photo_id = p_photo_id
    and reaction.emoji = choices.emoji
    and not cl_private.are_users_blocked(current_user_id, reaction.user_id)
  group by choices.emoji
  order by choices.emoji;
end;
$function$;

create or replace function public.cl_toggle_room_photo_reaction(p_room_id uuid, p_photo_id uuid, p_emoji text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  select photo.owner_id into photo_owner_id
  from public.cl_entry_photos as photo
  join public.cl_daily_entries as entry on entry.id = photo.entry_id
  join public.cl_entry_room_shares as share
    on share.entry_id = entry.id
    and share.room_id = p_room_id
    and share.revoked_at is null
  join public.cl_room_members as viewer_membership
    on viewer_membership.room_id = p_room_id
    and viewer_membership.user_id = current_user_id
    and viewer_membership.status = 'active'
  join public.cl_rooms as room
    on room.id = p_room_id
    and room.status in ('draft', 'active')
  where photo.id = p_photo_id
    and not cl_private.are_users_blocked(current_user_id, photo.owner_id)
    and (viewer_membership.joined_at at time zone room.timezone)::date <= entry.date_key;

  if not found or photo_owner_id = current_user_id then
    raise exception 'room_photo_reaction_not_available' using errcode = '42501';
  end if;

  select reaction.emoji into existing_emoji
  from public.cl_room_photo_reactions as reaction
  where reaction.room_id = p_room_id
    and reaction.photo_id = p_photo_id
    and reaction.user_id = current_user_id
  for update;

  if existing_emoji = p_emoji then
    delete from public.cl_room_photo_reactions
    where room_id = p_room_id
      and photo_id = p_photo_id
      and user_id = current_user_id;
    return false;
  end if;

  insert into public.cl_room_photo_reactions (room_id, photo_id, user_id, emoji)
  values (p_room_id, p_photo_id, current_user_id, p_emoji)
  on conflict (room_id, photo_id, user_id)
  do update set emoji = excluded.emoji, updated_at = now();

  return true;
end;
$function$;

create or replace function public.cl_get_active_room_day_board(p_date_key date)
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, date_key date, mission_id uuid, mission_title_ko text, mission_prompt_ko text, color_name_ko text, color_name_en text, color_hex text, member_user_id uuid, member_nickname text, member_role text, member_joined_at timestamp with time zone, entry_id uuid, photo_id uuid, storage_path text, photo_position smallint, photo_caption text, photo_captured_at timestamp with time zone, photo_width integer, photo_height integer, photo_byte_size bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target_room_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select m.room_id into target_room_id from public.cl_room_members m
  join public.cl_rooms r on r.id = m.room_id and r.status in ('draft', 'active')
  where m.user_id = (select auth.uid()) and m.status = 'active' order by m.joined_at, m.room_id limit 1;
  if target_room_id is null then return; end if;
  return query select * from public.cl_get_room_day_board(target_room_id, p_date_key);
end;
$function$;

create or replace function public.cl_get_active_room_today_board()
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, date_key date, mission_id uuid, mission_title_ko text, mission_prompt_ko text, color_name_ko text, color_name_en text, color_hex text, member_user_id uuid, member_nickname text, member_role text, member_joined_at timestamp with time zone, entry_id uuid, photo_id uuid, storage_path text, photo_position smallint, photo_caption text, photo_captured_at timestamp with time zone, photo_width integer, photo_height integer, photo_byte_size bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target_room_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select m.room_id into target_room_id from public.cl_room_members m
  join public.cl_rooms r on r.id = m.room_id and r.status in ('draft', 'active')
  where m.user_id = (select auth.uid()) and m.status = 'active' order by m.joined_at, m.room_id limit 1;
  if target_room_id is null then return; end if;
  return query select * from public.cl_get_room_today_board(target_room_id);
end;
$function$;

create or replace function public.cl_get_active_room_history()
 RETURNS TABLE(date_key date, mission_id uuid, mission_title_ko text, mission_prompt_ko text, color_name_ko text, color_name_en text, color_hex text, participant_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target_room_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select m.room_id into target_room_id from public.cl_room_members m
  join public.cl_rooms r on r.id = m.room_id and r.status in ('draft', 'active')
  where m.user_id = (select auth.uid()) and m.status = 'active' order by m.joined_at, m.room_id limit 1;
  if target_room_id is null then return; end if;
  return query select * from public.cl_get_room_history(target_room_id);
end;
$function$;

create or replace function cl_private.enqueue_room_photo_push(p_photo_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare inserted integer; pair_key text;
begin
  -- Use the same ordered pair locks as block/unblock. A concurrent upload must
  -- either enqueue before cancellation or observe the committed block.
  for pair_key in
    select distinct 'colorlog:block:' || least(photo.owner_id, recipient.user_id)::text || ':' || greatest(photo.owner_id, recipient.user_id)::text
    from public.cl_entry_photos photo
    join public.cl_entry_room_shares share on share.entry_id = photo.entry_id and share.revoked_at is null
    join public.cl_room_members recipient on recipient.room_id = share.room_id and recipient.status = 'active' and recipient.user_id <> photo.owner_id
    where photo.id = p_photo_id order by 1
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pair_key, 0));
  end loop;
  insert into public.cl_room_push_jobs
    (room_id, recipient_user_id, source_user_id, date_key, photo_id, device_id, device_registration_id)
  select room.id, recipient.user_id, photo.owner_id, photo.date_key, photo.id, device.id, device.registration_id
  from public.cl_entry_photos photo
  join public.cl_daily_entries entry on entry.id = photo.entry_id and entry.user_id = photo.owner_id and entry.date_key = photo.date_key
  join public.cl_entry_room_shares share on share.entry_id = entry.id and share.revoked_at is null
  join public.cl_rooms room on room.id = share.room_id and room.status in ('draft', 'active')
  join public.cl_room_daily_missions mission on mission.room_id = room.id and mission.challenge_date = photo.date_key and mission.mission_id = entry.mission_id
  join public.cl_room_members source on source.room_id = room.id and source.user_id = photo.owner_id and source.status = 'active'
  join public.cl_room_members recipient on recipient.room_id = room.id and recipient.status = 'active' and recipient.user_id <> photo.owner_id
    and not cl_private.are_users_blocked(recipient.user_id, photo.owner_id)
  join public.cl_push_devices device on device.user_id = recipient.user_id and device.is_enabled
  join auth.sessions session on session.id = device.session_id and session.user_id = device.user_id and (session.not_after is null or session.not_after > now())
  where photo.id = p_photo_id and photo.created_at >= now() - interval '24 hours'
    and photo.date_key <= cl_private.current_date_in_time_zone(room.timezone)
    and (source.joined_at at time zone room.timezone)::date <= photo.date_key
    and (recipient.joined_at at time zone room.timezone)::date <= photo.date_key
    and not exists (select 1 from public.cl_room_photo_push_deliveries old
      where old.room_id = room.id and old.recipient_user_id = recipient.user_id
        and old.source_user_id = photo.owner_id and old.date_key = photo.date_key)
  on conflict (room_id, recipient_user_id, source_user_id, date_key, device_id) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create or replace function cl_private.room_push_payload(p_job_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('to', device.expo_push_token, 'title', room.name,
    'body', profile.nickname || ' 님이 사진을 추가했어요.',
    'data', jsonb_build_object('destination', 'room', 'roomId', room.id::text,
      'photoId', photo.id::text, 'dateKey', job.date_key::text, 'recipientUserId', job.recipient_user_id::text))
  from public.cl_room_push_jobs job
  join public.cl_entry_photos photo on photo.id = job.photo_id and photo.owner_id = job.source_user_id and photo.date_key = job.date_key
  join public.cl_daily_entries entry on entry.id = photo.entry_id and entry.user_id = job.source_user_id
  join public.cl_entry_room_shares share on share.entry_id = entry.id and share.room_id = job.room_id and share.revoked_at is null
  join public.cl_rooms room on room.id = job.room_id and room.status in ('draft', 'active')
  join public.cl_room_daily_missions mission on mission.room_id = room.id and mission.challenge_date = job.date_key and mission.mission_id = entry.mission_id
  join public.cl_profiles profile on profile.id = job.source_user_id
  join public.cl_room_members source on source.room_id = room.id and source.user_id = job.source_user_id and source.status = 'active'
  join public.cl_room_members recipient on recipient.room_id = room.id and recipient.user_id = job.recipient_user_id and recipient.status = 'active'
  join public.cl_push_devices device on device.id = job.device_id and device.user_id = job.recipient_user_id
    and device.is_enabled and device.registration_id = job.device_registration_id
  join auth.sessions session on session.id = device.session_id and session.user_id = device.user_id and (session.not_after is null or session.not_after > now())
  where job.id = p_job_id
    and not cl_private.are_users_blocked(job.recipient_user_id, job.source_user_id) and job.expires_at > now()
    and job.date_key <= cl_private.current_date_in_time_zone(room.timezone)
    and (source.joined_at at time zone room.timezone)::date <= job.date_key
    and (recipient.joined_at at time zone room.timezone)::date <= job.date_key;
$$;

create or replace function public.cl_claim_room_photo_push_delivery(p_room_id uuid, p_recipient_user_id uuid, p_source_user_id uuid, p_date_key date)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  did_claim boolean := false;
begin
  if cl_private.are_users_blocked(p_recipient_user_id, p_source_user_id) then return false; end if;
  insert into public.cl_room_photo_push_deliveries (room_id, recipient_user_id, source_user_id, date_key)
  values (p_room_id, p_recipient_user_id, p_source_user_id, p_date_key)
  on conflict do nothing
  returning true into did_claim;

  return coalesce(did_claim, false);
end;
$function$;

create or replace function cl_private.submit_room_report(p_room_id uuid, p_target_type text, p_target_id uuid, p_reason text, p_details text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  session_id_value uuid := nullif((select auth.jwt())->>'session_id', '')::uuid;
  subject uuid;
  photo uuid;
  receipt uuid;
  normalized_details text := nullif(btrim(p_details, E' \t\n\r\f'), '');
begin
  if actor is null or coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'false'
    or session_id_value is null or not exists (
      select 1 from auth.sessions s where s.id = session_id_value and s.user_id = actor
        and (s.not_after is null or s.not_after > now())
    ) then raise exception 'authentication_required' using errcode = '42501'; end if;

  if p_room_id is null or p_target_id is null or p_target_type is null or p_target_type not in ('photo', 'member')
    or p_reason is null or p_reason not in ('inappropriate', 'harassment', 'privacy', 'illegal', 'spam', 'other')
    or char_length(coalesce(normalized_details, '')) > 500
    or (p_reason = 'other' and (normalized_details is null or normalized_details !~ '[^[:space:]]')) then
    raise exception 'room_report_invalid_input' using errcode = '22023';
  end if;

  -- Serialize this reporter's retries and rate checks across rooms.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('colorlog:report:' || actor::text, 0));
  if p_target_type = 'photo' then
    select p.owner_id, p.id into subject, photo
    from public.cl_entry_photos p
    join public.cl_daily_entries e on e.id = p.entry_id and e.user_id = p.owner_id
    join public.cl_entry_room_shares share on share.entry_id = e.id and share.room_id = p_room_id and share.revoked_at is null
    join public.cl_room_daily_missions mission on mission.room_id = p_room_id and mission.challenge_date = e.date_key and mission.mission_id = e.mission_id
    join public.cl_room_members author on author.room_id = p_room_id and author.user_id = p.owner_id and author.status = 'active'
    where p.id = p_target_id and not cl_private.are_users_blocked(actor, p.owner_id) and cl_private.can_view_room_day(p_room_id, e.date_key);
  else
    select m.user_id into subject from public.cl_room_members m
    where m.room_id = p_room_id and m.user_id = p_target_id and m.status = 'active'
      and cl_private.has_active_room_membership(p_room_id);
  end if;
  if subject is null or subject = actor then
    raise exception 'room_report_not_available' using errcode = '42501';
  end if;

  select r.id into receipt from public.cl_room_reports r
  where r.reporter_id = actor and r.room_id = p_room_id and r.target_type = p_target_type
    and ((p_target_type = 'photo' and r.photo_id = photo) or (p_target_type = 'member' and r.reported_user_id = subject));
  if found then return jsonb_build_object('report_id', receipt, 'already_submitted', true); end if;
  if (select count(*) from public.cl_room_reports r where r.reporter_id = actor and r.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'room_report_rate_limited' using errcode = 'P0001';
  end if;

  insert into public.cl_room_reports(room_id, reporter_id, reported_user_id, target_type, photo_id, reason, details)
  values(p_room_id, actor, subject, p_target_type, photo, p_reason, normalized_details)
  returning id into receipt;
  return jsonb_build_object('report_id', receipt, 'already_submitted', false);
end;
$$;

insert into cl_private.schema_migrations(version) values ('20261024191117');
commit;
