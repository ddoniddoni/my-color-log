begin;

do $global_timezones_catalog$
declare
  room_timezone_default text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rooms'
      and column_name = 'timezone'
      and is_nullable = 'NO'
  ) then
    raise exception 'global_timezones_contract_room_timezone_missing';
  end if;

  select column_default into room_timezone_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'rooms'
    and column_name = 'timezone';

  if room_timezone_default is null or room_timezone_default not like '%Asia/Seoul%' then
    raise exception 'global_timezones_contract_room_timezone_default';
  end if;

  if not has_function_privilege('authenticated', 'public.get_my_rooms_v2()', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_room_v2(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.create_room_with_invite_v2(text,text,text)', 'EXECUTE') then
    raise exception 'global_timezones_contract_v2_rpc_grants';
  end if;

  if has_function_privilege('anon', 'public.get_my_rooms_v2()', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_room_v2(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.create_room_with_invite_v2(text,text,text)', 'EXECUTE') then
    raise exception 'global_timezones_contract_v2_rpc_anon_grant';
  end if;
end;
$global_timezones_catalog$;

do $global_timezones_behavior$
begin
  if private.current_date_in_time_zone('Asia/Seoul', timestamptz '2026-07-22 02:30:00+00') <> date '2026-07-22' then
    raise exception 'global_timezones_contract_seoul_date';
  end if;

  if private.current_date_in_time_zone('America/Los_Angeles', timestamptz '2026-07-22 02:30:00+00') <> date '2026-07-21' then
    raise exception 'global_timezones_contract_los_angeles_date';
  end if;

  if private.current_date_in_time_zone('America/New_York', timestamptz '2026-03-08 06:59:59+00') <> date '2026-03-08'
    or private.current_date_in_time_zone('America/New_York', timestamptz '2026-11-01 05:30:00+00') <> date '2026-11-01' then
    raise exception 'global_timezones_contract_dst_date';
  end if;

  begin
    perform private.current_date_in_time_zone('Not/A_Zone', now());
    raise exception 'global_timezones_contract_invalid_zone_accepted';
  exception
    when sqlstate '22023' then null;
  end;
end;
$global_timezones_behavior$;

create temporary table global_timezones_context (actor_id uuid not null) on commit drop;
insert into global_timezones_context
select profile.id
from public.profiles as profile
order by profile.created_at, profile.id
limit 1;

do $global_timezones_fixture$
begin
  if not exists (select 1 from global_timezones_context) then
    raise exception 'global_timezones_contract_requires_profile';
  end if;
end;
$global_timezones_fixture$;

grant select on global_timezones_context to authenticated;

do $global_timezones_jwt$
declare
  actor_user_id uuid := (select actor_id from global_timezones_context);
begin
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_user_id, 'role', 'authenticated')::text,
    true
  );
end;
$global_timezones_jwt$;

set local role authenticated;

do $global_timezones_authenticated_rpc$
begin
  perform public.get_daily_mission(null);
  perform public.get_my_rooms_v2();
end;
$global_timezones_authenticated_rpc$;

reset role;

rollback;
