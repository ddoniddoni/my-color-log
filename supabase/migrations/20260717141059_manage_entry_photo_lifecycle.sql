-- A deferred constraint lets an owned photo set be reordered atomically without
-- exposing an intermediate duplicate position to readers.
alter table public.entry_photos
drop constraint entry_photos_entry_position_key;

alter table public.entry_photos
add constraint entry_photos_entry_position_key
unique (entry_id, position)
deferrable initially immediate;

create function public.delete_my_entry_photo(p_photo_id uuid)
returns table (storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Returning no row is intentional: it makes a cancelled local upload
  -- converge even if its server row was never created (or was already removed).
  return query
  delete from public.entry_photos as photo
  where photo.id = p_photo_id
    and photo.owner_id = current_user_id
  returning photo.storage_path;
end;
$$;

revoke all on function public.delete_my_entry_photo(uuid) from public;
revoke all on function public.delete_my_entry_photo(uuid) from anon;
revoke all on function public.delete_my_entry_photo(uuid) from authenticated;
grant execute on function public.delete_my_entry_photo(uuid) to authenticated;

create function public.reorder_my_entry_photos(
  p_photo_ids uuid[],
  p_positions integer[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  requested_count integer := coalesce(cardinality(p_photo_ids), 0);
  selected_count integer;
  entry_photo_count integer;
  selected_entry_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if requested_count = 0 or requested_count <> coalesce(cardinality(p_positions), 0) then
    raise exception 'invalid_photo_reorder_request' using errcode = '22023';
  end if;

  if (select count(distinct requested.photo_id) from unnest(p_photo_ids) as requested(photo_id)) <> requested_count
    or (select count(distinct requested.position) from unnest(p_positions) as requested(position)) <> requested_count
    or exists (
      select 1
      from unnest(p_positions) as requested(position)
      where requested.position < 1 or requested.position > 9
    ) then
    raise exception 'invalid_photo_reorder_request' using errcode = '22023';
  end if;

  select count(*), min(photo.entry_id)
  into selected_count, selected_entry_id
  from public.entry_photos as photo
  where photo.id = any(p_photo_ids)
    and photo.owner_id = current_user_id;

  if selected_count <> requested_count
    or (
      select count(distinct photo.entry_id)
      from public.entry_photos as photo
      where photo.id = any(p_photo_ids)
        and photo.owner_id = current_user_id
    ) <> 1 then
    raise exception 'photo_reorder_not_allowed' using errcode = '42501';
  end if;

  select count(*)
  into entry_photo_count
  from public.entry_photos as photo
  where photo.entry_id = selected_entry_id
    and photo.owner_id = current_user_id;

  if entry_photo_count <> requested_count then
    raise exception 'photo_reorder_requires_complete_entry' using errcode = '22023';
  end if;

  set constraints public.entry_photos_entry_position_key deferred;

  with requested as (
    select
      item.photo_id,
      item.position
    from unnest(p_photo_ids, p_positions) as item(photo_id, position)
  )
  update public.entry_photos as photo
  set position = requested.position::smallint
  from requested
  where photo.id = requested.photo_id
    and photo.owner_id = current_user_id;
end;
$$;

revoke all on function public.reorder_my_entry_photos(uuid[], integer[]) from public;
revoke all on function public.reorder_my_entry_photos(uuid[], integer[]) from anon;
revoke all on function public.reorder_my_entry_photos(uuid[], integer[]) from authenticated;
grant execute on function public.reorder_my_entry_photos(uuid[], integer[]) to authenticated;
