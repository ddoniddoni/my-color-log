create function public.get_active_room_history()
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
  target_room_id uuid;
  current_member_joined_at timestamptz;
  today_date date := (now() at time zone 'Asia/Seoul')::date;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.room_id, membership.joined_at
  into target_room_id, current_member_joined_at
  from public.room_members as membership
  join public.rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.user_id = current_user_id
    and membership.status = 'active'
  limit 1;

  if not found then
    return;
  end if;

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
  where room_mission.room_id = target_room_id
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

revoke all on function public.get_active_room_history() from public;
revoke all on function public.get_active_room_history() from anon;
grant execute on function public.get_active_room_history() to authenticated;

create function public.get_active_room_day_board(p_date_key date)
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
  target_room_id uuid;
  current_member_joined_at timestamptz;
  today_date date := (now() at time zone 'Asia/Seoul')::date;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_date_key is null or p_date_key > today_date then
    return;
  end if;

  select membership.room_id, membership.joined_at
  into target_room_id, current_member_joined_at
  from public.room_members as membership
  join public.rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.user_id = current_user_id
    and membership.status = 'active'
  limit 1;

  if not found
    or (current_member_joined_at at time zone 'Asia/Seoul')::date > p_date_key then
    return;
  end if;

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
  where room.id = target_room_id
    and room.status in ('draft', 'active')
  order by member.joined_at, photo.position nulls last;
end;
$$;

revoke all on function public.get_active_room_day_board(date) from public;
revoke all on function public.get_active_room_day_board(date) from anon;
grant execute on function public.get_active_room_day_board(date) to authenticated;
