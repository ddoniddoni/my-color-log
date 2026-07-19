create or replace function public.create_room_with_invite(p_name text, p_emoji text default null)
returns table (
  room_id uuid,
  room_name text,
  room_emoji text,
  invite_code text,
  invite_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
  created_room_id uuid;
  generated_code text;
  invite_token text;
  expires_at timestamptz := now() + interval '24 hours';
  attempt integer;
  today_date date := (now() at time zone 'Asia/Seoul')::date;
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

  if exists (
    select 1
    from public.room_members as membership
    where membership.user_id = current_user_id
      and membership.status = 'active'
  ) then
    raise exception 'active_room_already_exists' using errcode = 'P0001';
  end if;

  for attempt in 1..50 loop
    generated_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
    exit when not exists (
      select 1
      from public.room_invites as invite
      where invite.display_code = generated_code
    );
  end loop;

  if generated_code is null or exists (select 1 from public.room_invites as invite where invite.display_code = generated_code) then
    raise exception 'invite_code_generation_failed' using errcode = 'P0001';
  end if;

  insert into public.rooms (name, emoji, created_by)
  values (normalized_name, normalized_emoji, current_user_id)
  returning id into created_room_id;

  insert into public.room_members (room_id, user_id, role, status)
  values (created_room_id, current_user_id, 'owner', 'active');

  perform public.ensure_room_daily_mission(created_room_id, today_date);

  invite_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.room_invites (room_id, inviter_id, token_hash, display_code, expires_at, max_uses)
  values (
    created_room_id,
    current_user_id,
    encode(extensions.digest(invite_token, 'sha256'), 'hex'),
    generated_code,
    expires_at,
    5
  );

  insert into public.entry_room_shares (entry_id, room_id, shared_by)
  select entry.id, created_room_id, current_user_id
  from public.daily_entries as entry
  join public.room_daily_missions as room_mission
    on room_mission.room_id = created_room_id
    and room_mission.challenge_date = entry.date_key
    and room_mission.mission_id = entry.mission_id
  where entry.user_id = current_user_id
    and entry.date_key = today_date
  on conflict (entry_id, room_id) do nothing;

  return query
  select created_room_id, normalized_name, normalized_emoji, generated_code, expires_at;
end;
$$;

revoke all on function public.create_room_with_invite(text, text) from public;
revoke all on function public.create_room_with_invite(text, text) from anon;
grant execute on function public.create_room_with_invite(text, text) to authenticated;
