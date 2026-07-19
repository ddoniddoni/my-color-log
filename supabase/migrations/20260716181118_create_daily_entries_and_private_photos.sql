alter table public.daily_missions
add constraint daily_missions_id_challenge_date_key unique (id, challenge_date);

create table public.daily_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null,
  date_key date not null,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_entries_mission_date_fkey
    foreign key (mission_id, date_key)
    references public.daily_missions(id, challenge_date),
  constraint daily_entries_user_date_key unique (user_id, date_key),
  constraint daily_entries_id_user_date_key unique (id, user_id, date_key)
);

create table public.entry_photos (
  id uuid primary key,
  entry_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  date_key date not null,
  storage_path text not null unique,
  position smallint not null check (position between 1 and 9),
  caption text check (caption is null or char_length(caption) <= 80),
  captured_at timestamptz not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  byte_size bigint not null check (byte_size > 0),
  created_at timestamptz not null default now(),
  constraint entry_photos_entry_owner_date_fkey
    foreign key (entry_id, owner_id, date_key)
    references public.daily_entries(id, user_id, date_key)
    on delete cascade,
  constraint entry_photos_storage_owner_check
    check (split_part(storage_path, '/', 1) = owner_id::text),
  constraint entry_photos_entry_position_key unique (entry_id, position)
);

create index daily_entries_mission_id_idx on public.daily_entries (mission_id);
create index entry_photos_owner_date_idx on public.entry_photos (owner_id, date_key);

alter table public.daily_entries enable row level security;
alter table public.entry_photos enable row level security;

grant select, insert, update, delete on public.daily_entries to authenticated;
grant select, insert, update, delete on public.entry_photos to authenticated;

create policy "daily_entries_select_own"
on public.daily_entries
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "daily_entries_insert_own"
on public.daily_entries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "daily_entries_update_own"
on public.daily_entries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "daily_entries_delete_own"
on public.daily_entries
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "entry_photos_select_own"
on public.entry_photos
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "entry_photos_insert_own"
on public.entry_photos
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "entry_photos_update_own"
on public.entry_photos
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "entry_photos_delete_own"
on public.entry_photos
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create function public.set_daily_entries_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_daily_entries_updated_at() from public;
revoke all on function public.set_daily_entries_updated_at() from anon;
revoke all on function public.set_daily_entries_updated_at() from authenticated;

create trigger daily_entries_set_updated_at
before update on public.daily_entries
for each row
execute function public.set_daily_entries_updated_at();

create function public.get_or_create_daily_entry(
  p_entry_id uuid,
  p_mission_id uuid,
  p_date_key date
)
returns table (
  id uuid,
  user_id uuid,
  mission_id uuid,
  date_key date,
  note text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_date_key > (now() at time zone 'Asia/Seoul')::date then
    raise exception 'Future daily entries cannot be created';
  end if;

  insert into public.daily_entries (id, user_id, mission_id, date_key)
  values (p_entry_id, current_user_id, p_mission_id, p_date_key)
  on conflict (user_id, date_key) do nothing;

  if not exists (
    select 1
    from public.daily_entries as existing_entry
    where existing_entry.user_id = current_user_id
      and existing_entry.date_key = p_date_key
      and existing_entry.mission_id = p_mission_id
  ) then
    raise exception 'The entry mission does not match the daily mission';
  end if;

  return query
  select
    entry.id,
    entry.user_id,
    entry.mission_id,
    entry.date_key,
    entry.note,
    entry.created_at,
    entry.updated_at
  from public.daily_entries as entry
  where entry.user_id = current_user_id
    and entry.date_key = p_date_key;
end;
$$;

revoke all on function public.get_or_create_daily_entry(uuid, uuid, date) from public;
revoke all on function public.get_or_create_daily_entry(uuid, uuid, date) from anon;
revoke all on function public.get_or_create_daily_entry(uuid, uuid, date) from authenticated;
grant execute on function public.get_or_create_daily_entry(uuid, uuid, date) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entry-photos', 'entry-photos', false, 8388608, array['image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "entry_photos_storage_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'entry-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "entry_photos_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'entry-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "entry_photos_storage_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'entry-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'entry-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "entry_photos_storage_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'entry-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
