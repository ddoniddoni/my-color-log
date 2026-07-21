begin;

create temporary table account_deletion_audit_context (
  deleting_user_id uuid not null,
  successor_user_id uuid not null,
  shared_room_id uuid not null,
  solo_room_id uuid not null
) on commit drop;

insert into account_deletion_audit_context (
  deleting_user_id,
  successor_user_id,
  shared_room_id,
  solo_room_id
)
select
  (select profile.id from public.profiles as profile order by profile.created_at, profile.id limit 1),
  (select profile.id from public.profiles as profile order by profile.created_at, profile.id offset 1 limit 1),
  gen_random_uuid(),
  gen_random_uuid();

insert into public.rooms (id, name, status, created_by)
select shared_room_id, '삭제 공유방', 'active', deleting_user_id
from account_deletion_audit_context
union all
select solo_room_id, '삭제 혼자방', 'draft', deleting_user_id
from account_deletion_audit_context;

insert into public.room_members (room_id, user_id, role, status, joined_at)
select shared_room_id, deleting_user_id, 'owner', 'active', timestamptz '1900-01-01 00:00:00+00'
from account_deletion_audit_context
union all
select shared_room_id, successor_user_id, 'member', 'active', timestamptz '1900-01-02 00:00:00+00'
from account_deletion_audit_context
union all
select solo_room_id, deleting_user_id, 'owner', 'active', timestamptz '1900-01-03 00:00:00+00'
from account_deletion_audit_context;

do $authenticated_rejection$
declare
  target_user_id uuid := (select deleting_user_id from account_deletion_audit_context);
begin
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);

  begin
    perform public.prepare_account_deletion(target_user_id);
    raise exception 'account_deletion_contract_authenticated_call_succeeded';
  exception
    when sqlstate '42501' then null;
  end;
end;
$authenticated_rejection$;

do $service_role_preparation$
declare
  target_user_id uuid := (select deleting_user_id from account_deletion_audit_context);
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform public.prepare_account_deletion(target_user_id);
end;
$service_role_preparation$;

do $account_deletion_assertions$
declare
  context account_deletion_audit_context%rowtype := (select audit from account_deletion_audit_context as audit);
begin
  if not exists (
    select 1
    from public.room_members as membership
    where membership.room_id = context.shared_room_id
      and membership.user_id = context.successor_user_id
      and membership.role = 'owner'
      and membership.status = 'active'
  ) then
    raise exception 'account_deletion_contract_owner_not_transferred';
  end if;

  if not exists (
    select 1
    from public.room_members as membership
    where membership.room_id = context.shared_room_id
      and membership.user_id = context.deleting_user_id
      and membership.role = 'member'
      and membership.status = 'active'
  ) then
    raise exception 'account_deletion_contract_previous_owner_not_demoted';
  end if;

  if not exists (
    select 1
    from public.rooms as room
    where room.id = context.solo_room_id
      and room.status = 'ended'
      and room.ended_at is not null
  ) then
    raise exception 'account_deletion_contract_solo_room_not_ended';
  end if;

  if not exists (
    select 1
    from public.room_members as membership
    where membership.room_id = context.solo_room_id
      and membership.user_id = context.deleting_user_id
      and membership.status = 'left'
      and membership.left_at is not null
  ) then
    raise exception 'account_deletion_contract_solo_membership_not_left';
  end if;
end;
$account_deletion_assertions$;

rollback;
