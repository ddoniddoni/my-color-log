-- Disposable local DB only. Real RPCs and authenticated RLS; all fixtures roll back.
-- FR-ROOM-001/003/005/007/009: rejoin, invite accounting, ownership and visibility.
begin;

create function pg_temp.assert_true(value boolean, label text)
returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'rejoin_contract:%', label; end if;
end;
$$;

create function pg_temp.login(user_id uuid, anonymous boolean default false)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(user_id::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', user_id, 'role', 'authenticated', 'is_anonymous', anonymous)::text, true);
end;
$$;

create function pg_temp.expect_join_error(code text, expected text)
returns void language plpgsql as $$
begin
  perform public.cl_join_room_by_code(code);
  raise exception 'expected_error_missing:%', expected;
exception when others then
  if sqlerrm <> expected then raise; end if;
end;
$$;

do $contract$
declare
  zone text;
  actor_owner_id uuid;
  actor_member_id uuid;
  actor_outsider_id uuid;
  room_id_value uuid;
  extra_room_id uuid;
  first_code text;
  fresh_code text;
  invite_id_value uuid;
  date_value date;
  today_date_value date;
  mission_id_value uuid;
  entry_id_value uuid;
  photo_id_value uuid;
  photo_path text;
  actor uuid;
  offset_days integer;
  index_value integer;
  joined_before timestamptz;
begin
  foreach zone in array array['Asia/Seoul', 'America/Los_Angeles', 'Pacific/Kiritimati'] loop
    today_date_value := (now() at time zone zone)::date;
    actor_owner_id := gen_random_uuid(); actor_member_id := gen_random_uuid(); actor_outsider_id := gen_random_uuid();
    insert into auth.users(id) values(actor_owner_id), (actor_member_id), (actor_outsider_id);
    insert into public.cl_profiles(id, nickname, timezone)
      values(actor_owner_id, '방장검증', 'Pacific/Honolulu'), (actor_member_id, '재가입검증', 'Pacific/Honolulu'),
        (actor_outsider_id, '외부검증', 'Pacific/Honolulu');
    perform pg_temp.login(actor_owner_id);
    set local role authenticated;
    select room_id, invite_code into room_id_value, first_code
      from public.cl_create_room_with_invite_v2('재가입 검증방', null, zone);
    perform pg_temp.login(actor_member_id);
    perform pg_temp.assert_true(public.cl_join_room_by_code(first_code) = room_id_value, 'initial join');
    reset role;
    update public.cl_room_members set joined_at = now() - interval '3 days' where room_id = room_id_value;
    joined_before := now() - interval '3 days';

    -- Both users keep yesterday's and today's own photos; old shares stay in place.
    foreach actor in array array[actor_owner_id, actor_member_id] loop
      for offset_days in 0..1 loop
        date_value := today_date_value - offset_days;
        perform pg_temp.login(actor_owner_id);
        mission_id_value := public.cl_ensure_room_daily_mission(room_id_value, date_value);
        entry_id_value := gen_random_uuid(); photo_id_value := gen_random_uuid();
        photo_path := actor::text || '/' || date_value::text || '/' || photo_id_value::text || '.jpg';
        insert into public.cl_daily_entries(id,user_id,mission_id,date_key)
          values(entry_id_value,actor,mission_id_value,date_value);
        insert into public.cl_entry_photos(id,entry_id,owner_id,date_key,storage_path,position,captured_at,width,height,byte_size)
          values(photo_id_value,entry_id_value,actor,date_value,photo_path,1,now(),100,100,1);
        insert into public.cl_entry_room_shares(entry_id,room_id,shared_by)
          values(entry_id_value,room_id_value,actor);
        insert into storage.objects(bucket_id,name) values('cl-entry-photos',photo_path);
      end loop;
    end loop;

    perform pg_temp.login(actor_member_id);
    set local role authenticated;
    perform public.cl_leave_room(room_id_value);
    perform pg_temp.assert_true((select count(*) = 0 from public.cl_entry_photos p where p.owner_id = actor_owner_id), 'left member cannot read others');
    reset role;
    perform pg_temp.assert_true((select status = 'draft' from public.cl_rooms where id = room_id_value), 'last member leaves');

    perform pg_temp.login(actor_owner_id);
    set local role authenticated;
    select invite_code into fresh_code from public.cl_create_room_invite(room_id_value);
    perform pg_temp.login(actor_member_id);
    -- This fails with cl_room_members_pkey/23505 before the fix, even with a NEW invite.
    perform pg_temp.assert_true(public.cl_join_room_by_code(fresh_code) = room_id_value, 'fresh invite rejoin');
    reset role;
    select id into invite_id_value from public.cl_room_invites where display_code = fresh_code;
    perform pg_temp.assert_true((select count(*) = 1 and bool_and(status = 'active' and role = 'member'
      and left_at is null and joined_at > joined_before) from public.cl_room_members
      where room_id = room_id_value and user_id = actor_member_id), 'single reset membership');
    perform pg_temp.assert_true((select use_count = 1 from public.cl_room_invites where id = invite_id_value), 'one invite use');
    perform pg_temp.assert_true((select count(*) = 1 from public.cl_room_invite_uses
      where invite_id = invite_id_value and user_id = actor_member_id), 'one acceptance');
    perform pg_temp.assert_true((select status = 'active' from public.cl_rooms where id = room_id_value), 'room active again');

    -- Rejoining does not regain pre-rejoin room days, including storage and board RPCs.
    perform pg_temp.login(actor_member_id);
    set local role authenticated;
    perform pg_temp.assert_true((select count(*) = 2 from public.cl_entry_photos p where p.owner_id = actor_member_id), 'own photos preserved');
    perform pg_temp.assert_true((select count(*) = 1 from public.cl_entry_photos p
      where p.owner_id = actor_owner_id and p.date_key = today_date_value), 'today visible');
    perform pg_temp.assert_true((select count(*) = 0 from public.cl_entry_photos p
      where p.owner_id = actor_owner_id and p.date_key < today_date_value), 'old photos hidden');
    perform pg_temp.assert_true((select count(*) = 1 from storage.objects
      where bucket_id = 'cl-entry-photos' and split_part(name,'/',1) = actor_owner_id::text), 'storage follows rejoin date');
    perform pg_temp.assert_true((select count(*) = 0 from public.cl_get_room_day_board(
      room_id_value, today_date_value - 1)), 'old board hidden');
    perform pg_temp.assert_true((select count(*) = 1 from public.cl_get_room_day_board(
      room_id_value, today_date_value) b where b.member_user_id = actor_member_id
      and b.photo_id is not null), 'own today share retained');
    perform pg_temp.login(actor_outsider_id);
    perform pg_temp.assert_true((select count(*) = 0 from public.cl_entry_photos p
      where p.owner_id in (actor_owner_id,actor_member_id)), 'outsider denied');
    perform pg_temp.login(null);
    perform pg_temp.expect_join_error(fresh_code, 'authentication_required');
    perform pg_temp.login(actor_outsider_id, true);
    perform pg_temp.expect_join_error(fresh_code, 'authentication_required');
    reset role;

    -- A second request cannot consume another invite use or change joined_at.
    perform pg_temp.login(actor_member_id);
    set local role authenticated;
    perform pg_temp.expect_join_error(fresh_code, 'room_already_joined');
    perform public.cl_leave_room(room_id_value);
    perform pg_temp.expect_join_error(fresh_code, 'room_invite_already_used');
    reset role;
    perform pg_temp.assert_true((select use_count = 1 from public.cl_room_invites where id = invite_id_value), 'repeated request does not consume');

    -- Owner removal revokes old codes; only a freshly issued invite can restore membership.
    perform pg_temp.login(actor_owner_id);
    set local role authenticated;
    select invite_code into fresh_code from public.cl_create_room_invite(room_id_value);
    perform pg_temp.login(actor_member_id);
    perform public.cl_join_room_by_code(fresh_code);
    perform pg_temp.login(actor_owner_id);
    perform public.cl_remove_room_member(room_id_value, actor_member_id);
    perform pg_temp.login(actor_member_id);
    perform pg_temp.expect_join_error(fresh_code, 'room_invite_not_available');
    perform pg_temp.login(actor_owner_id);
    select invite_code into fresh_code from public.cl_create_room_invite(room_id_value);
    perform pg_temp.login(actor_member_id);
    perform public.cl_join_room_by_code(fresh_code);

    -- Former owners return as members after transfer/leave, never regain owner privileges.
    perform pg_temp.login(actor_owner_id);
    perform public.cl_transfer_room_ownership(room_id_value, actor_member_id);
    perform public.cl_leave_room(room_id_value);
    perform pg_temp.login(actor_member_id);
    select invite_code into fresh_code from public.cl_create_room_invite(room_id_value);
    perform pg_temp.login(actor_owner_id);
    perform public.cl_join_room_by_code(fresh_code);
    reset role;
    perform pg_temp.assert_true((select role = 'member' from public.cl_room_members
      where room_id = room_id_value and user_id = actor_owner_id), 'former owner has member role');

    -- An existing left membership cannot bypass room capacity or the user's three-room cap.
    perform pg_temp.login(actor_owner_id);
    set local role authenticated;
    perform public.cl_leave_room(room_id_value);
    perform pg_temp.login(actor_member_id);
    select invite_code into fresh_code from public.cl_create_room_invite(room_id_value);
    reset role;
    select id into invite_id_value from public.cl_room_invites where display_code = fresh_code;
    for index_value in 1..5 loop
      actor := gen_random_uuid();
      insert into auth.users(id) values(actor);
      insert into public.cl_profiles(id,nickname) values(actor,'정원검증');
      insert into public.cl_room_members(room_id,user_id,role) values(room_id_value,actor,'member');
    end loop;
    perform pg_temp.login(actor_owner_id);
    set local role authenticated;
    perform pg_temp.expect_join_error(fresh_code, 'room_member_limit_reached');
    reset role;
    update public.cl_room_members set status = 'left', left_at = now()
      where room_id = room_id_value and user_id not in (actor_owner_id,actor_member_id);
    for index_value in 1..3 loop
      insert into public.cl_rooms(name,created_by) values('다른 검증방',actor_owner_id) returning id into extra_room_id;
      insert into public.cl_room_members(room_id,user_id,role) values(extra_room_id,actor_owner_id,'owner');
    end loop;
    set local role authenticated;
    perform pg_temp.expect_join_error(fresh_code, 'active_room_limit_reached');
    reset role;
    perform pg_temp.assert_true((select use_count = 0 from public.cl_room_invites where id = invite_id_value), 'failed joins atomic');
    perform pg_temp.assert_true((select status = 'left' from public.cl_room_members
      where room_id = room_id_value and user_id = actor_owner_id), 'failed join keeps membership left');

    -- Invalid invites never create a new membership or acceptance record.
    perform pg_temp.login(actor_outsider_id);
    set local role authenticated;
    perform pg_temp.expect_join_error(null, 'room_invite_not_available');
    perform pg_temp.expect_join_error(' ', 'room_invite_not_available');
    perform pg_temp.expect_join_error(first_code, 'room_invite_not_available');
    reset role;
    update public.cl_room_invites set expires_at = now() - interval '1 second' where id = invite_id_value;
    set local role authenticated;
    perform pg_temp.expect_join_error(fresh_code, 'room_invite_not_available');
    reset role;
    update public.cl_room_invites set expires_at = now() + interval '1 day', use_count = max_uses where id = invite_id_value;
    set local role authenticated;
    perform pg_temp.expect_join_error(fresh_code, 'room_invite_not_available');
    reset role;
    update public.cl_room_invites set use_count = 0 where id = invite_id_value;
    perform pg_temp.login(actor_member_id);
    set local role authenticated;
    perform pg_temp.expect_join_error(fresh_code, 'room_invite_cannot_join_self');
    reset role;
    update public.cl_rooms set status = 'ended', ended_at = now() where id = room_id_value;
    perform pg_temp.login(actor_outsider_id);
    set local role authenticated;
    perform pg_temp.expect_join_error(fresh_code, 'room_not_available');
    reset role;
    perform pg_temp.assert_true((select count(*) = 0 from public.cl_room_members
      where room_id = room_id_value and user_id = actor_outsider_id), 'failed newcomer absent');
    perform pg_temp.assert_true((select count(*) = 4 from public.cl_entry_photos p
      where p.owner_id in (actor_owner_id,actor_member_id)), 'all personal photo metadata preserved');
    perform pg_temp.assert_true((select count(*) = 4 from public.cl_entry_room_shares
      where room_id = room_id_value), 'share references preserved');
  end loop;
  perform pg_temp.assert_true(has_function_privilege('authenticated', 'public.cl_join_room_by_code(text)', 'execute')
    and not has_function_privilege('anon', 'public.cl_join_room_by_code(text)', 'execute')
    and not has_function_privilege('service_role', 'public.cl_join_room_by_code(text)', 'execute'), 'RPC grants unchanged');
end;
$contract$;
rollback;
