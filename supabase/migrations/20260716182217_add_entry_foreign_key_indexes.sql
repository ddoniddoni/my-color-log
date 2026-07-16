create index daily_entries_mission_date_idx
on public.daily_entries (mission_id, date_key);

create index entry_photos_entry_owner_date_idx
on public.entry_photos (entry_id, owner_id, date_key);
