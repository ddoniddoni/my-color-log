create or replace function public.get_daily_mission(p_challenge_date date default null)
returns table (
  id uuid,
  challenge_date date,
  mission_type text,
  title_ko text,
  prompt_ko text,
  published_at timestamptz,
  source text,
  color_id uuid,
  color_slug text,
  color_name_ko text,
  color_name_en text,
  color_hex text,
  color_tint_hex text,
  color_shade_hex text,
  color_on_color_hex text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_date date := coalesce(p_challenge_date, (now() at time zone 'Asia/Seoul')::date);
  active_color_count integer;
  selected_color public.color_palette%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if target_date > (now() at time zone 'Asia/Seoul')::date then
    raise exception 'Future daily missions cannot be created';
  end if;

  select count(*) into active_color_count
  from public.color_palette
  where is_active;

  if active_color_count = 0 then
    raise exception 'No active colors are available';
  end if;

  select * into selected_color
  from public.color_palette
  where is_active
  order by slug
  offset (('x' || substr(md5(target_date::text), 1, 4))::bit(16)::integer % active_color_count)
  limit 1;

  insert into public.daily_missions (challenge_date, mission_type, color_id, title_ko, prompt_ko, source)
  values (
    target_date,
    'color',
    selected_color.id,
    format('오늘의 %s', selected_color.name_ko),
    selected_color.prompt_ko,
    'scheduled'
  )
  on conflict do nothing;

  return query
  select
    mission.id,
    mission.challenge_date,
    mission.mission_type,
    mission.title_ko,
    mission.prompt_ko,
    mission.published_at,
    mission.source,
    palette.id,
    palette.slug,
    palette.name_ko,
    palette.name_en,
    palette.hex,
    palette.tint_hex,
    palette.shade_hex,
    palette.on_color_hex
  from public.daily_missions as mission
  join public.color_palette as palette on palette.id = mission.color_id
  where mission.challenge_date = target_date;
end;
$$;

revoke all on function public.get_daily_mission(date) from public;
revoke all on function public.get_daily_mission(date) from anon;
revoke all on function public.get_daily_mission(date) from authenticated;
grant execute on function public.get_daily_mission(date) to authenticated;
