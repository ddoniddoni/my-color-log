-- FR-MISSION-004 / FR-ROOM-009: table and Storage RLS must agree with the
-- room board about the viewer's joining day in the room's time zone.
-- Run as postgres against a disposable/local database. All fixtures roll back.
begin;

create temporary table visibility_cases (
  label text primary key,
  timezone text not null,
  joined_at timestamptz not null,
  date_key date not null,
  expected boolean not null,
  owner_id uuid not null default gen_random_uuid(),
  viewer_id uuid not null default gen_random_uuid(),
  outsider_id uuid not null default gen_random_uuid(),
  room_id uuid not null default gen_random_uuid(),
  entry_id uuid not null default gen_random_uuid(),
  photo_id uuid not null default gen_random_uuid(),
  mission_id uuid,
  storage_path text
) on commit drop;

insert into visibility_cases (label, timezone, joined_at, date_key, expected) values
  ('west_join_day', 'America/Los_Angeles', '2026-07-22 02:30:00+00', '2026-07-21', true),
  ('west_before_join', 'America/Los_Angeles', '2026-07-22 02:30:00+00', '2026-07-20', false),
  ('east_join_day', 'Pacific/Kiritimati', '2026-07-21 12:00:00+00', '2026-07-22', true),
  ('east_before_join', 'Pacific/Kiritimati', '2026-07-21 12:00:00+00', '2026-07-21', false),
  ('seoul_join_day', 'Asia/Seoul', '2026-07-21 15:00:00+00', '2026-07-22', true),
  ('seoul_before_join', 'Asia/Seoul', '2026-07-21 15:00:00+00', '2026-07-21', false),
  ('dst_spring_before', 'America/New_York', '2026-03-08 06:59:59+00', '2026-03-08', true),
  ('dst_spring_after', 'America/New_York', '2026-03-08 07:00:00+00', '2026-03-08', true),
  ('dst_fall_before', 'America/New_York', '2025-11-02 05:59:59+00', '2025-11-02', true),
  ('dst_fall_after', 'America/New_York', '2025-11-02 06:00:00+00', '2025-11-02', true);

-- A mission may already exist for a later date in another zone. That must not
-- make tomorrow's room records readable before this room reaches that date.
insert into visibility_cases (label, timezone, joined_at, date_key, expected)
select 'future_' || zone, zone, timestamptz '2020-01-02 00:00:00+00',
  (now() at time zone zone)::date + 1, false
from (values ('America/Los_Angeles'), ('Pacific/Kiritimati')) as zones(zone);

insert into auth.users (id)
select owner_id from visibility_cases
union all select viewer_id from visibility_cases
union all select outsider_id from visibility_cases;

-- Deliberately different from the room zone: access must not depend on the
-- viewer's current profile zone, nor on the SQL session's zone.
insert into public.cl_profiles (id, nickname, timezone)
select owner_id, '사진주인', 'Pacific/Honolulu' from visibility_cases
union all select viewer_id, '방멤버', 'Pacific/Honolulu' from visibility_cases
union all select outsider_id, '외부유저', 'Pacific/Honolulu' from visibility_cases;

insert into public.cl_daily_missions (challenge_date, mission_type, color_id, title_ko, prompt_ko, source)
select distinct date_key, 'color', (select id from public.cl_color_palette order by slug limit 1),
  '가시성 테스트', '트랜잭션 종료 시 제거', 'manual'
from visibility_cases
on conflict (challenge_date) do nothing;

update visibility_cases as fixture
set mission_id = mission.id,
  storage_path = fixture.owner_id::text || '/' || fixture.date_key::text || '/' || fixture.photo_id::text || '.jpg'
from public.cl_daily_missions as mission
where mission.challenge_date = fixture.date_key;

insert into public.cl_rooms (id, name, created_by, status, timezone)
select room_id, '가시성 테스트방', owner_id, 'active', timezone from visibility_cases;
insert into public.cl_room_members (room_id, user_id, role, joined_at)
select room_id, owner_id, 'owner', timestamptz '2020-01-01 00:00:00+00' from visibility_cases
union all select room_id, viewer_id, 'member', joined_at from visibility_cases;
insert into public.cl_room_daily_missions (room_id, challenge_date, mission_id)
select room_id, date_key, mission_id from visibility_cases;
insert into public.cl_daily_entries (id, user_id, mission_id, date_key)
select entry_id, owner_id, mission_id, date_key from visibility_cases;
insert into public.cl_entry_photos (id, entry_id, owner_id, date_key, storage_path, position, captured_at, width, height, byte_size)
select photo_id, entry_id, owner_id, date_key, storage_path, 1, joined_at, 100, 100, 1 from visibility_cases;
insert into public.cl_entry_room_shares (entry_id, room_id, shared_by)
select entry_id, room_id, owner_id from visibility_cases;
insert into storage.objects (bucket_id, name)
select 'cl-entry-photos', storage_path from visibility_cases;

create temporary table visibility_results (
  label text not null, surface text not null, expected boolean not null, actual boolean not null
) on commit drop;
grant select on visibility_cases to authenticated;
grant select, insert on visibility_results to authenticated;

create function pg_temp.check_visibility(p_phase text, p_actor text, p_shared boolean, p_room boolean)
returns void language plpgsql set search_path = '' as $$
declare
  fixture record;
  actor_id uuid;
  allow_shared boolean;
  allow_room boolean;
