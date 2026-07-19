create function public.get_diary_month(p_month_start date)
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
  left join public.entry_photos as photo
    on photo.entry_id = entry.id
  where entry.user_id = (select auth.uid())
    and (select auth.uid()) is not null
    and entry.date_key >= p_month_start
    and entry.date_key < (p_month_start + interval '1 month')::date
  order by entry.date_key desc, photo.position asc nulls last;
$$;

revoke all on function public.get_diary_month(date) from public;
revoke all on function public.get_diary_month(date) from anon;
revoke all on function public.get_diary_month(date) from authenticated;
grant execute on function public.get_diary_month(date) to authenticated;
