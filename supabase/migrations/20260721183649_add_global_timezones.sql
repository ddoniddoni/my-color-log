-- Keep persisted timestamps in UTC while assigning immutable date keys with an
-- IANA timezone. Personal dates follow profiles.timezone; room dates follow the
-- timezone captured when the room is created.

create or replace function private.is_valid_time_zone(p_time_zone text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(btrim(p_time_zone), '') <> ''
    and exists (
      select 1
      from pg_catalog.pg_timezone_names() as zone
      where zone.name = btrim(p_time_zone)
    );
$$;

revoke all on function private.is_valid_time_zone(text) from public, anon, authenticated;

create or replace function private.current_date_in_time_zone(
  p_time_zone text,
  p_now timestamptz default now()
)
returns date
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_valid_time_zone(p_time_zone) then
    raise exception 'invalid_time_zone' using errcode = '22023';
  end if;
  return (p_now at time zone p_time_zone)::date;
end;
$$;

revoke all on function private.current_date_in_time_zone(text, timestamptz) from public, anon, authenticated;

create or replace function private.validate_iana_timezone_column()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.timezone := btrim(new.timezone);
  if not private.is_valid_time_zone(new.timezone) then
    raise exception 'invalid_time_zone' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_iana_timezone_column() from public, anon, authenticated;

update public.profiles as profile
set timezone = 'Asia/Seoul'
where not private.is_valid_time_zone(profile.timezone);

alter table public.rooms add column if not exists timezone text;

update public.rooms as room
set timezone = coalesce(
  (
    select profile.timezone
    from public.profiles as profile
    where profile.id = room.created_by
      and private.is_valid_time_zone(profile.timezone)
  ),
  'Asia/Seoul'
)
where room.timezone is null
  or not private.is_valid_time_zone(room.timezone);

alter table public.rooms alter column timezone set default 'Asia/Seoul';
alter table public.rooms alter column timezone set not null;

create or replace function private.latest_current_date_for_user(
  p_user_id uuid,
  p_now timestamptz default now()
)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select max(candidate.date_key)
  from (
    select private.current_date_in_time_zone(coalesce(profile.timezone, 'Asia/Seoul'), p_now) as date_key
    from (select 1) as seed
    left join public.profiles as profile on profile.id = p_user_id

    union all

    select private.current_date_in_time_zone(room.timezone, p_now)
    from public.room_members as membership
    join public.rooms as room
      on room.id = membership.room_id
      and room.status in ('draft', 'active')
    where membership.user_id = p_user_id
      and membership.status = 'active'
  ) as candidate;
$$;

revoke all on function private.latest_current_date_for_user(uuid, timestamptz) from public, anon, authenticated;

drop trigger if exists profiles_validate_timezone on public.profiles;
create trigger profiles_validate_timezone
before insert or update of timezone on public.profiles
for each row execute function private.validate_iana_timezone_column();

drop trigger if exists rooms_validate_timezone on public.rooms;
create trigger rooms_validate_timezone
before insert or update of timezone on public.rooms
for each row execute function private.validate_iana_timezone_column();

create or replace function public.get_daily_mission(p_challenge_date date default null)
returns table (
  id uuid,
  challenge_date date,
  mission_type text,
  title_ko text,
  prompt_ko text,
  published_at timestamptz,
  source text,
  color_id uuid,
  color_slug text,
  color_name_ko text,
  color_name_en text,
  color_hex text,
  color_tint_hex text,
  color_shade_hex text,
  color_on_color_hex text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  profile_time_zone text;
  target_date date;
  latest_allowed_date date;
  active_color_count integer;
  selected_color public.color_palette%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select coalesce(profile.timezone, 'Asia/Seoul')
  into profile_time_zone
  from (select 1) as seed
  left join public.profiles as profile on profile.id = current_user_id;

  target_date := coalesce(p_challenge_date, private.current_date_in_time_zone(profile_time_zone));
  latest_allowed_date := private.latest_current_date_for_user(current_user_id);
  if target_date > latest_allowed_date then
    raise exception 'Future daily missions cannot be created';
  end if;

  select count(*) into active_color_count
  from public.color_palette
  where is_active;

  if active_color_count = 0 then
    raise exception 'No active colors are available';
  end if;

  select * into selected_color
  from public.color_palette
  where is_active
  order by slug
  offset (('x' || substr(md5(target_date::text), 1, 4))::bit(16)::integer % active_color_count)
  limit 1;

  insert into public.daily_missions (challenge_date, mission_type, color_id, title_ko, prompt_ko, source)
  values (
    target_date,
    'color',
    selected_color.id,
    format('오늘의 %s', selected_color.name_ko),
    selected_color.prompt_ko,
    'scheduled'
  )
  on conflict do nothing;

  return query
  select
    mission.id,
    mission.challenge_date,
    mission.mission_type,
    mission.title_ko,
    mission.prompt_ko,
    mission.published_at,
    mission.source,
    palette.id,
    palette.slug,
    palette.name_ko,
    palette.name_en,
    palette.hex,
    palette.tint_hex,
    palette.shade_hex,
    palette.on_color_hex
  from public.daily_missions as mission
  join public.color_palette as palette on palette.id = mission.color_id
  where mission.challenge_date = target_date;
end;
$$;

revoke all on function public.get_daily_mission(date) from public, anon;
grant execute on function public.get_daily_mission(date) to authenticated;

create or replace function public.get_mission_reveal_palette(p_challenge_date date default null)
returns table (
  wheel_position integer,
  color_id uuid,
  color_slug text,
  color_name_ko text,
  color_name_en text,
  color_hex text,
  color_on_color_hex text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  profile_time_zone text;
  target_date date;
  target_color_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select coalesce(profile.timezone, 'Asia/Seoul')
  into profile_time_zone
  from (select 1) as seed
  left join public.profiles as profile on profile.id = current_user_id;

  target_date := coalesce(p_challenge_date, private.current_date_in_time_zone(profile_time_zone));
  if target_date > private.latest_current_date_for_user(current_user_id) then
    raise exception 'Future mission reveal palettes cannot be created';
  end if;

  select mission.color_id
  into target_color_id
  from public.daily_missions as mission
  where mission.challenge_date = target_date;

  if target_color_id is null then
    perform public.get_daily_mission(target_date);
    select mission.color_id into target_color_id
    from public.daily_missions as mission
    where mission.challenge_date = target_date;
  end if;

  if target_color_id is null then
    raise exception 'Daily mission is missing';
  end if;

  if (select count(*) from public.color_palette where is_active) < 10 then
    raise exception 'At least ten active colors are required';
  end if;

  return query
  with target_color as (
    select palette.id, palette.slug, palette.name_ko, palette.name_en, palette.hex, palette.on_color_hex
    from public.color_palette as palette
    where palette.id = target_color_id
  ),
  decoys as (
    select palette.id, palette.slug, palette.name_ko, palette.name_en, palette.hex, palette.on_color_hex
    from public.color_palette as palette
    where palette.is_active
      and palette.id <> target_color_id
    order by md5(target_date::text || ':' || palette.slug)
    limit 9
  ),
  wheel_colors as (
    select 0 as wheel_position, * from target_color
    union all
    select row_number() over (order by decoys.slug)::integer as wheel_position, * from decoys
  )
  select
    wheel_colors.wheel_position,
    wheel_colors.id,
    wheel_colors.slug,
    wheel_colors.name_ko,
    wheel_colors.name_en,
    wheel_colors.hex,
    wheel_colors.on_color_hex
  from wheel_colors
  order by wheel_colors.wheel_position;
end;
$$;

revoke all on function public.get_mission_reveal_palette(date) from public, anon;
grant execute on function public.get_mission_reveal_palette(date) to authenticated;

create or replace function public.get_or_create_daily_entry(
  p_entry_id uuid,
  p_mission_id uuid,
  p_date_key date
)
returns table (
  id uuid,
  user_id uuid,
  mission_id uuid,
  date_key date,
  note text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_date_key > private.latest_current_date_for_user(current_user_id) then
    raise exception 'Future daily entries cannot be created';
  end if;

  insert into public.daily_entries (id, user_id, mission_id, date_key)
  values (p_entry_id, current_user_id, p_mission_id, p_date_key)
  on conflict on constraint daily_entries_user_date_key do nothing;

  if not exists (
    select 1
    from public.daily_entries as existing_entry
    where existing_entry.user_id = current_user_id
      and existing_entry.date_key = p_date_key
      and existing_entry.mission_id = p_mission_id
  ) then
    raise exception 'The entry mission does not match the daily mission';
  end if;

  return query
  select entry.id, entry.user_id, entry.mission_id, entry.date_key, entry.note, entry.created_at, entry.updated_at
  from public.daily_entries as entry
  where entry.user_id = current_user_id
    and entry.date_key = p_date_key;
end;
$$;

revoke all on function public.get_or_create_daily_entry(uuid, uuid, date) from public, anon;
grant execute on function public.get_or_create_daily_entry(uuid, uuid, date) to authenticated;

create or replace function public.ensure_room_daily_mission(p_room_id uuid, p_challenge_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  mission_id uuid;
  room_time_zone text;
begin
  select room.timezone
  into room_time_zone
  from public.rooms as room
  where room.id = p_room_id
    and room.status in ('draft', 'active');

  if not found then
    raise exception 'room_not_available' using errcode = 'P0001';
  end if;

  if p_challenge_date > private.current_date_in_time_zone(room_time_zone) then
    raise exception 'future_room_mission_not_allowed' using errcode = '22023';
  end if;

  select mission.id into mission_id
  from public.get_daily_mission(p_challenge_date) as mission;

  insert into public.room_daily_missions (room_id, challenge_date, mission_id)
  values (p_room_id, p_challenge_date, mission_id)
  on conflict (room_id, challenge_date) do nothing;

  select room_mission.mission_id into mission_id
  from public.room_daily_missions as room_mission
  where room_mission.room_id = p_room_id
    and room_mission.challenge_date = p_challenge_date;

  return mission_id;
end;
$$;

revoke all on function public.ensure_room_daily_mission(uuid, date) from public, anon, authenticated;

create or replace function public.validate_entry_room_share()
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
    join public.rooms as room on room.id = membership.room_id
    where membership.room_id = new.room_id
      and membership.user_id = new.shared_by
      and membership.status = 'active'
      and (membership.joined_at at time zone room.timezone)::date <= entry_date_key
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

revoke all on function public.validate_entry_room_share() from public, anon, authenticated;

create or replace function public.can_view_room_day(p_room_id uuid, p_date_key date)
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
        and (membership.joined_at at time zone room.timezone)::date <= p_date_key
    );
$$;

create or replace function public.can_view_shared_entry(p_entry_id uuid)
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
        and (membership.joined_at at time zone room.timezone)::date <= entry.date_key
    );
$$;

create or replace function public.can_view_shared_storage_path(p_storage_path text)
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
        and (membership.joined_at at time zone room.timezone)::date <= photo.date_key
    );
$$;

revoke all on function public.can_view_room_day(uuid, date) from public, anon;
revoke all on function public.can_view_shared_entry(uuid) from public, anon;
revoke all on function public.can_view_shared_storage_path(text) from public, anon;
grant execute on function public.can_view_room_day(uuid, date) to authenticated;
grant execute on function public.can_view_shared_entry(uuid) to authenticated;
grant execute on function public.can_view_shared_storage_path(text) to authenticated;

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

  select entry.* into target_entry
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
      and (membership.joined_at at time zone room.timezone)::date <= target_entry.date_key
      and target_entry.date_key <= private.current_date_in_time_zone(room.timezone)
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

revoke all on function public.share_entry_to_active_room(uuid) from public, anon;
grant execute on function public.share_entry_to_active_room(uuid) to authenticated;

create or replace function public.create_room_with_invite_v2(
  p_name text,
  p_emoji text,
  p_timezone text
)
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
  normalized_time_zone text := btrim(coalesce(p_timezone, ''));
  created_room_id uuid;
  generated_code text;
  invite_token text;
  expires_at timestamptz := now() + interval '24 hours';
  attempt integer;
  today_date date;
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
  if not private.is_valid_time_zone(normalized_time_zone) then
    raise exception 'invalid_time_zone' using errcode = '22023';
  end if;

  perform public.assert_active_room_capacity(current_user_id);

  for attempt in 1..50 loop
    generated_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
    exit when not exists (
      select 1 from public.room_invites as invite where invite.display_code = generated_code
    );
  end loop;

  if generated_code is null or exists (
    select 1 from public.room_invites as invite where invite.display_code = generated_code
  ) then
    raise exception 'invite_code_generation_failed' using errcode = 'P0001';
  end if;

  insert into public.rooms (name, emoji, created_by, timezone)
  values (normalized_name, normalized_emoji, current_user_id, normalized_time_zone)
  returning id into created_room_id;

  insert into public.room_members (room_id, user_id, role, status)
  values (created_room_id, current_user_id, 'owner', 'active');

  today_date := private.current_date_in_time_zone(normalized_time_zone);
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

  select entry.id into today_entry_id
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

revoke all on function public.create_room_with_invite_v2(text, text, text) from public, anon;
grant execute on function public.create_room_with_invite_v2(text, text, text) to authenticated;

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
  profile_time_zone text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  select coalesce(profile.timezone, 'Asia/Seoul') into profile_time_zone
  from (select 1) as seed
  left join public.profiles as profile on profile.id = current_user_id;
  return query select * from public.create_room_with_invite_v2(p_name, p_emoji, profile_time_zone);
end;
$$;

revoke all on function public.create_room_with_invite(text, text) from public, anon;
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
  today_date date;
  today_entry_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  perform public.assert_active_room_capacity(current_user_id);

  select invite.* into target_invite
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

  select room.* into target_room
  from public.rooms as room
  where room.id = target_invite.room_id
    and room.status in ('draft', 'active')
  for update;

  if not found then
    raise exception 'room_not_available' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.room_members as membership
    where membership.room_id = target_room.id
      and membership.user_id = current_user_id
      and membership.status = 'active'
  ) then
    raise exception 'room_already_joined' using errcode = 'P0001';
  end if;

  select count(*)::integer into active_member_count
  from public.room_members as membership
  where membership.room_id = target_room.id
    and membership.status = 'active';

  if active_member_count >= target_room.max_members then
    raise exception 'room_member_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.room_members (room_id, user_id, role, status)
  values (target_room.id, current_user_id, 'member', 'active');

  update public.rooms set status = 'active' where id = target_room.id;
  update public.room_invites set use_count = use_count + 1 where id = target_invite.id;
  insert into public.room_invite_uses (invite_id, user_id) values (target_invite.id, current_user_id);

  today_date := private.current_date_in_time_zone(target_room.timezone);
  perform public.ensure_room_daily_mission(target_room.id, today_date);

  select entry.id into today_entry_id
  from public.daily_entries as entry
  where entry.user_id = current_user_id
    and entry.date_key = today_date;

  if today_entry_id is not null then
    perform public.share_entry_to_active_room(today_entry_id);
  end if;

  return target_room.id;
end;
$$;

revoke all on function public.join_room_by_code(text) from public, anon;
grant execute on function public.join_room_by_code(text) to authenticated;

create or replace function public.get_my_rooms_v2()
returns table (
  room_id uuid,
  room_name text,
  room_emoji text,
  room_status text,
  room_timezone text,
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
    room.id, room.name, room.emoji, room.status, room.timezone, room.max_members,
    member.user_id, coalesce(profile.nickname, '친구'), member.role, member.joined_at,
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

revoke all on function public.get_my_rooms_v2() from public, anon;
grant execute on function public.get_my_rooms_v2() to authenticated;

create or replace function public.get_room_v2(p_room_id uuid)
returns table (
  room_id uuid,
  room_name text,
  room_emoji text,
  room_status text,
  room_timezone text,
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
    room.id, room.name, room.emoji, room.status, room.timezone, room.max_members,
    member.user_id, coalesce(profile.nickname, '친구'), member.role, member.joined_at,
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

revoke all on function public.get_room_v2(uuid) from public, anon;
grant execute on function public.get_room_v2(uuid) to authenticated;

create or replace function public.get_room_day_board(p_room_id uuid, p_date_key date)
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
  room_time_zone text;
  target_mission_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.joined_at, room.timezone
  into current_member_joined_at, room_time_zone
  from public.room_members as membership
  join public.rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active';

  if not found
    or p_date_key is null
    or p_date_key > private.current_date_in_time_zone(room_time_zone)
    or (current_member_joined_at at time zone room_time_zone)::date > p_date_key then
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
    and (member.joined_at at time zone room.timezone)::date <= p_date_key
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

revoke all on function public.get_room_day_board(uuid, date) from public, anon;
grant execute on function public.get_room_day_board(uuid, date) to authenticated;

create or replace function public.get_room_today_board(p_room_id uuid)
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
  room_time_zone text;
  target_date date;
begin
  select room.timezone into room_time_zone
  from public.rooms as room
  where room.id = p_room_id
    and room.status in ('draft', 'active');
  if not found then return; end if;
  target_date := private.current_date_in_time_zone(room_time_zone);
  return query select * from public.get_room_day_board(p_room_id, target_date);
end;
$$;

revoke all on function public.get_room_today_board(uuid) from public, anon;
grant execute on function public.get_room_today_board(uuid) to authenticated;

create or replace function public.get_room_history(p_room_id uuid)
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
  room_time_zone text;
  today_date date;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.joined_at, room.timezone
  into current_member_joined_at, room_time_zone
  from public.room_members as membership
  join public.rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active';

  if not found then return; end if;
  today_date := private.current_date_in_time_zone(room_time_zone);
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
    and room_mission.challenge_date >= (current_member_joined_at at time zone room_time_zone)::date
    and room_mission.challenge_date <= today_date
  group by room_mission.challenge_date, mission.id, mission.title_ko, mission.prompt_ko,
    palette.name_ko, palette.name_en, palette.hex
  order by room_mission.challenge_date desc;
end;
$$;

revoke all on function public.get_room_history(uuid) from public, anon;
grant execute on function public.get_room_history(uuid) to authenticated;

create or replace function public.get_diary_month_v2(p_month_start date)
returns table (
  entry_id uuid,
  mission_id uuid,
  date_key date,
  note text,
  color_id uuid,
  color_slug text,
  color_name_ko text,
  color_name_en text,
  color_hex text,
  color_tint_hex text,
  color_shade_hex text,
  color_on_color_hex text,
  shared_rooms jsonb,
  photo_id uuid,
  storage_path text,
  photo_position smallint,
  photo_caption text,
  captured_at timestamptz,
  width integer,
  height integer,
  byte_size bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    entry.id,
    entry.mission_id,
    entry.date_key,
    entry.note,
    palette.id,
    palette.slug,
    palette.name_ko,
    palette.name_en,
    palette.hex,
    palette.tint_hex,
    palette.shade_hex,
    palette.on_color_hex,
    coalesce(shared_room_list.items, '[]'::jsonb),
    photo.id,
    photo.storage_path,
    photo.position,
    photo.caption,
    photo.captured_at,
    photo.width,
    photo.height,
    photo.byte_size
  from public.daily_entries as entry
  join public.daily_missions as mission
    on mission.id = entry.mission_id
    and mission.challenge_date = entry.date_key
  join public.color_palette as palette on palette.id = mission.color_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', room.id,
        'name', room.name,
        'emoji', room.emoji,
        'can_open',
          share.revoked_at is null
          and room.status in ('draft', 'active')
          and exists (
            select 1
            from public.room_members as membership
            where membership.room_id = room.id
              and membership.user_id = (select auth.uid())
              and membership.status = 'active'
              and (membership.joined_at at time zone room.timezone)::date <= entry.date_key
          )
      ) order by share.shared_at, room.id
    ) as items
    from public.entry_room_shares as share
    join public.rooms as room on room.id = share.room_id
    where share.entry_id = entry.id
      and share.shared_by = (select auth.uid())
  ) as shared_room_list on true
  left join public.entry_photos as photo on photo.entry_id = entry.id
  where entry.user_id = (select auth.uid())
    and (select auth.uid()) is not null
    and entry.date_key >= p_month_start
    and entry.date_key < (p_month_start + interval '1 month')::date
  order by entry.date_key desc, photo.position asc nulls last;
$$;

revoke all on function public.get_diary_month_v2(date) from public, anon;
grant execute on function public.get_diary_month_v2(date) to authenticated;

drop policy if exists "room_photo_reactions_select_active_members" on public.room_photo_reactions;
create policy "room_photo_reactions_select_active_members"
on public.room_photo_reactions
for select
to authenticated
using (
  exists (
    select 1
    from public.entry_photos as photo
    join public.daily_entries as entry on entry.id = photo.entry_id
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
      and (viewer_membership.joined_at at time zone room.timezone)::date <= entry.date_key
  )
);

create or replace function public.get_room_photo_reactions(p_room_id uuid, p_photo_id uuid)
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

  select true into can_view
  from public.entry_photos as photo
  join public.daily_entries as entry on entry.id = photo.entry_id
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
  left join public.room_photo_reactions as reaction
    on reaction.room_id = p_room_id
    and reaction.photo_id = p_photo_id
    and reaction.emoji = choices.emoji
  group by choices.emoji
  order by choices.emoji;
end;
$$;

revoke all on function public.get_room_photo_reactions(uuid, uuid) from public, anon;
grant execute on function public.get_room_photo_reactions(uuid, uuid) to authenticated;

create or replace function public.toggle_room_photo_reaction(p_room_id uuid, p_photo_id uuid, p_emoji text)
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

  select photo.owner_id into photo_owner_id
  from public.entry_photos as photo
  join public.daily_entries as entry on entry.id = photo.entry_id
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
    and (viewer_membership.joined_at at time zone room.timezone)::date <= entry.date_key;

  if not found or photo_owner_id = current_user_id then
    raise exception 'room_photo_reaction_not_available' using errcode = '42501';
  end if;

  select reaction.emoji into existing_emoji
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

revoke all on function public.toggle_room_photo_reaction(uuid, uuid, text) from public, anon;
grant execute on function public.toggle_room_photo_reaction(uuid, uuid, text) to authenticated;
