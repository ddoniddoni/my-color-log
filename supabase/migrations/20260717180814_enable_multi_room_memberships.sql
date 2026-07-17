drop index if exists public.room_members_one_active_room_per_user_idx;

create index if not exists room_members_active_user_idx
on public.room_members (user_id, joined_at desc)
where status = 'active';

create or replace function public.assert_active_room_capacity(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  if (
    select count(*)
    from public.room_members as membership
    join public.rooms as room
      on room.id = membership.room_id
      and room.status in ('draft', 'active')
    where membership.user_id = p_user_id
      and membership.status = 'active'
  ) >= 3 then
    raise exception 'active_room_limit_reached' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.assert_active_room_capacity(uuid) from public;
revoke all on function public.assert_active_room_capacity(uuid) from anon;
revoke all on function public.assert_active_room_capacity(uuid) from authenticated;

create or replace function public.share_entry_to_active_room(p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_entry public.daily_entries%rowtype;
  membership_record record;
  room_mission_id uuid;
  did_share boolean := false;
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

  for membership_record in
    select membership.room_id
    from public.room_members as membership
    join public.rooms as room
      on room.id = membership.room_id
      and room.status in ('draft', 'active')
    where membership.user_id = current_user_id
      and membership.status = 'active'
      and (membership.joined_at at time zone 'Asia/Seoul')::date <= target_entry.date_key
  loop
    room_mission_id := public.ensure_room_daily_mission(membership_record.room_id, target_entry.date_key);

    if room_mission_id <> target_entry.mission_id then
      raise exception 'entry_room_share_mission_mismatch' using errcode = '23514';
    end if;

    insert into public.entry_room_shares (entry_id, room_id, shared_by)
    values (target_entry.id, membership_record.room_id, current_user_id)
    on conflict on constraint entry_room_shares_pkey do nothing;

    did_share := true;
  end loop;

  return did_share;
end;
$$;

revoke all on function public.share_entry_to_active_room(uuid) from public;
revoke all on function public.share_entry_to_active_room(uuid) from anon;
grant execute on function public.share_entry_to_active_room(uuid) to authenticated;

create or replace function public.create_room_with_invite(p_name text, p_emoji text default null)
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
  today_entry_id uuid;
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

  perform public.assert_active_room_capacity(current_user_id);

  for attempt in 1..50 loop
    generated_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
    exit when not exists (
      select 1
      from public.room_invites as invite
      where invite.display_code = generated_code
    );
  end loop;

  if generated_code is null or exists (
    select 1
    from public.room_invites as invite
    where invite.display_code = generated_code
  ) then
    raise exception 'invite_code_generation_failed' using errcode = 'P0001';
  end if;

  insert into public.rooms (name, emoji, created_by)
  values (normalized_name, normalized_emoji, current_user_id)
  returning id into created_room_id;

  insert into public.room_members (room_id, user_id, role, status)
  values (created_room_id, current_user_id, 'owner', 'active');

  perform public.ensure_room_daily_mission(created_room_id, today_date);

  invite_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.room_invites (room_id, inviter_id, token_hash, display_code, expires_at, max_uses)
  values (
    created_room_id,
    current_user_id,
    encode(extensions.digest(invite_token, 'sha256'), 'hex'),
    generated_code,
    expires_at,
    5
  );

  select entry.id
  into today_entry_id
  from public.daily_entries as entry
  where entry.user_id = current_user_id
    and entry.date_key = today_date;

  if today_entry_id is not null then
    perform public.share_entry_to_active_room(today_entry_id);
  end if;

  return query
  select created_room_id, normalized_name, normalized_emoji, generated_code, expires_at;
end;
$$;

revoke all on function public.create_room_with_invite(text, text) from public;
revoke all on function public.create_room_with_invite(text, text) from anon;
grant execute on function public.create_room_with_invite(text, text) to authenticated;

create or replace function public.join_room_by_code(p_display_code text)
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
  today_entry_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  perform public.assert_active_room_capacity(current_user_id);

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

  select room.*
  into target_room
  from public.rooms as room
  where room.id = target_invite.room_id
    and room.status in ('draft', 'active')
  for update;

  if not found then
    raise exception 'room_not_available' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.room_members as membership
    where membership.room_id = target_room.id
      and membership.user_id = current_user_id
      and membership.status = 'active'
  ) then
    raise exception 'room_already_joined' using errcode = 'P0001';
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

  select entry.id
  into today_entry_id
  from public.daily_entries as entry
  where entry.user_id = current_user_id
    and entry.date_key = today_date;

  if today_entry_id is not null then
    perform public.share_entry_to_active_room(today_entry_id);
  end if;

  return target_room.id;
end;
$$;

revoke all on function public.join_room_by_code(text) from public;
revoke all on function public.join_room_by_code(text) from anon;
grant execute on function public.join_room_by_code(text) to authenticated;

create function public.get_my_rooms()
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
  order by current_member.joined_at desc, member.joined_at;
end;
$$;

revoke all on function public.get_my_rooms() from public;
revoke all on function public.get_my_rooms() from anon;
grant execute on function public.get_my_rooms() to authenticated;

create function public.get_room(p_room_id uuid)
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
  where current_member.room_id = p_room_id
    and current_member.user_id = current_user_id
    and current_member.status = 'active'
  order by member.joined_at;
end;
$$;

revoke all on function public.get_room(uuid) from public;
revoke all on function public.get_room(uuid) from anon;
grant execute on function public.get_room(uuid) to authenticated;

create function public.get_room_day_board(p_room_id uuid, p_date_key date)
returns table (
  room_id uuid,
  room_name text,
  room_emoji text,
  date_key date,
  mission_id uuid,
  mission_title_ko text,
  mission_prompt_ko text,
  color_name_ko text,
  color_name_en text,
  color_hex text,
  member_user_id uuid,
  member_nickname text,
  member_role text,
  member_joined_at timestamptz,
  entry_id uuid,
  photo_id uuid,
  storage_path text,
  photo_position smallint,
  photo_caption text,
  photo_captured_at timestamptz,
  photo_width integer,
  photo_height integer,
  photo_byte_size bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_member_joined_at timestamptz;
  target_mission_id uuid;
  today_date date := (now() at time zone 'Asia/Seoul')::date;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_room_id is null or p_date_key is null or p_date_key > today_date then
    return;
  end if;

  select membership.joined_at
  into current_member_joined_at
  from public.room_members as membership
  join public.rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active';

  if not found
    or (current_member_joined_at at time zone 'Asia/Seoul')::date > p_date_key then
    return;
  end if;

  target_mission_id := public.ensure_room_daily_mission(p_room_id, p_date_key);

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
  from public.rooms as room
  join public.room_daily_missions as room_mission
    on room_mission.room_id = room.id
    and room_mission.challenge_date = p_date_key
    and room_mission.mission_id = target_mission_id
  join public.daily_missions as mission
    on mission.id = room_mission.mission_id
    and mission.challenge_date = room_mission.challenge_date
  join public.color_palette as palette on palette.id = mission.color_id
  join public.room_members as member
    on member.room_id = room.id
    and member.status = 'active'
    and (member.joined_at at time zone 'Asia/Seoul')::date <= p_date_key
  left join public.profiles as profile on profile.id = member.user_id
  left join public.entry_room_shares as share
    on share.room_id = room.id
    and share.shared_by = member.user_id
    and share.revoked_at is null
  left join public.daily_entries as entry
    on entry.id = share.entry_id
    and entry.user_id = member.user_id
    and entry.date_key = p_date_key
    and entry.mission_id = room_mission.mission_id
  left join public.entry_photos as photo on photo.entry_id = entry.id
  where room.id = p_room_id
    and room.status in ('draft', 'active')
  order by member.joined_at, photo.position nulls last;
end;
$$;

revoke all on function public.get_room_day_board(uuid, date) from public;
revoke all on function public.get_room_day_board(uuid, date) from anon;
grant execute on function public.get_room_day_board(uuid, date) to authenticated;

create function public.get_room_today_board(p_room_id uuid)
returns table (
  room_id uuid,
  room_name text,
  room_emoji text,
  date_key date,
  mission_id uuid,
  mission_title_ko text,
  mission_prompt_ko text,
  color_name_ko text,
  color_name_en text,
  color_hex text,
  member_user_id uuid,
  member_nickname text,
  member_role text,
  member_joined_at timestamptz,
  entry_id uuid,
  photo_id uuid,
  storage_path text,
  photo_position smallint,
  photo_caption text,
  photo_captured_at timestamptz,
  photo_width integer,
  photo_height integer,
  photo_byte_size bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_date date := (now() at time zone 'Asia/Seoul')::date;
begin
  return query
  select *
  from public.get_room_day_board(p_room_id, target_date);
end;
$$;

revoke all on function public.get_room_today_board(uuid) from public;
revoke all on function public.get_room_today_board(uuid) from anon;
grant execute on function public.get_room_today_board(uuid) to authenticated;

create function public.get_room_history(p_room_id uuid)
returns table (
  date_key date,
  mission_id uuid,
  mission_title_ko text,
  mission_prompt_ko text,
  color_name_ko text,
  color_name_en text,
  color_hex text,
  participant_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_member_joined_at timestamptz;
  today_date date := (now() at time zone 'Asia/Seoul')::date;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.joined_at
  into current_member_joined_at
  from public.room_members as membership
  join public.rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active';

  if not found then
    return;
  end if;

  perform public.ensure_room_daily_mission(p_room_id, today_date);

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
  from public.room_daily_missions as room_mission
  join public.daily_missions as mission
    on mission.id = room_mission.mission_id
    and mission.challenge_date = room_mission.challenge_date
  join public.color_palette as palette on palette.id = mission.color_id
  left join public.entry_room_shares as share
    on share.room_id = room_mission.room_id
    and share.revoked_at is null
  left join public.daily_entries as entry
    on entry.id = share.entry_id
    and entry.user_id = share.shared_by
    and entry.date_key = room_mission.challenge_date
    and entry.mission_id = room_mission.mission_id
  where room_mission.room_id = p_room_id
    and room_mission.challenge_date >= (current_member_joined_at at time zone 'Asia/Seoul')::date
    and room_mission.challenge_date <= today_date
  group by
    room_mission.challenge_date,
    mission.id,
    mission.title_ko,
    mission.prompt_ko,
    palette.name_ko,
    palette.name_en,
    palette.hex
  order by room_mission.challenge_date desc;
end;
$$;

revoke all on function public.get_room_history(uuid) from public;
revoke all on function public.get_room_history(uuid) from anon;
grant execute on function public.get_room_history(uuid) to authenticated;

create function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role text;
  active_member_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
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

  if current_role = 'owner' then
    raise exception 'room_owner_cannot_leave' using errcode = 'P0001';
  end if;

  update public.room_members
  set status = 'left', left_at = now()
  where room_id = p_room_id
    and user_id = current_user_id
    and status = 'active';

  select count(*)::integer
  into active_member_count
  from public.room_members as membership
  where membership.room_id = p_room_id
    and membership.status = 'active';

  if active_member_count = 0 then
    update public.rooms
    set status = 'ended', ended_at = now()
    where id = p_room_id;
  elsif active_member_count = 1 then
    update public.rooms
    set status = 'draft'
    where id = p_room_id;
  end if;
end;
$$;

revoke all on function public.leave_room(uuid) from public;
revoke all on function public.leave_room(uuid) from anon;
grant execute on function public.leave_room(uuid) to authenticated;

create function public.transfer_room_ownership(p_room_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_new_owner_id is null or p_new_owner_id = current_user_id then
    raise exception 'room_owner_transfer_target_invalid' using errcode = '22023';
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

  perform 1
  from public.room_members as membership
  where membership.room_id = p_room_id
    and membership.status = 'active'
  for update;

  if not exists (
    select 1
    from public.room_members as membership
    where membership.room_id = p_room_id
      and membership.user_id = p_new_owner_id
      and membership.status = 'active'
  ) then
    raise exception 'room_owner_transfer_target_invalid' using errcode = '22023';
  end if;

  update public.room_members
  set role = 'member'
  where room_id = p_room_id
    and user_id = current_user_id
    and status = 'active'
    and role = 'owner';

  update public.room_members
  set role = 'owner'
  where room_id = p_room_id
    and user_id = p_new_owner_id
    and status = 'active'
    and role = 'member';
end;
$$;

revoke all on function public.transfer_room_ownership(uuid, uuid) from public;
revoke all on function public.transfer_room_ownership(uuid, uuid) from anon;
grant execute on function public.transfer_room_ownership(uuid, uuid) to authenticated;

create function public.end_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
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

  update public.rooms
  set status = 'ended', ended_at = now()
  where id = p_room_id;

  update public.room_members
  set status = 'left', left_at = now()
  where room_id = p_room_id
    and status = 'active';

  update public.room_invites
  set revoked_at = now()
  where room_id = p_room_id
    and revoked_at is null;
end;
$$;

revoke all on function public.end_room(uuid) from public;
revoke all on function public.end_room(uuid) from anon;
grant execute on function public.end_room(uuid) to authenticated;

create function public.update_room_settings(p_room_id uuid, p_name text, p_emoji text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role text;
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
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

  update public.rooms
  set name = normalized_name,
      emoji = normalized_emoji
  where id = p_room_id
    and status in ('draft', 'active');
end;
$$;

revoke all on function public.update_room_settings(uuid, text, text) from public;
revoke all on function public.update_room_settings(uuid, text, text) from anon;
grant execute on function public.update_room_settings(uuid, text, text) to authenticated;

create function public.revoke_room_invites(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
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

  update public.room_invites
  set revoked_at = now()
  where room_id = p_room_id
    and revoked_at is null;
end;
$$;

revoke all on function public.revoke_room_invites(uuid) from public;
revoke all on function public.revoke_room_invites(uuid) from anon;
grant execute on function public.revoke_room_invites(uuid) to authenticated;

create function public.create_room_invite(p_room_id uuid)
returns table (
  invite_code text,
  invite_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role text;
  max_member_count smallint;
  active_member_count integer;
  generated_code text;
  invite_token text;
  created_invite_id uuid;
  expires_at timestamptz := now() + interval '24 hours';
  remaining_uses smallint;
  attempt integer;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.role, room.max_members
  into current_role, max_member_count
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

  perform 1
  from public.room_invites as invite
  where invite.room_id = p_room_id
    and invite.revoked_at is null
  for update;

  select count(*)::integer
  into active_member_count
  from public.room_members as membership
  where membership.room_id = p_room_id
    and membership.status = 'active';

  if active_member_count >= max_member_count then
    raise exception 'room_member_limit_reached' using errcode = 'P0001';
  end if;

  update public.room_invites
  set revoked_at = now()
  where room_id = p_room_id
    and revoked_at is null;

  remaining_uses := least(5, max_member_count - active_member_count)::smallint;

  for attempt in 1..50 loop
    generated_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');

    if exists (
      select 1
      from public.room_invites as invite
      where invite.display_code = generated_code
    ) then
      continue;
    end if;

    invite_token := encode(extensions.gen_random_bytes(32), 'hex');

    begin
      insert into public.room_invites (room_id, inviter_id, token_hash, display_code, expires_at, max_uses)
      values (
        p_room_id,
        current_user_id,
        encode(extensions.digest(invite_token, 'sha256'), 'hex'),
        generated_code,
        expires_at,
        remaining_uses
      )
      returning id into created_invite_id;
      exit;
    exception when unique_violation then
      created_invite_id := null;
    end;
  end loop;

  if created_invite_id is null then
    raise exception 'invite_code_generation_failed' using errcode = 'P0001';
  end if;

  return query select generated_code, expires_at;
end;
$$;

revoke all on function public.create_room_invite(uuid) from public;
revoke all on function public.create_room_invite(uuid) from anon;
grant execute on function public.create_room_invite(uuid) to authenticated;

create or replace function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_record record;
  successor_user_id uuid;
begin
  if p_user_id is null or (select auth.role()) <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  for room_record in
    select membership.room_id
    from public.room_members as membership
    join public.rooms as room
      on room.id = membership.room_id
      and room.status in ('draft', 'active')
    where membership.user_id = p_user_id
      and membership.status = 'active'
      and membership.role = 'owner'
    for update of membership, room
  loop
    perform 1
    from public.room_members as membership
    where membership.room_id = room_record.room_id
      and membership.status = 'active'
    for update;

    select membership.user_id
    into successor_user_id
    from public.room_members as membership
    where membership.room_id = room_record.room_id
      and membership.status = 'active'
      and membership.user_id <> p_user_id
    order by membership.joined_at
    limit 1;

    update public.room_invites
    set revoked_at = now()
    where room_id = room_record.room_id
      and revoked_at is null;

    if successor_user_id is not null then
      update public.room_members
      set role = 'member'
      where room_id = room_record.room_id
        and user_id = p_user_id
        and status = 'active'
        and role = 'owner';

      update public.room_members
      set role = 'owner'
      where room_id = room_record.room_id
        and user_id = successor_user_id
        and status = 'active'
        and role = 'member';
    else
      update public.rooms
      set status = 'ended', ended_at = now()
      where id = room_record.room_id
        and status in ('draft', 'active');

      update public.room_members
      set status = 'left', left_at = now()
      where room_id = room_record.room_id
        and user_id = p_user_id
        and status = 'active';
    end if;
  end loop;
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public;
revoke all on function public.prepare_account_deletion(uuid) from anon;
revoke all on function public.prepare_account_deletion(uuid) from authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
