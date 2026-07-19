create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

alter function public.has_active_room_membership(uuid) set schema private;
alter function public.can_view_room_day(uuid, date) set schema private;
alter function public.can_view_shared_entry(uuid) set schema private;
alter function public.can_view_shared_storage_path(text) set schema private;

revoke all on function private.has_active_room_membership(uuid) from public;
revoke all on function private.has_active_room_membership(uuid) from anon;
grant execute on function private.has_active_room_membership(uuid) to authenticated;

revoke all on function private.can_view_room_day(uuid, date) from public;
revoke all on function private.can_view_room_day(uuid, date) from anon;
grant execute on function private.can_view_room_day(uuid, date) to authenticated;

revoke all on function private.can_view_shared_entry(uuid) from public;
revoke all on function private.can_view_shared_entry(uuid) from anon;
grant execute on function private.can_view_shared_entry(uuid) to authenticated;

revoke all on function private.can_view_shared_storage_path(text) from public;
revoke all on function private.can_view_shared_storage_path(text) from anon;
grant execute on function private.can_view_shared_storage_path(text) to authenticated;

drop policy "rooms_select_active_member" on public.rooms;
drop policy "room_daily_missions_select_active_member" on public.room_daily_missions;
drop policy "entry_room_shares_select_author_or_active_member" on public.entry_room_shares;
drop policy "daily_entries_select_shared_room" on public.daily_entries;
drop policy "entry_photos_select_shared_room" on public.entry_photos;
drop policy "entry_photos_storage_select_shared_room" on storage.objects;

create policy "rooms_select_active_member"
on public.rooms
for select
to authenticated
using (private.has_active_room_membership(id));

create policy "room_daily_missions_select_active_member"
on public.room_daily_missions
for select
to authenticated
using (private.can_view_room_day(room_id, challenge_date));

create policy "entry_room_shares_select_author_or_active_member"
on public.entry_room_shares
for select
to authenticated
using (
  shared_by = (select auth.uid())
  or private.can_view_shared_entry(entry_id)
);

create policy "daily_entries_select_shared_room"
on public.daily_entries
for select
to authenticated
using (private.can_view_shared_entry(id));

create policy "entry_photos_select_shared_room"
on public.entry_photos
for select
to authenticated
using (private.can_view_shared_entry(entry_id));

create policy "entry_photos_storage_select_shared_room"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'entry-photos'
  and private.can_view_shared_storage_path(name)
);
