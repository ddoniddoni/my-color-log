-- FR-MISSION-001/002/003/004 and FR-ROOM-004.
-- Disposable local DB only; fixtures and generated missions always roll back.
begin;

do $$
begin
  if (select array_agg(slug order by slug) from public.cl_color_palette where is_active)
    is distinct from array['clear-blue','deep-wine','leaf-green','lemon-yellow','mint-green',
      'rose-pink','royal-purple','sky-blue','tangerine-orange','tomato-red']::text[] then
    raise exception 'palette_active_pool_mismatch';
  end if;
  if (select count(*) from public.cl_color_palette where slug in ('coral-pink','lime-green') and not is_active) <> 2 then
    raise exception 'palette_historical_colors_not_preserved';
  end if;
  if not exists (select 1 from public.cl_color_palette where slug='royal-purple' and hex='#7B2FD0' and on_color_hex='#FFFFFF')
    or not exists (select 1 from public.cl_color_palette where slug='deep-wine' and hex='#8B1E4B' and on_color_hex='#FFFFFF') then
    raise exception 'palette_new_color_tokens_mismatch';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.cl_color_palette'::regclass)
    or has_table_privilege('authenticated','public.cl_color_palette','UPDATE')
    or has_function_privilege('anon','public.cl_get_mission_reveal_palette(date)','EXECUTE')
    or not has_function_privilege('authenticated','public.cl_get_mission_reveal_palette(date)','EXECUTE') then
    raise exception 'palette_permissions_changed';
  end if;
end;
$$;

create temporary table palette_context (
  owner_id uuid default gen_random_uuid(), friend_id uuid default gen_random_uuid(),
  room_id uuid default gen_random_uuid()
) on commit drop;
insert into palette_context default values;
insert into auth.users(id) select owner_id from palette_context union all select friend_id from palette_context;
insert into public.cl_profiles(id,nickname,timezone)
select owner_id,'팔레트주인','Asia/Seoul' from palette_context
union all select friend_id,'팔레트친구','America/Los_Angeles' from palette_context;
insert into public.cl_rooms(id,name,created_by,status,timezone)
select room_id,'팔레트검증',owner_id,'active','Asia/Seoul' from palette_context;
insert into public.cl_room_members(room_id,user_id,role,joined_at)
select room_id,owner_id,'owner','2000-01-01'::timestamptz from palette_context
union all select room_id,friend_id,'member','2000-01-01'::timestamptz from palette_context;

-- Exercise every current AND historical color as an already-decided mission.
-- Pick unused dates so this test also works on a disposable DB with fixtures.
create temporary table palette_cases (date_key date primary key, color_id uuid, slug text, mission_id uuid) on commit drop;
do $$
declare
  color record;
  day date := date '2001-01-01';
  mission uuid;
begin
  for color in select id,slug,name_ko,prompt_ko from public.cl_color_palette order by slug loop
    while exists(select 1 from public.cl_daily_missions where challenge_date=day) loop day := day+1; end loop;
    insert into public.cl_daily_missions(challenge_date,mission_type,color_id,title_ko,prompt_ko,source)
    values(day,'color',color.id,'보존할 '||color.name_ko,color.prompt_ko,'manual') returning id into mission;
    insert into palette_cases values(day,color.id,color.slug,mission);
    day := day+1;
  end loop;
end;
$$;
grant select on palette_context,palette_cases to authenticated;
create temporary table palette_results(date_key date primary key,color_slug text,mission_id uuid) on commit drop;
grant select,insert on palette_results to authenticated;

select set_config('request.jwt.claim.sub',(select owner_id::text from palette_context),true);
set local role authenticated;
do $$
declare
  fixture record;
  mission record;
  wheel jsonb;
  repeated jsonb;
  room_mission uuid;
  count_colors integer;
  count_distinct integer;
  positions integer[];
begin
  for fixture in select * from palette_cases order by date_key loop
    select * into mission from public.cl_get_daily_mission(fixture.date_key);
    if mission.id <> fixture.mission_id or mission.color_id <> fixture.color_id or mission.color_slug <> fixture.slug then
      raise exception 'palette_existing_mission_changed';
    end if;
    select jsonb_agg(to_jsonb(p) order by wheel_position),count(*),count(distinct color_id),array_agg(wheel_position order by wheel_position)
    into wheel,count_colors,count_distinct,positions from public.cl_get_mission_reveal_palette(fixture.date_key) p;
    if count_colors <> 10 or count_distinct <> 10 or positions <> array[0,1,2,3,4,5,6,7,8,9]
      or not wheel @> jsonb_build_array(jsonb_build_object('color_id',fixture.color_id)) then
      raise exception 'palette_wheel_contract_failed_for_%',fixture.slug;
    end if;
    select jsonb_agg(to_jsonb(p) order by wheel_position) into repeated from public.cl_get_mission_reveal_palette(fixture.date_key) p;
    if wheel <> repeated then raise exception 'palette_repeated_reveal_changed'; end if;
    select distinct mission_id into room_mission from public.cl_get_room_day_board((select room_id from palette_context),fixture.date_key);
    if room_mission is distinct from fixture.mission_id then raise exception 'palette_room_and_solo_disagree'; end if;
  end loop;

  -- The date-based server schedule must choose both new colors naturally.
  for fixture in select d::date as date_key from generate_series(date '2002-01-01',date '2002-12-31',interval '1 day') d loop
    select * into mission from public.cl_get_daily_mission(fixture.date_key);
    insert into palette_results values(fixture.date_key,mission.color_slug,mission.id);
  end loop;
  if not exists(select 1 from palette_results where color_slug='royal-purple')
    or not exists(select 1 from palette_results where color_slug='deep-wine') then
    raise exception 'palette_new_colors_never_selected';
  end if;
  if exists(select 1 from palette_results where color_slug in ('coral-pink','lime-green')) then
    raise exception 'palette_inactive_color_selected_for_new_mission';
  end if;
end;
$$;

-- A second account in another time zone gets the same mission for the same key.
select set_config('request.jwt.claim.sub',(select friend_id::text from palette_context),true);
do $$
declare fixture record; mission record; room_mission uuid;
begin
  for fixture in select * from palette_results loop
    select * into mission from public.cl_get_daily_mission(fixture.date_key);
    if mission.id <> fixture.mission_id or mission.color_slug <> fixture.color_slug then
      raise exception 'palette_cross_account_mission_changed';
    end if;
  end loop;
  for fixture in select * from palette_cases loop
    select distinct mission_id into room_mission from public.cl_get_room_day_board((select room_id from palette_context),fixture.date_key);
    if room_mission is distinct from fixture.mission_id then raise exception 'palette_room_members_disagree'; end if;
  end loop;
end;
$$;

select set_config('request.jwt.claim.sub','',true);
do $$
begin
  begin
    perform public.cl_get_mission_reveal_palette(date '2001-01-01');
    raise exception 'palette_unauthenticated_call_allowed';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