begin
  -- SECURITY INVOKER is intentional: all reads below must evaluate real RLS.
  if current_user <> 'authenticated' then
    raise exception 'visibility_test_requires_authenticated_role';
  end if;
  for fixture in select * from pg_temp.visibility_cases order by label loop
    actor_id := case p_actor when 'owner' then fixture.owner_id
      when 'outsider' then fixture.outsider_id else fixture.viewer_id end;
    perform set_config('request.jwt.claim.sub', actor_id::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', actor_id, 'role', 'authenticated')::text, true);
    allow_shared := p_actor = 'owner' or (fixture.expected and p_shared);
    allow_room := fixture.expected and p_room;
    insert into pg_temp.visibility_results values
      (p_phase || ':' || fixture.label, 'entry', allow_shared,
        exists (select 1 from public.cl_daily_entries where id = fixture.entry_id)),
      (p_phase || ':' || fixture.label, 'photo', allow_shared,
        exists (select 1 from public.cl_entry_photos where id = fixture.photo_id)),
      (p_phase || ':' || fixture.label, 'share', allow_shared,
        exists (select 1 from public.cl_entry_room_shares where entry_id = fixture.entry_id and room_id = fixture.room_id)),
      (p_phase || ':' || fixture.label, 'storage', allow_shared,
        exists (select 1 from storage.objects where bucket_id = 'cl-entry-photos' and name = fixture.storage_path));
    if p_actor <> 'owner' then
      insert into pg_temp.visibility_results values
        (p_phase || ':' || fixture.label, 'room_mission', allow_room,
          exists (select 1 from public.cl_room_daily_missions where room_id = fixture.room_id and challenge_date = fixture.date_key)),
        (p_phase || ':' || fixture.label, 'board_photo', allow_shared,
          exists (select 1 from public.cl_get_room_day_board(fixture.room_id, fixture.date_key) where photo_id = fixture.photo_id));
    end if;
  end loop;
end;
$$;
grant execute on function pg_temp.check_visibility(text, text, boolean, boolean) to authenticated;

set local role authenticated;
do $visibility_no_identity$
declare
  fixture record;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  for fixture in select * from visibility_cases loop
    if cl_private.can_view_room_day(fixture.room_id, fixture.date_key)
      or cl_private.can_view_shared_entry(fixture.entry_id)
      or cl_private.can_view_shared_storage_path(fixture.storage_path) then
      raise exception 'visibility_helper_without_identity';
    end if;
  end loop;
end;
$visibility_no_identity$;
reset role;

set local role authenticated;
set local time zone 'UTC';
select pg_temp.check_visibility('active_utc', 'viewer', true, true);
set local time zone 'Pacific/Kiritimati';
select pg_temp.check_visibility('active_east_session', 'viewer', true, true);
select pg_temp.check_visibility('outsider', 'outsider', false, false);
reset role;

update public.cl_entry_room_shares set revoked_at = now()
where entry_id in (select entry_id from visibility_cases);
set local role authenticated;
select pg_temp.check_visibility('revoked', 'viewer', false, true);
select pg_temp.check_visibility('owner_after_revoke', 'owner', false, false);
reset role;

update public.cl_entry_room_shares set revoked_at = null
where entry_id in (select entry_id from visibility_cases);
update public.cl_room_members set status = 'left', left_at = now()
where user_id in (select viewer_id from visibility_cases);
set local role authenticated;
select pg_temp.check_visibility('left', 'viewer', false, false);
reset role;

update public.cl_room_members set status = 'removed'
where user_id in (select viewer_id from visibility_cases);
set local role authenticated;
select pg_temp.check_visibility('removed', 'viewer', false, false);
reset role;

-- A returning viewer cannot regain access to days before the new join date.
update public.cl_room_members set status = 'active', left_at = null,
  joined_at = timestamptz '2026-08-01 12:00:00+00'
where user_id in (select viewer_id from visibility_cases);
set local role authenticated;
select pg_temp.check_visibility('rejoined', 'viewer', false, false);
reset role;

update public.cl_room_members as member set joined_at = fixture.joined_at
from visibility_cases as fixture where member.user_id = fixture.viewer_id;
delete from public.cl_entry_room_shares where entry_id in (select entry_id from visibility_cases);
set local role authenticated;
select pg_temp.check_visibility('unshared', 'viewer', false, true);
reset role;
insert into public.cl_entry_room_shares (entry_id, room_id, shared_by)
select entry_id, room_id, owner_id from visibility_cases;

update public.cl_rooms set status = 'ended', ended_at = now()
where id in (select room_id from visibility_cases);
set local role authenticated;
select pg_temp.check_visibility('ended', 'viewer', false, false);
select pg_temp.check_visibility('owner_after_end', 'owner', false, false);
reset role;

do $visibility_assertions$
declare
  failures text;
begin
  select string_agg(label || '/' || surface || ': expected=' || expected || ', actual=' || actual, E'\n' order by label, surface)
  into failures from visibility_results where actual <> expected;
  if failures is not null then
    raise exception E'room_visibility_contract_failed\n%', failures;
  end if;
end;
$visibility_assertions$;

do $visibility_helper_catalog$
declare
  signature text;
begin
  foreach signature in array array[
    'can_view_room_day(uuid,date)',
    'can_view_shared_entry(uuid)',
    'can_view_shared_storage_path(text)'
  ] loop
    if to_regprocedure('public.' || signature) is not null then
      raise exception 'visibility_helper_exposed_in_public:%', signature;
    end if;
    if not has_function_privilege('authenticated', 'cl_private.' || signature, 'EXECUTE')
      or has_function_privilege('anon', 'cl_private.' || signature, 'EXECUTE') then
      raise exception 'visibility_helper_incorrect_grants:%', signature;
    end if;
  end loop;
end;
$visibility_helper_catalog$;

select count(*) as visibility_assertions_passed from visibility_results;

rollback;
