-- Run against a disposable/local Supabase DB. Uses real authenticated/service
-- roles (not service role alone). All synthetic fixtures and mutations roll back.
begin;
create function pg_temp.assert_push(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%', message; end if; end; $$;
create temporary table push_fixture as select gen_random_uuid() owner_id, gen_random_uuid() recipient_id,
  gen_random_uuid() outsider_id, gen_random_uuid() session_id, gen_random_uuid() room_id,
  gen_random_uuid() entry_id, gen_random_uuid() photo_id, (now() at time zone 'Asia/Seoul')::date date_key;
grant select on push_fixture to authenticated, service_role;
insert into auth.users(id) select owner_id from push_fixture union all select recipient_id from push_fixture union all select outsider_id from push_fixture;
insert into auth.sessions(id,user_id,created_at,updated_at) select session_id,recipient_id,now(),now() from push_fixture;
insert into public.cl_profiles(id,nickname) select owner_id,'사진주인' from push_fixture union all select recipient_id,'알림수신' from push_fixture union all select outsider_id,'외부유저' from push_fixture;

set local role authenticated;
select set_config('request.jwt.claim.sub', recipient_id::text, true) from push_fixture;
select set_config('request.jwt.claims', jsonb_build_object('sub',recipient_id,'role','authenticated','session_id',session_id)::text, true) from push_fixture;
select public.cl_register_my_push_device('ExpoPushToken[contract-one]', 'ios');
select public.cl_register_my_push_device('ExpoPushToken[contract-two]', 'android');
do $$ begin
  begin perform public.cl_register_my_push_device('invalid-token', 'ios'); raise exception 'invalid_token_accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.cl_claim_room_push_jobs(20); raise exception 'client_claim_allowed';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.cl_room_push_jobs; raise exception 'client_queue_read_allowed';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
select pg_temp.assert_push((select relrowsecurity from pg_class where oid='public.cl_room_push_jobs'::regclass), 'queue_rls_missing');
select pg_temp.assert_push(not has_table_privilege('anon','public.cl_room_push_jobs','select'), 'anon_queue_access');
select pg_temp.assert_push(not has_function_privilege('authenticated','public.cl_get_room_push_payload(uuid,uuid)','execute'), 'client_payload_access');
select pg_temp.assert_push(not has_function_privilege('authenticated','public.cl_finish_room_push_job(uuid,uuid,text,text,text,integer,boolean)','execute'), 'client_finish_access');
select pg_temp.assert_push(not has_function_privilege('authenticated','cl_private.enqueue_room_photo_push(uuid)','execute'), 'client_private_enqueue_access');
select pg_temp.assert_push((select count(*)=2 from public.cl_push_devices where user_id=(select recipient_id from push_fixture)), 'device_registration_failed');

insert into public.cl_daily_missions(challenge_date,mission_type,color_id,title_ko,prompt_ko,source)
select date_key,'color',(select id from public.cl_color_palette order by slug limit 1),'알림 테스트','임시 테스트','manual' from push_fixture on conflict(challenge_date) do nothing;
insert into public.cl_rooms(id,name,created_by,status,timezone) select room_id,'테스트방',owner_id,'active','Asia/Seoul' from push_fixture;
insert into public.cl_room_members(room_id,user_id,role,joined_at)
select room_id,owner_id,'owner',now()-interval '2 days' from push_fixture union all select room_id,recipient_id,'member',now()-interval '2 days' from push_fixture;
insert into public.cl_room_daily_missions(room_id,challenge_date,mission_id)
select f.room_id,f.date_key,m.id from push_fixture f join public.cl_daily_missions m on m.challenge_date=f.date_key;
insert into public.cl_daily_entries(id,user_id,mission_id,date_key)
select f.entry_id,f.owner_id,m.id,f.date_key from push_fixture f join public.cl_daily_missions m on m.challenge_date=f.date_key;
insert into public.cl_entry_photos(id,entry_id,owner_id,date_key,storage_path,position,captured_at,width,height,byte_size)
select photo_id,entry_id,owner_id,date_key,owner_id::text||'/'||date_key||'/'||photo_id||'.jpg',1,now(),100,100,10 from push_fixture;
select pg_temp.assert_push((select count(*)=0 from public.cl_room_push_jobs where room_id=(select room_id from push_fixture)), 'unshared_photo_notified');
insert into public.cl_entry_room_shares(entry_id,room_id,shared_by) select entry_id,room_id,owner_id from push_fixture;
select pg_temp.assert_push((select count(*)=2 from public.cl_room_push_jobs where room_id=(select room_id from push_fixture)), 'share_did_not_enqueue_devices');
insert into public.cl_entry_photos(id,entry_id,owner_id,date_key,storage_path,position,captured_at,width,height,byte_size)
select gen_random_uuid(),entry_id,owner_id,date_key,owner_id::text||'/'||date_key||'/second.jpg',2,now(),100,100,10 from push_fixture;
select pg_temp.assert_push((select count(*)=2 from public.cl_room_push_jobs where room_id=(select room_id from push_fixture)), 'same_day_duplicate_jobs');

set local role authenticated;
select set_config('request.jwt.claim.sub', outsider_id::text, true) from push_fixture;
do $$ begin
  begin perform public.cl_enqueue_my_room_photo_push((select photo_id from push_fixture)); raise exception 'outsider_enqueued_photo';
  exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub', owner_id::text, true) from push_fixture;
select pg_temp.assert_push(public.cl_enqueue_my_room_photo_push((select photo_id from push_fixture))=0, 'legacy_enqueue_not_idempotent');
reset role;

set local role service_role;
create temporary table push_claims as select * from public.cl_claim_room_push_jobs(20);
select pg_temp.assert_push((select count(*)=2 from push_claims where room_id=(select room_id from push_fixture)), 'worker_claim_count');
select pg_temp.assert_push(not exists(select 1 from public.cl_claim_room_push_jobs(20) where room_id=(select room_id from push_fixture)), 'live_lease_reclaimed');
select pg_temp.assert_push((select bool_and(public.cl_get_room_push_payload(id,lease_token)->'data'->>'recipientUserId'=recipient_user_id::text) from push_claims), 'recipient_binding_missing');
select pg_temp.assert_push((select bool_and(not public.cl_finish_room_push_job(id,gen_random_uuid(),'failed')) from push_claims), 'wrong_lease_finished');
reset role;

-- Revalidate eligibility immediately before sending, including room dates and
-- token generation. None of these changes can produce a private payload.
update public.cl_room_members set joined_at=now()+interval '2 days' where user_id=(select recipient_id from push_fixture);
select pg_temp.assert_push((select bool_and(cl_private.room_push_payload(id) is null) from push_claims), 'before_join_day_payload');
update public.cl_room_members set joined_at=now()-interval '2 days',status='left',left_at=now() where user_id=(select recipient_id from push_fixture);
select pg_temp.assert_push((select bool_and(cl_private.room_push_payload(id) is null) from push_claims), 'left_member_payload');
update public.cl_room_members set status='active',left_at=null where user_id=(select recipient_id from push_fixture);
update public.cl_entry_room_shares set revoked_at=now() where entry_id=(select entry_id from push_fixture);
select pg_temp.assert_push((select bool_and(cl_private.room_push_payload(id) is null) from push_claims), 'revoked_share_payload');
update public.cl_entry_room_shares set revoked_at=null where entry_id=(select entry_id from push_fixture);
update public.cl_push_devices set is_enabled=false where user_id=(select recipient_id from push_fixture);
select pg_temp.assert_push((select bool_and(cl_private.room_push_payload(id) is null) from push_claims), 'disabled_device_payload');
update public.cl_push_devices set is_enabled=true where user_id=(select recipient_id from push_fixture);
delete from auth.sessions where id=(select session_id from push_fixture);
select pg_temp.assert_push((select bool_and(cl_private.room_push_payload(id) is null) from push_claims), 'revoked_session_payload');
insert into auth.sessions(id,user_id,created_at,updated_at) select session_id,recipient_id,now(),now() from push_fixture;

set local role service_role;
select pg_temp.assert_push(public.cl_finish_room_push_job(id,lease_token,'awaiting_receipt',null,'test-ticket',900,false), 'ticket_not_persisted') from push_claims;
reset role;
select pg_temp.assert_push((select bool_and(state='awaiting_receipt' and ticket_id='test-ticket' and next_attempt_at >= now()+interval '15 minutes') from public.cl_room_push_jobs where id in(select id from push_claims)), 'ticket_state_invalid');
update public.cl_room_push_jobs set next_attempt_at=now()-interval '1 second' where id in(select id from push_claims);
set local role service_role;
create temporary table receipt_claims as select * from public.cl_claim_room_push_jobs(20);
select pg_temp.assert_push((select bool_and(send_attempts=1 and receipt_attempts=1) from receipt_claims where id in(select id from push_claims)), 'receipt_attempt_resent_photo');
reset role;
-- A late DeviceNotRegistered from a prior registration must not disable a new
-- session/user on the same token.
update public.cl_push_devices set registration_id=gen_random_uuid() where id=(select device_id from receipt_claims order by id limit 1);
set local role service_role;
select pg_temp.assert_push(public.cl_finish_room_push_job(id,lease_token,'failed','DeviceNotRegistered',null,900,true),'receipt_finish_failed') from receipt_claims order by id limit 1;
reset role;
select pg_temp.assert_push((select is_enabled from public.cl_push_devices where id=(select device_id from receipt_claims order by id limit 1)), 'new_registration_disabled_by_old_receipt');
set local role service_role;
select pg_temp.assert_push(public.cl_finish_room_push_job(id,lease_token,'provider_accepted'),'provider_acceptance_not_saved') from receipt_claims order by id desc limit 1;
reset role;
select pg_temp.assert_push((select count(*)=1 from public.cl_room_push_jobs where room_id=(select room_id from push_fixture) and state='provider_accepted'), 'provider_acceptance_state');

-- An expired lease is recoverable and old owners cannot overwrite its result.
update public.cl_room_push_jobs set state='pending',send_attempts=1,next_attempt_at=now(),lease_until=now()-interval '1 second' where id=(select id from push_claims order by id limit 1);
set local role service_role;
select pg_temp.assert_push((select count(*)=1 from public.cl_claim_room_push_jobs(20) where id in(select id from push_claims)), 'expired_lease_not_recovered');
reset role;
delete from public.cl_entry_photos where id=(select photo_id from push_fixture);
select pg_temp.assert_push((select bool_and(cl_private.room_push_payload(id) is null) from push_claims), 'deleted_photo_payload');
select pg_temp.assert_push((select count(*)=1 from public.cl_daily_entries where id=(select entry_id from push_fixture)), 'queue_changed_personal_entry');
rollback;
