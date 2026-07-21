-- Keep the original diary RPC stable for older app versions while exposing
-- historical share metadata to clients that understand the v2 response.
create or replace function public.get_diary_month_v2(p_month_start date)
returns table (
  entry_id uuid,
  mission_id uuid,
  date_key date,
  note text,
  color_id uuid,
  color_slug text,
  color_name_ko text,
  color_name_en text,
  color_hex text,
  color_tint_hex text,
  color_shade_hex text,
  color_on_color_hex text,
  shared_rooms jsonb,
  photo_id uuid,
  storage_path text,
  photo_position smallint,
  photo_caption text,
  captured_at timestamptz,
  width integer,
  height integer,
  byte_size bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    entry.id as entry_id,
    entry.mission_id,
    entry.date_key,
    entry.note,
    palette.id as color_id,
    palette.slug as color_slug,
    palette.name_ko as color_name_ko,
    palette.name_en as color_name_en,
    palette.hex as color_hex,
    palette.tint_hex as color_tint_hex,
    palette.shade_hex as color_shade_hex,
    palette.on_color_hex as color_on_color_hex,
    coalesce(shared_room_list.items, '[]'::jsonb) as shared_rooms,
    photo.id as photo_id,
    photo.storage_path,
    photo.position as photo_position,
    photo.caption as photo_caption,
    photo.captured_at,
    photo.width,
    photo.height,
    photo.byte_size
  from public.daily_entries as entry
  join public.daily_missions as mission
    on mission.id = entry.mission_id
    and mission.challenge_date = entry.date_key
  join public.color_palette as palette
    on palette.id = mission.color_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', room.id,
        'name', room.name,
        'emoji', room.emoji,
        'can_open',
          share.revoked_at is null
          and room.status in ('draft', 'active')
          and exists (
            select 1
            from public.room_members as membership
            where membership.room_id = room.id
              and membership.user_id = (select auth.uid())
              and membership.status = 'active'
              and (membership.joined_at at time zone 'Asia/Seoul')::date <= entry.date_key
          )
      )
      order by share.shared_at, room.id
    ) as items
    from public.entry_room_shares as share
    join public.rooms as room on room.id = share.room_id
    where share.entry_id = entry.id
      and share.shared_by = (select auth.uid())
  ) as shared_room_list on true
  left join public.entry_photos as photo
    on photo.entry_id = entry.id
  where entry.user_id = (select auth.uid())
    and (select auth.uid()) is not null
    and entry.date_key >= p_month_start
    and entry.date_key < (p_month_start + interval '1 month')::date
  order by entry.date_key desc, photo.position asc nulls last;
$$;

revoke all on function public.get_diary_month_v2(date) from public;
revoke all on function public.get_diary_month_v2(date) from anon;
revoke all on function public.get_diary_month_v2(date) from authenticated;
grant execute on function public.get_diary_month_v2(date) to authenticated;

-- Deleting a photo also compacts the remaining positions, so every diary and
-- room mosaic keeps a contiguous 1..9 ordering without a client-side repair.
create or replace function public.delete_my_entry_photo(p_photo_id uuid)
returns table (storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  deleted_entry_id uuid;
  deleted_position smallint;
  deleted_storage_path text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select photo.entry_id
  into deleted_entry_id
  from public.entry_photos as photo
  where photo.id = p_photo_id
    and photo.owner_id = current_user_id;

  if not found then
    return;
  end if;

  perform photo.id
  from public.entry_photos as photo
  where photo.entry_id = deleted_entry_id
    and photo.owner_id = current_user_id
  order by photo.position
  for update;

  select photo.position, photo.storage_path
  into deleted_position, deleted_storage_path
  from public.entry_photos as photo
  where photo.id = p_photo_id
    and photo.owner_id = current_user_id;

  if not found then
    return;
  end if;

  set constraints public.entry_photos_entry_position_key deferred;

  delete from public.entry_photos as photo
  where photo.id = p_photo_id
    and photo.owner_id = current_user_id;

  update public.entry_photos as photo
  set position = photo.position - 1
  where photo.entry_id = deleted_entry_id
    and photo.owner_id = current_user_id
    and photo.position > deleted_position;

  return query select deleted_storage_path;
end;
$$;

revoke all on function public.delete_my_entry_photo(uuid) from public;
revoke all on function public.delete_my_entry_photo(uuid) from anon;
revoke all on function public.delete_my_entry_photo(uuid) from authenticated;
grant execute on function public.delete_my_entry_photo(uuid) to authenticated;
