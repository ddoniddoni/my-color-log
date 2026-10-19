-- The global-timezone migration recreated public helpers after RLS had moved
-- to private helpers. Update the functions the policies actually call.
-- Dates already stored on entries and photos are intentionally unchanged.
create or replace function private.can_view_room_day(p_room_id uuid, p_date_key date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.room_members as membership
      join public.rooms as room
        on room.id = membership.room_id
        and room.status in ('draft', 'active')
      where membership.room_id = p_room_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and (membership.joined_at at time zone room.timezone)::date <= p_date_key
        and p_date_key <= private.current_date_in_time_zone(room.timezone)
    );
$$;

-- Share and Storage reads use the same room-day boundary so the three RLS
-- surfaces cannot drift back to different time zones.
create or replace function private.can_view_shared_entry(p_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.entry_room_shares as share
      join public.daily_entries as entry on entry.id = share.entry_id
      where share.entry_id = p_entry_id
        and share.revoked_at is null
        and private.can_view_room_day(share.room_id, entry.date_key)
    );
$$;

create or replace function private.can_view_shared_storage_path(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.entry_photos as photo
      where photo.storage_path = p_storage_path
        and private.can_view_shared_entry(photo.entry_id)
    );
$$;

revoke all on function private.can_view_room_day(uuid, date) from public, anon;
revoke all on function private.can_view_shared_entry(uuid) from public, anon;
revoke all on function private.can_view_shared_storage_path(text) from public, anon;
grant execute on function private.can_view_room_day(uuid, date) to authenticated;
grant execute on function private.can_view_shared_entry(uuid) to authenticated;
grant execute on function private.can_view_shared_storage_path(text) to authenticated;

-- These duplicate RPCs have no app callers or policy dependencies. Keep the
-- authorization helpers only in private. RESTRICT (the default) deliberately
-- fails instead of cascading if a deployment has an unexpected dependency.
drop function public.can_view_room_day(uuid, date);
drop function public.can_view_shared_entry(uuid);
drop function public.can_view_shared_storage_path(text);
