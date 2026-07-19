create function public.update_active_room_settings(p_name text, p_emoji text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  current_role text;
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 20 then
    raise exception 'room_name_invalid' using errcode = '22023';
  end if;

  if normalized_emoji is not null and char_length(normalized_emoji) > 8 then
    raise exception 'room_emoji_invalid' using errcode = '22023';
  end if;

  select membership.room_id, membership.role
  into target_room_id, current_role
  from public.room_members as membership
  where membership.user_id = current_user_id
    and membership.status = 'active'
  for update;

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  if current_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  update public.rooms as room
  set name = normalized_name,
      emoji = normalized_emoji
  where room.id = target_room_id
    and room.status in ('draft', 'active');

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.update_active_room_settings(text, text) from public;
revoke all on function public.update_active_room_settings(text, text) from anon;
grant execute on function public.update_active_room_settings(text, text) to authenticated;

create function public.revoke_active_room_invites()
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
  where membership.user_id = current_user_id
    and membership.status = 'active'
  for update;

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  if current_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  perform 1
  from public.room_invites as invite
  where invite.room_id = target_room_id
    and invite.revoked_at is null
  for update;

  if not exists (
    select 1
    from public.rooms as room
    where room.id = target_room_id
      and room.status in ('draft', 'active')
    for update
  ) then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  update public.room_invites
  set revoked_at = now()
  where room_id = target_room_id
    and revoked_at is null;
end;
$$;

revoke all on function public.revoke_active_room_invites() from public;
revoke all on function public.revoke_active_room_invites() from anon;
grant execute on function public.revoke_active_room_invites() to authenticated;

create function public.create_active_room_invite()
returns table (
  invite_code text,
  invite_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  current_role text;
  max_member_count smallint;
  active_member_count integer;
  generated_code text;
  invite_token text;
  created_invite_id uuid;
  expires_at timestamptz := now() + interval '24 hours';
  remaining_uses smallint;
  attempt integer;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.room_id, membership.role
  into target_room_id, current_role
  from public.room_members as membership
  where membership.user_id = current_user_id
    and membership.status = 'active'
  for update;

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  if current_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  perform 1
  from public.room_invites as invite
  where invite.room_id = target_room_id
    and invite.revoked_at is null
  for update;

  select room.max_members
  into max_member_count
  from public.rooms as room
  where room.id = target_room_id
    and room.status in ('draft', 'active')
  for update;

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  select count(*)::integer
  into active_member_count
  from public.room_members as membership
  where membership.room_id = target_room_id
    and membership.status = 'active';

  if active_member_count >= max_member_count then
    raise exception 'room_member_limit_reached' using errcode = 'P0001';
  end if;

  update public.room_invites
  set revoked_at = now()
  where room_id = target_room_id
    and revoked_at is null;

  remaining_uses := least(5, max_member_count - active_member_count)::smallint;

  for attempt in 1..50 loop
    generated_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');

    if exists (
      select 1
      from public.room_invites as invite
      where invite.display_code = generated_code
    ) then
      continue;
    end if;

    invite_token := encode(extensions.gen_random_bytes(32), 'hex');

    begin
      insert into public.room_invites (room_id, inviter_id, token_hash, display_code, expires_at, max_uses)
      values (
        target_room_id,
        current_user_id,
        encode(extensions.digest(invite_token, 'sha256'), 'hex'),
        generated_code,
        expires_at,
        remaining_uses
      )
      returning id into created_invite_id;
      exit;
    exception when unique_violation then
      created_invite_id := null;
    end;
  end loop;

  if created_invite_id is null then
    raise exception 'invite_code_generation_failed' using errcode = 'P0001';
  end if;

  return query select generated_code, expires_at;
end;
$$;

revoke all on function public.create_active_room_invite() from public;
revoke all on function public.create_active_room_invite() from anon;
grant execute on function public.create_active_room_invite() to authenticated;
