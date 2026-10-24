-- Disposable local DB only. Fixtures are rolled back; RPC calls use authenticated.
begin;
create function pg_temp.assert_report(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'report_contract:%', label; end if; end;
$$;
create function pg_temp.report_login(actor uuid, anonymous boolean default false, session_value uuid default null)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(actor::text, ''), true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated',
    'is_anonymous', anonymous, 'session_id', coalesce(session_value, actor))::text, true);
end;
$$;
create function pg_temp.expect_report_error(room uuid, kind text, target uuid, reason text, details text, expected text)
returns void language plpgsql as $$
begin
  perform public.cl_submit_room_report(room, kind, target, reason, details);
  raise exception 'missing_expected_error:%', expected;
exception when others then if sqlerrm <> expected then raise; end if;
end;
$$;
create function pg_temp.expect_report_permission_denied(statement text)
returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'missing_permission_denial';
exception when insufficient_privilege then null;
end;
$$;

do $test$
declare
  owner_id uuid := gen_random_uuid();
  reporter uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  room uuid;
  other_room uuid;
  code text;
  today_date date := (now() at time zone 'Pacific/Kiritimati')::date;
  entry_id_value uuid := gen_random_uuid();
  photo uuid := gen_random_uuid();
  mission uuid;
  receipt jsonb;
  repeated jsonb;
  user_value uuid;
  index_value integer;
  path text;
