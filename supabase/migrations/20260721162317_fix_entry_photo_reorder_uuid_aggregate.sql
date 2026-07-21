-- PostgreSQL does not define min(uuid). Lock the selected rows in a stable
-- order, validate ownership and entry membership, then select one entry_id
-- directly instead of relying on an unsupported aggregate.
create or replace function public.reorder_my_entry_photos(
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
  selected_entry_count integer;
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

  perform photo.id
  from public.entry_photos as photo
  where photo.id = any(p_photo_ids)
    and photo.owner_id = current_user_id
  order by photo.id
  for update;

  select count(*), count(distinct photo.entry_id)
  into selected_count, selected_entry_count
  from public.entry_photos as photo
  where photo.id = any(p_photo_ids)
    and photo.owner_id = current_user_id;

  if selected_count <> requested_count or selected_entry_count <> 1 then
    raise exception 'photo_reorder_not_allowed' using errcode = '42501';
  end if;

  select photo.entry_id
  into selected_entry_id
  from public.entry_photos as photo
  where photo.id = any(p_photo_ids)
    and photo.owner_id = current_user_id
  order by photo.id
  limit 1;

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

-- Photo changes only need to wake Realtime subscribers for rooms where the
-- entry owner is still an active member. Touching stale shares from ended or
-- left rooms invokes the share validation trigger and blocks legitimate photo
-- edits such as reordering.
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

  update public.entry_room_shares as share
  set updated_at = now()
  where share.entry_id = target_entry_id
    and share.revoked_at is null
    and exists (
      select 1
      from public.room_members as membership
      join public.rooms as room
        on room.id = membership.room_id
        and room.status in ('draft', 'active')
      where membership.room_id = share.room_id
        and membership.user_id = share.shared_by
        and membership.status = 'active'
    );

  return null;
end;
$$;

revoke all on function public.touch_room_entry_shares_for_photo_change() from public;
revoke all on function public.touch_room_entry_shares_for_photo_change() from anon;
revoke all on function public.touch_room_entry_shares_for_photo_change() from authenticated;
