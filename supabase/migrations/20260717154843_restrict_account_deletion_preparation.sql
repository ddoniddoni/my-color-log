drop function public.prepare_my_account_deletion();

create function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := p_user_id;
  target_room_id uuid;
  current_role text;
  successor_user_id uuid;
begin
  if current_user_id is null or (select auth.role()) <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  select membership.room_id, membership.role
  into target_room_id, current_role
  from public.room_members as membership
  join public.rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.user_id = current_user_id
    and membership.status = 'active'
  for update of membership, room;

  if not found or current_role <> 'owner' then
    return;
  end if;

  perform 1
  from public.room_members as membership
  where membership.room_id = target_room_id
    and membership.status = 'active'
  for update;

  select membership.user_id
  into successor_user_id
  from public.room_members as membership
  where membership.room_id = target_room_id
    and membership.status = 'active'
    and membership.user_id <> current_user_id
  order by membership.joined_at
  limit 1;

  update public.room_invites
  set revoked_at = now()
  where room_id = target_room_id
    and revoked_at is null;

  if successor_user_id is not null then
    update public.room_members
    set role = 'member'
    where room_id = target_room_id
      and user_id = current_user_id
      and status = 'active'
      and role = 'owner';

    update public.room_members
    set role = 'owner'
    where room_id = target_room_id
      and user_id = successor_user_id
      and status = 'active'
      and role = 'member';
  else
    update public.rooms
    set status = 'ended', ended_at = now()
    where id = target_room_id
      and status in ('draft', 'active');

    update public.room_members
    set status = 'left', left_at = now()
    where room_id = target_room_id
      and user_id = current_user_id
      and status = 'active';
  end if;
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public;
revoke all on function public.prepare_account_deletion(uuid) from anon;
revoke all on function public.prepare_account_deletion(uuid) from authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