begin
  insert into auth.users(id) values(owner_id), (reporter), (outsider);
  insert into auth.sessions(id,user_id,created_at,updated_at) values(owner_id,owner_id,now(),now()), (reporter,reporter,now(),now()), (outsider,outsider,now(),now());
  insert into public.cl_profiles(id,nickname,timezone) values(owner_id,'신고대상','Pacific/Kiritimati'),(reporter,'신고검증','Pacific/Honolulu'),(outsider,'외부검증','Pacific/Honolulu');
  perform pg_temp.report_login(owner_id);
  set local role authenticated;
  select room_id, invite_code into room, code from public.cl_create_room_with_invite_v2('신고 검증방',null,'Pacific/Kiritimati');
  perform pg_temp.report_login(reporter);
  perform public.cl_join_room_by_code(code);
  perform pg_temp.report_login(outsider);
  select room_id into other_room from public.cl_create_room_with_invite_v2('다른 검증방',null,'Asia/Seoul');
  reset role;
  perform pg_temp.report_login(owner_id);
  mission := public.cl_ensure_room_daily_mission(room,today_date);
  path := owner_id::text || '/' || today_date::text || '/' || photo::text || '.jpg';
  insert into public.cl_daily_entries(id,user_id,mission_id,date_key) values(entry_id_value,owner_id,mission,today_date);
  insert into public.cl_entry_photos(id,entry_id,owner_id,date_key,storage_path,position,captured_at,width,height,byte_size)
    values(photo,entry_id_value,owner_id,today_date,path,1,now(),100,100,1);
  insert into public.cl_entry_room_shares(entry_id,room_id,shared_by) values(entry_id_value,room,owner_id);

  -- Authenticated valid photo intake, same target retries, and immutable first reason.
  perform pg_temp.report_login(reporter);
  set local role authenticated;
  receipt := public.cl_submit_room_report(room,'photo',photo,'privacy','  노출된 정보  ');
  repeated := public.cl_submit_room_report(room,'photo',photo,'spam',null);
  perform pg_temp.assert_report(receipt->>'report_id' = repeated->>'report_id' and (receipt->>'already_submitted')::boolean = false
    and (repeated->>'already_submitted')::boolean = true, 'same photo yields one receipt');
  -- Clients cannot read anyone's report, spoof direct inserts, change status, or delete.
  perform pg_temp.expect_report_permission_denied('select * from public.cl_room_reports');
  perform pg_temp.expect_report_permission_denied('insert into public.cl_room_reports(id) values(gen_random_uuid())');
  perform pg_temp.expect_report_permission_denied('update public.cl_room_reports set status = ''resolved''');
  perform pg_temp.expect_report_permission_denied('delete from public.cl_room_reports');
  reset role;
  perform pg_temp.assert_report((select count(*) = 1 and bool_and(reporter_id = reporter and reported_user_id = owner_id and reason = 'privacy'
    and details = '노출된 정보' and status = 'pending') from public.cl_room_reports where id = (receipt->>'report_id')::uuid), 'server binds identity and retains original reason');
  perform pg_temp.assert_report((select relrowsecurity from pg_class where oid='public.cl_room_reports'::regclass), 'RLS enabled');
  perform pg_temp.assert_report((select count(*) = 1 from public.cl_entry_photos where id = photo), 'report does not delete photo');
  perform pg_temp.assert_report((select revoked_at is null from public.cl_entry_room_shares where entry_id = entry_id_value and room_id = room), 'report does not change sharing');

  perform pg_temp.report_login(reporter);
  set local role authenticated;
  perform pg_temp.assert_report((public.cl_submit_room_report(room,'member',owner_id,'other','멤버 문제')->>'already_submitted')::boolean = false, 'member intake');
  perform pg_temp.expect_report_error(room,'member',reporter,'spam',null,'room_report_not_available');
  perform pg_temp.expect_report_error(other_room,'photo',photo,'spam',null,'room_report_not_available');
  perform pg_temp.expect_report_error(room,'member',outsider,'spam',null,'room_report_not_available');
  perform pg_temp.expect_report_error(room,'photo',gen_random_uuid(),'spam',null,'room_report_not_available');
  perform pg_temp.expect_report_error(room,'photo',photo,null,null,'room_report_invalid_input');
  perform pg_temp.expect_report_error(room,'photo',photo,'unknown',null,'room_report_invalid_input');
  perform pg_temp.expect_report_error(room,'photo',photo,'other',E' \n\t','room_report_invalid_input');
  perform pg_temp.expect_report_error(room,'photo',photo,'spam',repeat('가',501),'room_report_invalid_input');
  perform pg_temp.expect_report_error(room,'room',photo,'spam',null,'room_report_invalid_input');
  perform pg_temp.expect_report_error(null,'photo',photo,'spam',null,'room_report_invalid_input');
  perform pg_temp.report_login(owner_id);
  perform pg_temp.expect_report_error(room,'photo',photo,'spam',null,'room_report_not_available');
  perform pg_temp.expect_report_permission_denied('select * from public.cl_room_reports');
  perform pg_temp.report_login(outsider);
  perform pg_temp.expect_report_error(room,'photo',photo,'spam',null,'room_report_not_available');
  perform pg_temp.report_login(reporter,true);
  perform pg_temp.expect_report_error(room,'photo',photo,'spam',null,'authentication_required');
  perform pg_temp.report_login(null);
  perform pg_temp.expect_report_error(room,'photo',photo,'spam',null,'authentication_required');
  perform pg_temp.report_login(reporter,false,outsider);
  perform pg_temp.expect_report_error(room,'photo',photo,'spam',null,'authentication_required');
  reset role;
  set local role anon;
  perform pg_temp.expect_report_permission_denied(format('select public.cl_submit_room_report(%L,''photo'',%L,''spam'')',room,photo));
  perform pg_temp.expect_report_permission_denied('select * from public.cl_room_reports');
  reset role;

  -- Stale screens: a previous receipt does not bypass current access checks.
  update public.cl_room_members set status = 'left' where room_id = room and user_id = reporter;
  perform pg_temp.report_login(reporter);
  set local role authenticated;
  perform pg_temp.expect_report_error(room,'photo',photo,'spam',null,'room_report_not_available');
  reset role;
  update public.cl_room_members set status = 'active', joined_at = now() + interval '2 days' where room_id = room and user_id = reporter;
  set local role authenticated;
  perform pg_temp.expect_report_error(room,'photo',photo,'spam',null,'room_report_not_available');
  reset role;
  update public.cl_room_members set joined_at = now() where room_id = room and user_id = reporter;
  update public.cl_entry_room_shares set revoked_at = now() where entry_id = entry_id_value and room_id = room;
  set local role authenticated;
  perform pg_temp.expect_report_error(room,'photo',photo,'spam',null,'room_report_not_available');
  reset role;
  update public.cl_entry_room_shares set revoked_at = null where entry_id = entry_id_value and room_id = room;
  update public.cl_room_members set status = 'removed' where room_id = room and user_id = owner_id;
  set local role authenticated;
  perform pg_temp.expect_report_error(room,'photo',photo,'spam',null,'room_report_not_available');
  perform pg_temp.expect_report_error(room,'member',owner_id,'spam',null,'room_report_not_available');
  reset role;
  update public.cl_room_members set status = 'active' where room_id = room and user_id = owner_id;
  update public.cl_rooms set status = 'ended' where id = room;
  set local role authenticated;
  perform pg_temp.expect_report_error(room,'member',owner_id,'spam',null,'room_report_not_available');
  reset role;
  update public.cl_rooms set status = 'active' where id = room;
  update auth.sessions set not_after = now() - interval '1 minute' where id = reporter;
  set local role authenticated;
  perform pg_temp.expect_report_error(room,'photo',photo,'spam',null,'authentication_required');
  reset role;
  update auth.sessions set not_after = null where id = reporter;

  -- Seed only the quota counter as administrator; the actual rejection is a user RPC.
  for index_value in 1..18 loop
    user_value := gen_random_uuid();
    insert into auth.users(id) values(user_value);
    insert into public.cl_profiles(id,nickname) values(user_value,'한도검증');
    insert into public.cl_room_reports(room_id,reporter_id,reported_user_id,target_type,reason)
      values(room,reporter,user_value,'member','spam');
  end loop;
  insert into public.cl_room_members(room_id,user_id,role,status) values(room,outsider,'member','active');
  set local role authenticated;
  perform pg_temp.expect_report_error(room,'member',outsider,'spam',null,'room_report_rate_limited');
  perform pg_temp.assert_report((public.cl_submit_room_report(room,'photo',photo,'spam',null)->>'already_submitted')::boolean, 'retry allowed after rate limit');
  reset role;
  update public.cl_room_reports set created_at = now() - interval '25 hours' where reporter_id = reporter;
  set local role authenticated;
  perform pg_temp.assert_report((public.cl_submit_room_report(room,'member',outsider,'other',repeat('🎨',500))->>'already_submitted')::boolean = false, 'quota expires and Unicode boundary accepted');
  reset role;

  -- Preserve existing account/photo deletion semantics: no report evidence copies.
  delete from public.cl_entry_photos where id = photo;
  perform pg_temp.assert_report((select count(*) = 0 from public.cl_room_reports where photo_id = photo), 'photo deletion removes linked report');
  delete from public.cl_profiles where id = reporter;
  perform pg_temp.assert_report((select count(*) = 0 from public.cl_room_reports where reporter_id = reporter), 'account deletion removes report details');
end;
$test$;
rollback;
