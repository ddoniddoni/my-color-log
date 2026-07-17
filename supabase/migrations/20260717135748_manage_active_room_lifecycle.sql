create function public.leave_active_room()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  current_role text;
  active_member_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
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

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  if current_role = 'owner' then
    raise exception 'room_owner_cannot_leave' using errcode = 'P0001';
  end if;

  update public.room_members
  set status = 'left', left_at = now()
  where room_id = target_room_id
    and user_id = current_user_id
    and status = 'active';

  select count(*)::integer
  into active_member_count
  from public.room_members as membership
  where membership.room_id = target_room_id
    and membership.status = 'active';

  if active_member_count = 0 then
    update public.rooms
    set status = 'ended', ended_at = now()
    where id = target_room_id;
  elsif active_member_count = 1 then
    update public.rooms
    set status = 'draft'
    where id = target_room_id;
  end if;
end;
$$;

revoke all on function public.leave_active_room() from public;
revoke all on function public.leave_active_room() from anon;
grant execute on function public.leave_active_room() to authenticated;

create function public.transfer_active_room_ownership(p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  current_role text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_new_owner_id is null or p_new_owner_id = current_user_id then
    raise exception 'room_owner_transfer_target_invalid' using errcode = '22023';
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

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  if current_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  perform 1
  from public.room_members as membership
  where membership.room_id = target_room_id
    and membership.status = 'active'
  for update;

  if not exists (
    select 1
    from public.room_members as membership
    where membership.room_id = target_room_id
      and membership.user_id = p_new_owner_id
      and membership.status = 'active'
  ) then
    raise exception 'room_owner_transfer_target_invalid' using errcode = '22023';
  end if;

  update public.room_members
  set role = 'member'
  where room_id = target_room_id
    and user_id = current_user_id
    and status = 'active'
    and role = 'owner';

  update public.room_members
  set role = 'owner'
  where room_id = target_room_id
    and user_id = p_new_owner_id
    and status = 'active'
    and role = 'member';
end;
$$;

revoke all on function public.transfer_active_room_ownership(uuid) from public;
revoke all on function public.transfer_active_room_ownership(uuid) from anon;
grant execute on function public.transfer_active_room_ownership(uuid) to authenticated;

create function public.end_active_room()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  current_role text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
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

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  if current_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  update public.rooms
  set status = 'ended', ended_at = now()
  where id = target_room_id;

  update public.room_members
  set status = 'left', left_at = now()
  where room_id = target_room_id
    and status = 'active';

  update public.room_invites
  set revoked_at = now()
  where room_id = target_room_id
    and revoked_at is null;
end;
$$;

revoke all on function public.end_active_room() from public;
revoke all on function public.end_active_room() from anon;
grant execute on function public.end_active_room() to authenticated;
