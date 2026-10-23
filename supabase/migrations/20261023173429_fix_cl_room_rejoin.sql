-- FR-ROOM-001/003/005/007/009. Update only Color Log's admission RPC.
-- Keep membership rows, invite acceptance history, personal entries and photos.
begin;
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('colorlog:install', 0));

create or replace function public.cl_join_room_by_code(p_display_code text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  target_invite public.cl_room_invites%rowtype;
  target_room public.cl_rooms%rowtype;
  active_member_count integer;
  today_date date;
  today_entry_id uuid;
begin
  if current_user_id is null
    or coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'false' then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Serialize admissions for this user, including concurrent joins to other rooms.
  perform public.cl_assert_active_room_capacity(current_user_id);

  -- Find the room without locking the invite first. Room management locks the
  -- room before rotating/revoking invites; admission follows the same order.
  select invite.room_id into target_room_id
  from public.cl_room_invites invite
  where invite.display_code = btrim(coalesce(p_display_code, ''));
  if not found then
    raise exception 'room_invite_not_available' using errcode = 'P0001';
  end if;

  select room.* into target_room
  from public.cl_rooms room
  where room.id = target_room_id and room.status in ('draft', 'active')
  for update;
  if not found then
    raise exception 'room_not_available' using errcode = 'P0001';
  end if;

  -- Recheck validity AFTER acquiring the room lock: a concurrent kick/rotation
  -- may have revoked this code while admission waited.
  select invite.* into target_invite
  from public.cl_room_invites invite
  where invite.room_id = target_room.id
    and invite.display_code = btrim(coalesce(p_display_code, ''))
    and invite.revoked_at is null and invite.expires_at > now()
    and invite.use_count < invite.max_uses
  for update;
  if not found then
    raise exception 'room_invite_not_available' using errcode = 'P0001';
  end if;
  if target_invite.inviter_id = current_user_id then
    raise exception 'room_invite_cannot_join_self' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.cl_room_members membership
    where membership.room_id = target_room.id and membership.user_id = current_user_id
      and membership.status = 'active') then
    raise exception 'room_already_joined' using errcode = 'P0001';
  end if;
  -- One acceptance per person per invite remains an invariant. Rejoining needs
  -- a new invite, rather than overwriting history or silently reusing a quota.
  if exists (select 1 from public.cl_room_invite_uses acceptance
    where acceptance.invite_id = target_invite.id and acceptance.user_id = current_user_id) then
    raise exception 'room_invite_already_used' using errcode = 'P0001';
  end if;

  select count(*)::integer into active_member_count
  from public.cl_room_members membership
  where membership.room_id = target_room.id and membership.status = 'active';
  if active_member_count >= target_room.max_members then
    raise exception 'room_member_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.cl_room_members as membership (room_id, user_id, role, status, joined_at, left_at)
  values (target_room.id, current_user_id, 'member', 'active', now(), null)
  on conflict on constraint cl_room_members_pkey do update
    set role = 'member', status = 'active', joined_at = excluded.joined_at, left_at = null
    where membership.status in ('left', 'removed');
  if not found then
    raise exception 'room_already_joined' using errcode = 'P0001';
  end if;

  update public.cl_rooms set status = 'active' where id = target_room.id;
  update public.cl_room_invites set use_count = use_count + 1 where id = target_invite.id;
  insert into public.cl_room_invite_uses (invite_id, user_id) values (target_invite.id, current_user_id);

  today_date := cl_private.current_date_in_time_zone(target_room.timezone);
  perform public.cl_ensure_room_daily_mission(target_room.id, today_date);
  select entry.id into today_entry_id from public.cl_daily_entries entry
    where entry.user_id = current_user_id and entry.date_key = today_date;
  if today_entry_id is not null then
    perform public.cl_share_entry_to_active_room(today_entry_id);
  end if;
  return target_room.id;
end;
$$;

revoke all on function public.cl_join_room_by_code(text) from public, anon, authenticated, service_role;
grant execute on function public.cl_join_room_by_code(text) to authenticated;
insert into cl_private.schema_migrations(version) values ('20261023173429');
commit;
