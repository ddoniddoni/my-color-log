-- Older projects may still inherit broad Data API grants from legacy default
-- privileges. Keep RLS as the row boundary and also restrict each API role to
-- the table operations the mobile client actually uses.
revoke all privileges on table
  public.color_palette,
  public.daily_entries,
  public.daily_missions,
  public.entry_photos,
  public.entry_room_shares,
  public.profiles,
  public.push_devices,
  public.room_daily_missions,
  public.room_invite_uses,
  public.room_invites,
  public.room_members,
  public.room_photo_push_deliveries,
  public.room_photo_reactions,
  public.rooms
from anon, authenticated;

grant select, insert, update
on table public.profiles
to authenticated;

grant select, insert, update, delete
on table public.daily_entries, public.entry_photos
to authenticated;

grant select
on table
  public.entry_room_shares,
  public.push_devices,
  public.room_daily_missions,
  public.room_members,
  public.room_photo_reactions,
  public.rooms
to authenticated;

-- Trigger functions are not client RPCs.
revoke all on function public.set_profiles_updated_at() from public, anon, authenticated;

-- Match the current Supabase default for future objects: new tables and
-- functions are private until a migration grants an explicit API surface.
alter default privileges for role postgres in schema public
revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
revoke execute on functions from public, anon, authenticated;
