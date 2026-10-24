begin;

-- Disposable local database only. These users and all changes roll back.
create temporary table contract_users (
  ordinal integer primary key,
  id uuid not null default gen_random_uuid()
) on commit drop;
insert into contract_users(ordinal) values (1), (2);
insert into auth.users(id) select id from contract_users;
insert into public.cl_profiles(id,nickname) select id,'계약검증' from contract_users;

do $security_catalog$
declare
  public_table record;
begin
  if exists (
    select 1
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and starts_with(relation.relname, 'cl_')
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
  ) then
    raise exception 'security_contract_public_table_without_rls';
  end if;

  for public_table in
    select relation.oid, relation.relname
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and starts_with(relation.relname, 'cl_')
      and relation.relkind in ('r', 'p')
  loop
    if has_table_privilege('anon', public_table.oid, 'SELECT')
      or has_table_privilege('anon', public_table.oid, 'INSERT')
      or has_table_privilege('anon', public_table.oid, 'UPDATE')
      or has_table_privilege('anon', public_table.oid, 'DELETE')
      or has_table_privilege('anon', public_table.oid, 'TRUNCATE')
      or has_table_privilege('anon', public_table.oid, 'REFERENCES')
      or has_table_privilege('anon', public_table.oid, 'TRIGGER') then
      raise exception 'security_contract_anon_table_privilege:%', public_table.relname;
    end if;

    if has_table_privilege('authenticated', public_table.oid, 'SELECT')
      <> (public_table.relname = any (array[
        'cl_daily_entries',
        'cl_entry_photos',
        'cl_entry_room_shares',
        'cl_profiles',
        'cl_push_devices',
        'cl_room_daily_missions',
        'cl_room_members',
        'cl_room_photo_reactions',
        'cl_rooms',
        'cl_user_blocks'
      ])) then
      raise exception 'security_contract_authenticated_select:%', public_table.relname;
    end if;

    if has_table_privilege('authenticated', public_table.oid, 'INSERT')
      <> (public_table.relname = any (array['cl_daily_entries', 'cl_entry_photos', 'cl_profiles'])) then
      raise exception 'security_contract_authenticated_insert:%', public_table.relname;
    end if;

    if has_table_privilege('authenticated', public_table.oid, 'UPDATE')
      <> (public_table.relname = any (array['cl_daily_entries', 'cl_entry_photos', 'cl_profiles'])) then
      raise exception 'security_contract_authenticated_update:%', public_table.relname;
    end if;

    if has_table_privilege('authenticated', public_table.oid, 'DELETE')
      <> (public_table.relname = any (array['cl_daily_entries', 'cl_entry_photos'])) then
      raise exception 'security_contract_authenticated_delete:%', public_table.relname;
    end if;

    if has_table_privilege('authenticated', public_table.oid, 'TRUNCATE')
      or has_table_privilege('authenticated', public_table.oid, 'REFERENCES')
      or has_table_privilege('authenticated', public_table.oid, 'TRIGGER') then
      raise exception 'security_contract_authenticated_elevated_privilege:%', public_table.relname;
    end if;
  end loop;

  if exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public' and starts_with(procedure.proname, 'cl_')
      and has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ) then
    raise exception 'security_contract_anon_function_execute';
  end if;

  if exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public' and starts_with(procedure.proname, 'cl_')
      and procedure.proname = any (array[
        'cl_assert_active_room_capacity',
        'cl_claim_room_photo_push_delivery',
        'cl_ensure_room_daily_mission',
        'cl_prepare_account_deletion',
        'cl_delete_account_data',
        'cl_set_daily_entries_updated_at',
        'cl_set_profiles_updated_at',
        'cl_touch_room_entry_shares_for_photo_change',
        'cl_validate_entry_room_share',
        'cl_validate_room_daily_mission'
      ])
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  ) then
    raise exception 'security_contract_internal_function_execute';
  end if;

  if exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public' and starts_with(procedure.proname, 'cl_')
      and procedure.prosecdef
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and position('auth.uid' in lower(procedure.prosrc)) = 0
      and not (
        procedure.proname = 'cl_get_room_today_board'
        and position('public.cl_get_room_day_board' in lower(procedure.prosrc)) > 0
      )
  ) then
    raise exception 'security_contract_exposed_definer_without_auth_boundary';
  end if;

  if exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where (namespace.nspname = 'cl_private' or (namespace.nspname = 'public' and starts_with(procedure.proname, 'cl_')))
      and procedure.prosecdef
      and position('search_path=""' in array_to_string(procedure.proconfig, ',')) = 0
  ) then
    raise exception 'security_contract_definer_without_empty_search_path';
  end if;

  if not exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'cl_private'
      and procedure.proname = 'validate_iana_timezone_column'
      and procedure.prosecdef
      and not has_function_privilege('anon', procedure.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  ) then
    raise exception 'security_contract_private_timezone_trigger_privilege';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'cl-entry-photos'
      and not public
      and file_size_limit = 8388608
      and allowed_mime_types = array['image/jpeg']::text[]
  ) then
    raise exception 'security_contract_private_photo_bucket';
  end if;
end;
$security_catalog$;

create temporary table security_audit_context (
  actor_id uuid not null,
  other_id uuid not null,
  mission_id uuid not null,
  entry_id uuid not null,
  photo_id uuid not null,
  date_key date not null
) on commit drop;

insert into security_audit_context (actor_id, other_id, mission_id, entry_id, photo_id, date_key)
select
  (select id from contract_users where ordinal = 1),
  (select id from contract_users where ordinal = 2),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  date '1900-01-01';

