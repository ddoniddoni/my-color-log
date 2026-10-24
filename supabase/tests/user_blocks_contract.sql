-- Disposable database only: real authenticated-role reads and writes; rollback all fixtures.
begin;
create function pg_temp.block_assert(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'block_contract:%', label; end if; end;
$$;
create function pg_temp.block_login(actor uuid, anonymous boolean default false, session_value uuid default null)
returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', coalesce(actor::text, ''), true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',actor,'role','authenticated','is_anonymous',anonymous,'session_id',coalesce(session_value,actor))::text,true);
end; $$;
create function pg_temp.block_denied(statement text) returns void language plpgsql as $$ begin
  execute statement; raise exception 'expected_permission_denial';
exception when insufficient_privilege then null; end; $$;

do $test$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); stranger uuid := gen_random_uuid();
  room uuid; second_room uuid; code text; today_date date := (now() at time zone 'Pacific/Kiritimati')::date;
  actor uuid; mission uuid; entry_value uuid; photo uuid; photo_a uuid; photo_b uuid; photo_c uuid;
  path text; job uuid; device uuid;
begin
  foreach actor in array array[a,b,c,stranger] loop
    insert into auth.users(id) values(actor);
    insert into auth.sessions(id,user_id,created_at,updated_at) values(actor,actor,now(),now());
    insert into public.cl_profiles(id,nickname,timezone) values(actor,'차단검증','Pacific/Kiritimati');
  end loop;
  perform pg_temp.block_login(a); set local role authenticated;
  select room_id,invite_code into room,code from public.cl_create_room_with_invite_v2('차단 검증방',null,'Pacific/Kiritimati');
  perform pg_temp.block_login(b); perform public.cl_join_room_by_code(code);
  perform pg_temp.block_login(c); perform public.cl_join_room_by_code(code);
  perform pg_temp.block_login(a);
  select room_id,invite_code into second_room,code from public.cl_create_room_with_invite_v2('다른 공통방',null,'Pacific/Kiritimati');
  perform pg_temp.block_login(b); perform public.cl_join_room_by_code(code);
  reset role;
  perform pg_temp.block_login(a);
  mission := public.cl_ensure_room_daily_mission(room,today_date);
  perform public.cl_ensure_room_daily_mission(second_room,today_date);
  insert into public.cl_push_devices(user_id,expo_push_token,platform,is_enabled,session_id)
    values(a,'ExpoPushToken[block_contract_a]','android',true,a) returning id into device;
  foreach actor in array array[a,b,c] loop
    entry_value := gen_random_uuid(); photo := gen_random_uuid();
    path := actor::text || '/' || today_date::text || '/' || photo::text || '.jpg';
    insert into public.cl_daily_entries(id,user_id,mission_id,date_key) values(entry_value,actor,mission,today_date);
    insert into public.cl_entry_photos(id,entry_id,owner_id,date_key,storage_path,position,captured_at,width,height,byte_size)
      values(photo,entry_value,actor,today_date,path,1,now(),100,100,1);
    insert into storage.objects(bucket_id,name) values('cl-entry-photos',path);
    insert into public.cl_entry_room_shares(entry_id,room_id,shared_by) values(entry_value,room,actor);
    if actor <> c then insert into public.cl_entry_room_shares(entry_id,room_id,shared_by) values(entry_value,second_room,actor); end if;
    if actor=a then photo_a:=photo; elsif actor=b then photo_b:=photo; else photo_c:=photo; end if;
  end loop;
  select id into job from public.cl_room_push_jobs where room_id=room and source_user_id=b and recipient_user_id=a;
  perform pg_temp.block_assert(job is not null,'push queued before blocking');
  perform pg_temp.block_login(b); set local role authenticated;
  perform public.cl_toggle_room_photo_reaction(room,photo_c,'heart');
  perform pg_temp.block_login(a);
  perform pg_temp.block_assert((select count(*)=3 from public.cl_get_room_day_board(room,today_date)),'baseline board');
  perform pg_temp.block_assert((select count(*)=3 from public.cl_entry_photos where id in (photo_a,photo_b,photo_c)),'baseline photo RLS');
  perform pg_temp.block_assert(public.cl_set_user_block(b,true),'block member');
  perform pg_temp.block_assert(public.cl_set_user_block(b,true),'idempotent block');
  perform pg_temp.block_assert((select count(*)=1 from public.cl_get_my_blocked_users()),'own outgoing list');
  perform pg_temp.block_assert((select count(*)=2 from public.cl_get_room_day_board(room,today_date)),'board hides blocked author');
  perform pg_temp.block_assert((select count(*)=1 from public.cl_get_room_day_board(second_room,today_date)),'all shared rooms');
  perform pg_temp.block_assert(not exists(select 1 from public.cl_get_room_today_board(room) where member_user_id=b),'today wrapper');
  perform pg_temp.block_assert(not exists(select 1 from public.cl_get_active_room_today_board() where member_user_id=b),'legacy today wrapper');
  perform pg_temp.block_assert(not exists(select 1 from public.cl_get_active_room_day_board(today_date) where member_user_id=b),'legacy history board wrapper');
  perform pg_temp.block_assert((select participant_count=2 from public.cl_get_room_history(room) where date_key=today_date),'history count');
  perform pg_temp.block_assert((select participant_count = (select participant_count from public.cl_get_room_history((select room_id from public.cl_room_members where user_id=a and status='active' order by joined_at,room_id limit 1)) where date_key=today_date) from public.cl_get_active_room_history() where date_key=today_date),'legacy history count');
  perform pg_temp.block_assert((select count(*)=2 from public.cl_entry_photos where id in (photo_a,photo_b,photo_c)),'photo RLS hides blocked');
  perform pg_temp.block_assert(not exists(select 1 from public.cl_daily_entries where user_id=b),'entry RLS hides blocked');
  perform pg_temp.block_assert(not exists(select 1 from public.cl_entry_room_shares where shared_by=b),'share RLS hides blocked');
  perform pg_temp.block_assert(not exists(select 1 from storage.objects where bucket_id='cl-entry-photos' and name like b::text || '/%'),'storage RLS hides blocked');
  perform pg_temp.block_assert((select reaction_count=0 from public.cl_get_room_photo_reactions(room,photo_c) where emoji='heart'),'third-party reaction aggregation');
  perform pg_temp.block_assert(not exists(select 1 from public.cl_room_photo_reactions where user_id=b),'direct third-party reaction RLS');
  perform pg_temp.block_assert((select count(*)=3 from public.cl_get_room_v2(room)),'roster unchanged for management');
  perform pg_temp.block_denied(format('select public.cl_get_room_photo_reactions(%L,%L)',room,photo_b));
  perform pg_temp.block_denied(format('select public.cl_toggle_room_photo_reaction(%L,%L,''heart'')',room,photo_b));
  perform pg_temp.block_denied(format('select public.cl_submit_room_report(%L,''photo'',%L,''spam'')',room,photo_b));
  perform public.cl_submit_room_report(room,'member',b,'spam');
  perform pg_temp.block_denied(format('select public.cl_set_user_block(%L,true)',stranger));
  perform pg_temp.block_denied('insert into public.cl_user_blocks default values');
  perform pg_temp.block_denied('delete from public.cl_user_blocks');
  perform pg_temp.block_denied('update public.cl_user_blocks set created_at=now()');
  perform pg_temp.block_denied(format('select cl_private.are_users_blocked(%L,%L)',b,c));
  reset role;
  perform pg_temp.block_assert((select state='cancelled' from public.cl_room_push_jobs where id=job),'queued push cancelled');
  perform pg_temp.block_assert(cl_private.room_push_payload(job) is null,'push payload rechecks block');
  perform pg_temp.block_assert(cl_private.enqueue_room_photo_push(photo_b)=0,'new push blocked');
  perform pg_temp.block_assert(not public.cl_claim_room_photo_push_delivery(room,a,b,today_date),'legacy push claim blocked');
  perform pg_temp.block_assert((select count(*)=3 from public.cl_entry_photos where id in(photo_a,photo_b,photo_c)),'no personal photos deleted');
  perform pg_temp.block_assert((select role='owner' and status='active' from public.cl_room_members where room_id=room and user_id=a),'owner preserved');
  perform pg_temp.block_login(b); set local role authenticated;
  perform pg_temp.block_assert(not exists(select 1 from public.cl_get_my_blocked_users()),'incoming blocker not exposed in outgoing list');
  perform pg_temp.block_assert(not exists(select 1 from public.cl_user_blocks),'incoming rows private');
  perform pg_temp.block_assert(not exists(select 1 from public.cl_entry_photos where id=photo_a),'bilateral access');
  perform pg_temp.block_assert(exists(select 1 from public.cl_entry_photos where id=photo_b),'own diary retained');
  perform public.cl_set_user_block(a,true);
  perform pg_temp.block_login(a);
  perform pg_temp.block_assert(not public.cl_set_user_block(b,false),'unblock own edge');
  perform pg_temp.block_assert(not exists(select 1 from public.cl_entry_photos where id=photo_b),'reciprocal block still enforced');
  perform pg_temp.block_login(b); perform public.cl_set_user_block(a,false);
  perform pg_temp.block_login(a);
  perform pg_temp.block_assert(exists(select 1 from public.cl_entry_photos where id=photo_b),'mutual unblock restores access');
  perform pg_temp.block_assert((select reaction_count=1 from public.cl_get_room_photo_reactions(room,photo_c) where emoji='heart'),'reactions retained');
  perform pg_temp.block_login(c);
  perform pg_temp.block_assert((select count(*)=3 from public.cl_get_room_today_board(room)),'unrelated member unaffected');
  perform pg_temp.block_login(a,true);
  perform pg_temp.block_denied(format('select public.cl_set_user_block(%L,true)',b));
  perform pg_temp.block_login(a,false,b);
  perform pg_temp.block_denied(format('select public.cl_set_user_block(%L,true)',b));
  perform pg_temp.block_login(a); perform public.cl_set_user_block(b,true);
  reset role;
  update public.cl_room_members set status='left' where user_id=a;
  set local role authenticated;
  perform pg_temp.block_assert((select count(*)=1 from public.cl_get_my_blocked_users()),'list survives leaving all rooms');
  perform pg_temp.block_assert(not public.cl_set_user_block(b,false),'unblock after leaving');
  reset role;
  perform pg_temp.block_assert((select state='cancelled' from public.cl_room_push_jobs where id=job),'no old push replay on unblock');
  insert into public.cl_user_blocks(blocker_id,blocked_user_id) values(a,b),(b,a);
  delete from public.cl_profiles where id=b;
  perform pg_temp.block_assert(not exists(select 1 from public.cl_user_blocks where blocker_id=b or blocked_user_id=b),'account deletion cascade');
end;
$test$;
rollback;
