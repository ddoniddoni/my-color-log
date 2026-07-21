begin;

create temporary table diary_management_context (
  actor_id uuid not null,
  other_id uuid not null,
  mission_id uuid not null,
  actor_entry_id uuid not null,
  other_entry_id uuid not null,
  first_photo_id uuid not null,
  deleted_photo_id uuid not null,
  last_photo_id uuid not null,
  other_photo_id uuid not null,
  date_key date not null
) on commit drop;

insert into diary_management_context
select
  (select profile.id from public.profiles as profile order by profile.created_at, profile.id limit 1),
  (select profile.id from public.profiles as profile order by profile.created_at, profile.id offset 1 limit 1),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  date '1899-12-31';

do $fixtures$
begin
  if exists (
    select 1
    from diary_management_context
    where actor_id is null or other_id is null
  ) then
    raise exception 'diary_management_contract_requires_two_profiles';
  end if;
end;
$fixtures$;

insert into public.daily_missions (
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
  '다이어리 관리 테스트',
  '트랜잭션 종료 시 제거되는 테스트 미션',
  'manual'
from diary_management_context as context
cross join lateral (
  select color.id
  from public.color_palette as color
  order by color.slug
  limit 1
) as palette;

insert into public.daily_entries (id, user_id, mission_id, date_key)
select actor_entry_id, actor_id, mission_id, date_key
from diary_management_context
union all
select other_entry_id, other_id, mission_id, date_key
from diary_management_context;

insert into public.entry_photos (
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
select first_photo_id, actor_entry_id, actor_id, date_key, actor_id::text || '/1899-12-31/first.jpg', 1, null, now(), 100, 100, 1
from diary_management_context
union all
select deleted_photo_id, actor_entry_id, actor_id, date_key, actor_id::text || '/1899-12-31/deleted.jpg', 2, null, now(), 100, 100, 1
from diary_management_context
union all
select last_photo_id, actor_entry_id, actor_id, date_key, actor_id::text || '/1899-12-31/last.jpg', 3, null, now(), 100, 100, 1
from diary_management_context
union all
select other_photo_id, other_entry_id, other_id, date_key, other_id::text || '/1899-12-31/other.jpg', 1, null, now(), 100, 100, 1
from diary_management_context;

grant select on diary_management_context to authenticated;

do $jwt$
declare
  actor_user_id uuid := (select actor_id from diary_management_context);
begin
  perform set_config('request.jwt.claim.sub', actor_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_user_id, 'role', 'authenticated')::text,
    true
  );
end;
$jwt$;

set local role authenticated;

do $behavior$
declare
  fixture_entry_id uuid := (select actor_entry_id from diary_management_context);
  fixture_other_entry_id uuid := (select other_entry_id from diary_management_context);
  fixture_deleted_photo_id uuid := (select deleted_photo_id from diary_management_context);
  fixture_other_photo_id uuid := (select other_photo_id from diary_management_context);
  deleted_path text;
begin
  if (
    select count(*)
    from public.get_diary_month_v2(date '1899-12-01') as diary
    where diary.entry_id = fixture_entry_id
  ) <> 3 then
    raise exception 'diary_management_contract_own_entry_missing';
  end if;

  if exists (
    select 1
    from public.get_diary_month_v2(date '1899-12-01') as diary
    where diary.entry_id = fixture_other_entry_id
  ) then
    raise exception 'diary_management_contract_cross_user_read';
  end if;

  select result.storage_path
  into deleted_path
  from public.delete_my_entry_photo(fixture_deleted_photo_id) as result;

  if deleted_path is null or not deleted_path like '%/deleted.jpg' then
    raise exception 'diary_management_contract_delete_result';
  end if;

  if (
    select array_agg(photo.position order by photo.position)
    from public.entry_photos as photo
    where photo.entry_id = fixture_entry_id
  ) is distinct from array[1::smallint, 2::smallint] then
    raise exception 'diary_management_contract_position_compaction';
  end if;

  if exists (
    select 1
    from public.delete_my_entry_photo(fixture_other_photo_id)
  ) then
    raise exception 'diary_management_contract_cross_user_delete';
  end if;
end;
$behavior$;

reset role;

do $admin_verification$
declare
  fixture_other_photo_id uuid := (select other_photo_id from diary_management_context);
begin
  if not exists (
    select 1
    from public.entry_photos as photo
    where photo.id = fixture_other_photo_id
  ) then
    raise exception 'diary_management_contract_other_photo_removed';
  end if;
end;
$admin_verification$;

rollback;