do $security_fixtures$
begin
  if exists (
    select 1
    from security_audit_context
    where actor_id is null or other_id is null
  ) then
    raise exception 'security_contract_requires_two_profiles';
  end if;
end;
$security_fixtures$;

insert into public.cl_daily_missions (
  id,
  challenge_date,
  mission_type,
  color_id,
  title_ko,
  prompt_ko,
  source
)
select
  context.mission_id,
  context.date_key,
  'color',
  palette.id,
  'RLS 보안 테스트',
  '트랜잭션 종료 시 제거되는 테스트 미션',
  'manual'
from security_audit_context as context
cross join lateral (
  select color.id
  from public.cl_color_palette as color
  order by color.slug
  limit 1
) as palette;

insert into public.cl_daily_entries (id, user_id, mission_id, date_key)
select entry_id, actor_id, mission_id, date_key
from security_audit_context;

insert into public.cl_entry_photos (
  id,
  entry_id,
  owner_id,
  date_key,
  storage_path,
  position,
  caption,
  captured_at,
  width,
  height,
  byte_size
)
select
  photo_id,
  entry_id,
  actor_id,
  date_key,
  actor_id::text || '/1900-01-01/' || photo_id::text || '.jpg',
  1,
  null,
  timestamptz '1900-01-01 00:00:00+00',
  100,
  100,
  1
from security_audit_context;

grant select on security_audit_context to authenticated;

do $security_jwt$
declare
  actor_user_id uuid := (select actor_id from security_audit_context);
begin
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_user_id, 'role', 'authenticated')::text,
    true
  );
end;
$security_jwt$;

set local role authenticated;

do $security_behavior$
declare
  actor_user_id uuid := (select actor_id from security_audit_context);
  other_user_id uuid := (select other_id from security_audit_context);
  fixture_entry_id uuid := (select entry_id from security_audit_context);
  fixture_mission_id uuid := (select mission_id from security_audit_context);
  fixture_photo_id uuid := (select photo_id from security_audit_context);
  fixture_date_key date := (select date_key from security_audit_context);
  violation_count integer;
begin
  if (select auth.uid()) is distinct from actor_user_id then
    raise exception 'security_contract_jwt_context';
  end if;

  update public.cl_profiles
  set timezone = 'Asia/Seoul'
  where id = actor_user_id;

  if not exists (
    select 1
    from public.cl_profiles as profile
    where profile.id = actor_user_id
      and profile.timezone = 'Asia/Seoul'
  ) then
    raise exception 'security_contract_profile_timezone_update_failed';
  end if;

  select count(*) into violation_count
  from public.cl_profiles as profile
  where profile.id <> actor_user_id;
  if violation_count <> 0 then
    raise exception 'security_contract_profile_cross_read';
  end if;

  if not exists (
    select 1
    from public.cl_daily_entries as entry
    where entry.id = fixture_entry_id
      and entry.user_id = actor_user_id
  ) then
    raise exception 'security_contract_own_entry_hidden';
  end if;

  select count(*) into violation_count
  from public.cl_daily_entries as entry
  where entry.user_id <> actor_user_id
    and not cl_private.can_view_shared_entry(entry.id);
  if violation_count <> 0 then
    raise exception 'security_contract_entry_cross_read';
  end if;

  select count(*) into violation_count
  from public.cl_entry_photos as photo
  where photo.owner_id <> actor_user_id
    and not cl_private.can_view_shared_entry(photo.entry_id);
  if violation_count <> 0 then
    raise exception 'security_contract_photo_cross_read';
  end if;

  select count(*) into violation_count
  from public.cl_room_members as membership
  where membership.user_id <> actor_user_id;
  if violation_count <> 0 then
    raise exception 'security_contract_membership_cross_read';
  end if;

  select count(*) into violation_count
  from public.cl_rooms as room
  where not cl_private.has_active_room_membership(room.id);
  if violation_count <> 0 then
    raise exception 'security_contract_room_cross_read';
  end if;

  select count(*) into violation_count
  from public.cl_entry_room_shares as share
  where share.shared_by <> actor_user_id
    and not cl_private.can_view_shared_entry(share.entry_id);
  if violation_count <> 0 then
    raise exception 'security_contract_share_cross_read';
  end if;

  select count(*) into violation_count
  from public.cl_push_devices as device
  where device.user_id <> actor_user_id;
  if violation_count <> 0 then
    raise exception 'security_contract_push_device_cross_read';
  end if;

  select count(*) into violation_count
  from storage.objects as object
  where object.bucket_id = 'cl-entry-photos'
    and (storage.foldername(object.name))[1] <> actor_user_id::text
    and not cl_private.can_view_shared_storage_path(object.name);
  if violation_count <> 0 then
    raise exception 'security_contract_storage_cross_read';
  end if;

  begin
    insert into public.cl_daily_entries (id, user_id, mission_id, date_key)
    values (fixture_photo_id, other_user_id, fixture_mission_id, fixture_date_key);
    raise exception 'security_contract_entry_cross_insert';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.cl_daily_entries
    set user_id = other_user_id
    where id = fixture_entry_id;
    raise exception 'security_contract_entry_owner_reassignment';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.cl_entry_photos
    set owner_id = other_user_id
    where id = fixture_photo_id;
    raise exception 'security_contract_photo_owner_reassignment';
  exception
    when insufficient_privilege then null;
  end;
end;
$security_behavior$;

rollback;
