alter table public.entry_room_shares
add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_room_entry_shares_for_photo_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_entry_id uuid;
begin
  target_entry_id := case
    when tg_op = 'DELETE' then old.entry_id
    else new.entry_id
  end;

  update public.entry_room_shares
  set updated_at = now()
  where entry_id = target_entry_id
    and revoked_at is null;

  return null;
end;
$$;

revoke all on function public.touch_room_entry_shares_for_photo_change() from public;
revoke all on function public.touch_room_entry_shares_for_photo_change() from anon;
revoke all on function public.touch_room_entry_shares_for_photo_change() from authenticated;

drop trigger if exists entry_photos_touch_room_shares on public.entry_photos;

create trigger entry_photos_touch_room_shares
after insert or update or delete on public.entry_photos
for each row
execute function public.touch_room_entry_shares_for_photo_change();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'entry_room_shares'
  ) then
    alter publication supabase_realtime add table public.entry_room_shares;
  end if;
end;
$$;
