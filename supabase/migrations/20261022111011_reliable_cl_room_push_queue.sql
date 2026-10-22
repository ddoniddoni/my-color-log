-- FR-NOTIFY-002. Additive, Color Log-only outbox. No historical notifications
-- are backfilled. Existing legacy delivery markers remain as deduplication.
begin;

alter table public.cl_push_devices
  add column registration_id uuid not null default gen_random_uuid(),
  add column session_id uuid;

create table public.cl_room_push_jobs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.cl_rooms(id) on delete cascade,
  recipient_user_id uuid not null references public.cl_profiles(id) on delete cascade,
  source_user_id uuid not null references public.cl_profiles(id) on delete cascade,
  date_key date not null,
  photo_id uuid references public.cl_entry_photos(id) on delete set null,
  device_id uuid not null references public.cl_push_devices(id) on delete cascade,
  device_registration_id uuid not null,
  state text not null default 'pending' check (state in ('pending', 'awaiting_receipt', 'provider_accepted', 'failed', 'unknown', 'cancelled')),
  send_attempts integer not null default 0 check (send_attempts >= 0),
  receipt_attempts integer not null default 0 check (receipt_attempts >= 0),
  ticket_id text check (length(ticket_id) <= 256),
  ticket_created_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text check (length(last_error_code) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, recipient_user_id, source_user_id, date_key, device_id)
);
alter table public.cl_room_push_jobs enable row level security;
revoke all on public.cl_room_push_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.cl_room_push_jobs to service_role;
create index cl_room_push_jobs_due_idx on public.cl_room_push_jobs(next_attempt_at)
  where state in ('pending', 'awaiting_receipt');
create index cl_room_push_jobs_photo_idx on public.cl_room_push_jobs(photo_id);
create index cl_room_push_jobs_recipient_idx on public.cl_room_push_jobs(recipient_user_id);
create index cl_room_push_jobs_source_idx on public.cl_room_push_jobs(source_user_id);
create index cl_room_push_jobs_device_idx on public.cl_room_push_jobs(device_id);

