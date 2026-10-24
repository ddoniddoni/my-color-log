-- FR-ROOM-011: private, permission-checked report intake only.
-- No photo copies, automatic sanctions, push/email, or changes to shared Auth.
begin;
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('colorlog:install', 0));

create table public.cl_room_reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.cl_rooms(id) on delete cascade,
  reporter_id uuid not null references public.cl_profiles(id) on delete cascade,
  reported_user_id uuid not null references public.cl_profiles(id) on delete cascade,
  target_type text not null check (target_type in ('photo', 'member')),
  photo_id uuid references public.cl_entry_photos(id) on delete cascade,
  reason text not null check (reason in ('inappropriate', 'harassment', 'privacy', 'illegal', 'spam', 'other')),
  details text check (details is null or char_length(details) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint cl_room_reports_target_check check ((target_type = 'photo' and photo_id is not null) or (target_type = 'member' and photo_id is null)),
  constraint cl_room_reports_other_details_check check (reason <> 'other' or (details is not null and details ~ '[^[:space:]]')),
  constraint cl_room_reports_not_self_check check (reporter_id <> reported_user_id)
);
alter table public.cl_room_reports enable row level security;
-- There are intentionally no client policies. Receipts are returned by the RPC,
-- and the actual reports are readable only through trusted operator access.
revoke all on public.cl_room_reports from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.cl_room_reports to service_role;

create unique index cl_room_reports_photo_unique on public.cl_room_reports(reporter_id, room_id, photo_id) where target_type = 'photo';
create unique index cl_room_reports_member_unique on public.cl_room_reports(reporter_id, room_id, reported_user_id) where target_type = 'member';
create index cl_room_reports_reporter_time_idx on public.cl_room_reports(reporter_id, created_at);
create index cl_room_reports_room_idx on public.cl_room_reports(room_id);
create index cl_room_reports_subject_idx on public.cl_room_reports(reported_user_id);
create index cl_room_reports_photo_idx on public.cl_room_reports(photo_id) where photo_id is not null;
create index cl_room_reports_status_time_idx on public.cl_room_reports(status, created_at);

create function cl_private.submit_room_report(p_room_id uuid, p_target_type text, p_target_id uuid, p_reason text, p_details text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  session_id_value uuid := nullif((select auth.jwt())->>'session_id', '')::uuid;
  subject uuid;
  photo uuid;
  receipt uuid;
  normalized_details text := nullif(btrim(p_details, E' \t\n\r\f'), '');
begin
  if actor is null or coalesce((select auth.jwt())->>'is_anonymous', 'false') <> 'false'
    or session_id_value is null or not exists (
      select 1 from auth.sessions s where s.id = session_id_value and s.user_id = actor
        and (s.not_after is null or s.not_after > now())
    ) then raise exception 'authentication_required' using errcode = '42501'; end if;

  if p_room_id is null or p_target_id is null or p_target_type is null or p_target_type not in ('photo', 'member')
    or p_reason is null or p_reason not in ('inappropriate', 'harassment', 'privacy', 'illegal', 'spam', 'other')
    or char_length(coalesce(normalized_details, '')) > 500
    or (p_reason = 'other' and (normalized_details is null or normalized_details !~ '[^[:space:]]')) then
    raise exception 'room_report_invalid_input' using errcode = '22023';
  end if;

  -- Serialize this reporter's retries and rate checks across rooms.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('colorlog:report:' || actor::text, 0));
  if p_target_type = 'photo' then
    select p.owner_id, p.id into subject, photo
    from public.cl_entry_photos p
    join public.cl_daily_entries e on e.id = p.entry_id and e.user_id = p.owner_id
    join public.cl_entry_room_shares share on share.entry_id = e.id and share.room_id = p_room_id and share.revoked_at is null
    join public.cl_room_daily_missions mission on mission.room_id = p_room_id and mission.challenge_date = e.date_key and mission.mission_id = e.mission_id
    join public.cl_room_members author on author.room_id = p_room_id and author.user_id = p.owner_id and author.status = 'active'
    where p.id = p_target_id and cl_private.can_view_room_day(p_room_id, e.date_key);
  else
    select m.user_id into subject from public.cl_room_members m
    where m.room_id = p_room_id and m.user_id = p_target_id and m.status = 'active'
      and cl_private.has_active_room_membership(p_room_id);
  end if;
  if subject is null or subject = actor then
    raise exception 'room_report_not_available' using errcode = '42501';
  end if;

  select r.id into receipt from public.cl_room_reports r
  where r.reporter_id = actor and r.room_id = p_room_id and r.target_type = p_target_type
    and ((p_target_type = 'photo' and r.photo_id = photo) or (p_target_type = 'member' and r.reported_user_id = subject));
  if found then return jsonb_build_object('report_id', receipt, 'already_submitted', true); end if;
  if (select count(*) from public.cl_room_reports r where r.reporter_id = actor and r.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'room_report_rate_limited' using errcode = 'P0001';
  end if;

  insert into public.cl_room_reports(room_id, reporter_id, reported_user_id, target_type, photo_id, reason, details)
  values(p_room_id, actor, subject, p_target_type, photo, p_reason, normalized_details)
  returning id into receipt;
  return jsonb_build_object('report_id', receipt, 'already_submitted', false);
end;
$$;
revoke all on function cl_private.submit_room_report(uuid, text, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function cl_private.submit_room_report(uuid, text, uuid, text, text) to authenticated;

-- Expose only an invoker wrapper; the private implementation authenticates and
-- authorizes every call. Neither route accepts reporter IDs, status, or timestamps.
create function public.cl_submit_room_report(p_room_id uuid, p_target_type text, p_target_id uuid, p_reason text, p_details text default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select cl_private.submit_room_report(p_room_id, p_target_type, p_target_id, p_reason, p_details);
$$;
revoke all on function public.cl_submit_room_report(uuid, text, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.cl_submit_room_report(uuid, text, uuid, text, text) to authenticated;

insert into cl_private.schema_migrations(version) values ('20261024174731');
commit;