-- Existing devices acquire a session on their next registration. Devices with
-- unknown/expired sessions cannot receive private room activity.
create or replace function public.cl_register_my_push_device(p_expo_push_token text, p_platform text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  user_id_value uuid := (select auth.uid());
  session_id_value uuid := nullif((select auth.jwt())->>'session_id', '')::uuid;
begin
  if user_id_value is null or session_id_value is null or not exists (
    select 1 from auth.sessions s where s.id = session_id_value and s.user_id = user_id_value
      and (s.not_after is null or s.not_after > now())
  ) then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_expo_push_token is null or length(p_expo_push_token) > 300
    or p_expo_push_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'
    or p_platform is null or p_platform not in ('android', 'ios') then
    raise exception 'push_device_invalid' using errcode = '22023';
  end if;
  insert into public.cl_push_devices as device (user_id, expo_push_token, platform, is_enabled, session_id)
  values (user_id_value, p_expo_push_token, p_platform, true, session_id_value)
  on conflict (expo_push_token) do update set
    registration_id = case when device.user_id <> excluded.user_id or not device.is_enabled
      or device.session_id is distinct from excluded.session_id then gen_random_uuid() else device.registration_id end,
    user_id = excluded.user_id, platform = excluded.platform, is_enabled = true,
    session_id = excluded.session_id, updated_at = now();
end;
$$;
revoke all on function public.cl_register_my_push_device(text, text) from public, anon, authenticated, service_role;
grant execute on function public.cl_register_my_push_device(text, text) to authenticated;

create function cl_private.enqueue_room_photo_push(p_photo_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare inserted integer;
begin
  insert into public.cl_room_push_jobs
    (room_id, recipient_user_id, source_user_id, date_key, photo_id, device_id, device_registration_id)
  select room.id, recipient.user_id, photo.owner_id, photo.date_key, photo.id, device.id, device.registration_id
  from public.cl_entry_photos photo
  join public.cl_daily_entries entry on entry.id = photo.entry_id and entry.user_id = photo.owner_id and entry.date_key = photo.date_key
  join public.cl_entry_room_shares share on share.entry_id = entry.id and share.revoked_at is null
  join public.cl_rooms room on room.id = share.room_id and room.status in ('draft', 'active')
  join public.cl_room_daily_missions mission on mission.room_id = room.id and mission.challenge_date = photo.date_key and mission.mission_id = entry.mission_id
  join public.cl_room_members source on source.room_id = room.id and source.user_id = photo.owner_id and source.status = 'active'
  join public.cl_room_members recipient on recipient.room_id = room.id and recipient.status = 'active' and recipient.user_id <> photo.owner_id
  join public.cl_push_devices device on device.user_id = recipient.user_id and device.is_enabled
  join auth.sessions session on session.id = device.session_id and session.user_id = device.user_id and (session.not_after is null or session.not_after > now())
  where photo.id = p_photo_id and photo.created_at >= now() - interval '24 hours'
    and photo.date_key <= cl_private.current_date_in_time_zone(room.timezone)
    and (source.joined_at at time zone room.timezone)::date <= photo.date_key
    and (recipient.joined_at at time zone room.timezone)::date <= photo.date_key
    and not exists (select 1 from public.cl_room_photo_push_deliveries old
      where old.room_id = room.id and old.recipient_user_id = recipient.user_id
        and old.source_user_id = photo.owner_id and old.date_key = photo.date_key)
  on conflict (room_id, recipient_user_id, source_user_id, date_key, device_id) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
revoke all on function cl_private.enqueue_room_photo_push(uuid) from public, anon, authenticated, service_role;

create function cl_private.queue_room_photo_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare photo record;
begin
  if tg_table_name = 'cl_entry_photos' then
    perform cl_private.enqueue_room_photo_push(new.id);
  elsif new.revoked_at is null then
    for photo in select p.id from public.cl_entry_photos p where p.entry_id = new.entry_id
      and p.created_at >= now() - interval '24 hours' order by p.position loop
      perform cl_private.enqueue_room_photo_push(photo.id);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function cl_private.queue_room_photo_push() from public, anon, authenticated, service_role;
create trigger cl_entry_photos_queue_push after insert on public.cl_entry_photos
  for each row execute function cl_private.queue_room_photo_push();
create trigger cl_entry_room_shares_queue_push after insert or update of revoked_at on public.cl_entry_room_shares
  for each row execute function cl_private.queue_room_photo_push();

-- Compatibility for installed clients calling cl-notify-room-photo. Authenticated
-- callers may enqueue only their own photo; the DB derives all recipients.
create function public.cl_enqueue_my_room_photo_push(p_photo_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.cl_entry_photos where id = p_photo_id and owner_id = (select auth.uid())
  ) then raise exception 'photo_not_available' using errcode = '42501'; end if;
  return cl_private.enqueue_room_photo_push(p_photo_id);
end;
$$;
revoke all on function public.cl_enqueue_my_room_photo_push(uuid) from public, anon, authenticated, service_role;
grant execute on function public.cl_enqueue_my_room_photo_push(uuid) to authenticated;

-- Every attempt revalidates the same room time-zone and mission boundaries as
-- shared reads. Payloads contain no URLs, captions, or credentials.
create function cl_private.room_push_payload(p_job_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('to', device.expo_push_token, 'title', room.name,
    'body', profile.nickname || ' 님이 사진을 추가했어요.',
    'data', jsonb_build_object('destination', 'room', 'roomId', room.id::text,
      'photoId', photo.id::text, 'dateKey', job.date_key::text, 'recipientUserId', job.recipient_user_id::text))
  from public.cl_room_push_jobs job
  join public.cl_entry_photos photo on photo.id = job.photo_id and photo.owner_id = job.source_user_id and photo.date_key = job.date_key
  join public.cl_daily_entries entry on entry.id = photo.entry_id and entry.user_id = job.source_user_id
  join public.cl_entry_room_shares share on share.entry_id = entry.id and share.room_id = job.room_id and share.revoked_at is null
  join public.cl_rooms room on room.id = job.room_id and room.status in ('draft', 'active')
  join public.cl_room_daily_missions mission on mission.room_id = room.id and mission.challenge_date = job.date_key and mission.mission_id = entry.mission_id
  join public.cl_profiles profile on profile.id = job.source_user_id
  join public.cl_room_members source on source.room_id = room.id and source.user_id = job.source_user_id and source.status = 'active'
  join public.cl_room_members recipient on recipient.room_id = room.id and recipient.user_id = job.recipient_user_id and recipient.status = 'active'
  join public.cl_push_devices device on device.id = job.device_id and device.user_id = job.recipient_user_id
    and device.is_enabled and device.registration_id = job.device_registration_id
  join auth.sessions session on session.id = device.session_id and session.user_id = device.user_id and (session.not_after is null or session.not_after > now())
  where job.id = p_job_id and job.expires_at > now()
    and job.date_key <= cl_private.current_date_in_time_zone(room.timezone)
    and (source.joined_at at time zone room.timezone)::date <= job.date_key
    and (recipient.joined_at at time zone room.timezone)::date <= job.date_key;
$$;
revoke all on function cl_private.room_push_payload(uuid) from public, anon, authenticated, service_role;

create function public.cl_claim_room_push_jobs(p_limit integer default 20)
returns setof public.cl_room_push_jobs language plpgsql security definer set search_path = '' as $$
begin
  -- Terminal metadata has a bounded retention period. No photo/entry is removed.
  delete from public.cl_room_push_jobs where state not in ('pending', 'awaiting_receipt') and updated_at < now() - interval '30 days';
  update public.cl_room_push_jobs set
    state = case when state = 'awaiting_receipt' then 'unknown' else 'failed' end,
    last_error_code = 'attempts_or_age_exhausted', lease_token = null, lease_until = null, updated_at = now()
  where state in ('pending', 'awaiting_receipt') and (lease_until is null or lease_until <= now())
    and (expires_at <= now() or (state = 'pending' and send_attempts >= 8) or (state = 'awaiting_receipt' and receipt_attempts >= 96));
  return query
    with candidates as (
      select id from public.cl_room_push_jobs where state in ('pending', 'awaiting_receipt')
        and next_attempt_at <= now() and (lease_until is null or lease_until <= now())
      order by next_attempt_at, id limit greatest(1, least(coalesce(p_limit, 20), 20)) for update skip locked
    )
    update public.cl_room_push_jobs job set lease_token = gen_random_uuid(), lease_until = now() + interval '3 minutes',
      send_attempts = job.send_attempts + case when job.state = 'pending' then 1 else 0 end,
      receipt_attempts = job.receipt_attempts + case when job.state = 'awaiting_receipt' then 1 else 0 end,
      updated_at = now()
    from candidates where job.id = candidates.id returning job.*;
end;
$$;
revoke all on function public.cl_claim_room_push_jobs(integer) from public, anon, authenticated, service_role;
grant execute on function public.cl_claim_room_push_jobs(integer) to service_role;

create function public.cl_get_room_push_payload(p_job_id uuid, p_lease_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select cl_private.room_push_payload(job.id) from public.cl_room_push_jobs job
  where job.id = p_job_id and job.lease_token = p_lease_token and job.lease_until > now()
    and job.state in ('pending', 'awaiting_receipt');
$$;
revoke all on function public.cl_get_room_push_payload(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.cl_get_room_push_payload(uuid, uuid) to service_role;

create function public.cl_finish_room_push_job(p_job_id uuid, p_lease_token uuid, p_state text,
  p_error_code text default null, p_ticket_id text default null, p_retry_after_seconds integer default 900,
  p_disable_device boolean default false)
returns boolean language plpgsql security definer set search_path = '' as $$
declare job public.cl_room_push_jobs%rowtype;
begin
  select * into job from public.cl_room_push_jobs where id = p_job_id and lease_token = p_lease_token
    and lease_until > now() and state in ('pending', 'awaiting_receipt') for update;
  if not found then return false; end if;
  if p_state is null or p_state not in ('pending', 'awaiting_receipt', 'provider_accepted', 'failed', 'unknown', 'cancelled')
    or (p_state = 'provider_accepted' and job.state <> 'awaiting_receipt')
    or (p_state = 'awaiting_receipt' and coalesce(p_ticket_id, job.ticket_id) is null)
    or (p_error_code is not null and p_error_code not in ('transport_error', 'invalid_response', 'request_rejected',
      'send_attempts_exhausted', 'receipt_expired', 'receipt_missing', 'DeviceNotRegistered', 'MessageRateExceeded',
      'InvalidCredentials', 'MismatchSenderId', 'MessageTooBig', 'provider_error', 'no_longer_eligible')) then
    raise exception 'push_outcome_invalid' using errcode = '22023';
  end if;
  if p_disable_device and p_error_code = 'DeviceNotRegistered' then
    update public.cl_push_devices set is_enabled = false, updated_at = now()
      where id = job.device_id and user_id = job.recipient_user_id and registration_id = job.device_registration_id;
  end if;
  update public.cl_room_push_jobs set state = p_state, last_error_code = p_error_code,
    ticket_id = case when p_state = 'pending' then null else coalesce(p_ticket_id, ticket_id) end,
    ticket_created_at = case when p_state = 'pending' then null when p_ticket_id is not null then now() else ticket_created_at end,
    next_attempt_at = now() + make_interval(secs => greatest(60, least(coalesce(p_retry_after_seconds, 900), 3600))),
    lease_token = null, lease_until = null, updated_at = now() where id = job.id;
  return true;
end;
$$;
revoke all on function public.cl_finish_room_push_job(uuid, uuid, text, text, text, integer, boolean) from public, anon, authenticated, service_role;
grant execute on function public.cl_finish_room_push_job(uuid, uuid, text, text, text, integer, boolean) to service_role;

-- No scheduler is enabled implicitly on a shared Supabase project. Configure
-- the dedicated worker secret and run operations/enable_room_push_worker.sql.
insert into cl_private.schema_migrations(version) values ('20261022111011');
commit;
