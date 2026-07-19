-- Keep rows used by past daily missions intact. Only the active pool for
-- future missions is replaced with easier-to-find everyday color families.
insert into public.color_palette (
  slug,
  name_ko,
  name_en,
  hex,
  tint_hex,
  shade_hex,
  on_color_hex,
  prompt_ko,
  is_active
)
values
  ('tomato-red', '토마토 레드', 'Tomato Red', '#E53935', '#FDE8E7', '#A91F1C', '#FFFFFF', '오늘 스쳐 간 또렷한 빨강을 찾아보세요.', true),
  ('coral-pink', '코랄 핑크', 'Coral Pink', '#F06278', '#FDE8EC', '#B83B50', '#1D1C1A', '따뜻하게 물든 코랄빛을 찾아보세요.', true),
  ('tangerine-orange', '탠저린 오렌지', 'Tangerine Orange', '#F57C00', '#FFF0DF', '#A85000', '#1D1C1A', '일상에서 반짝이는 귤빛을 찾아보세요.', true),
  ('lemon-yellow', '레몬 옐로', 'Lemon Yellow', '#FDD835', '#FFF9D8', '#A98400', '#1D1C1A', '햇살처럼 밝은 노랑을 찾아보세요.', true),
  ('lime-green', '라임 그린', 'Lime Green', '#8BC34A', '#EEF8DF', '#568C18', '#1D1C1A', '싱그러운 연두빛을 찾아보세요.', true),
  ('leaf-green', '리프 그린', 'Leaf Green', '#43A047', '#E5F4E6', '#246D2A', '#FFFFFF', '오늘 곁의 선명한 초록을 찾아보세요.', true),
  ('mint-green', '민트 그린', 'Mint Green', '#26A69A', '#DFF5F2', '#117268', '#1D1C1A', '시원하게 보이는 민트빛을 찾아보세요.', true),
  ('sky-blue', '스카이 블루', 'Sky Blue', '#29B6F6', '#DDF4FF', '#087EBC', '#1D1C1A', '맑고 가벼운 하늘빛을 찾아보세요.', true),
  ('clear-blue', '클리어 블루', 'Clear Blue', '#1976D2', '#E1EEFB', '#0D4F96', '#FFFFFF', '눈에 또렷한 파랑을 찾아보세요.', true),
  ('rose-pink', '로즈 핑크', 'Rose Pink', '#EC407A', '#FCE5ED', '#B91F56', '#FFFFFF', '기분 좋게 눈에 들어온 분홍을 찾아보세요.', true)
on conflict (slug) do update
set
  name_ko = excluded.name_ko,
  name_en = excluded.name_en,
  hex = excluded.hex,
  tint_hex = excluded.tint_hex,
  shade_hex = excluded.shade_hex,
  on_color_hex = excluded.on_color_hex,
  prompt_ko = excluded.prompt_ko,
  is_active = true;

update public.color_palette
set is_active = false
where slug not in (
  'tomato-red',
  'coral-pink',
  'tangerine-orange',
  'lemon-yellow',
  'lime-green',
  'leaf-green',
  'mint-green',
  'sky-blue',
  'clear-blue',
  'rose-pink'
);

create or replace function public.get_mission_reveal_palette(p_challenge_date date default null)
returns table (
  wheel_position integer,
  color_id uuid,
  color_slug text,
  color_name_ko text,
  color_name_en text,
  color_hex text,
  color_on_color_hex text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_date date := coalesce(p_challenge_date, (now() at time zone 'Asia/Seoul')::date);
  target_color_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if target_date > (now() at time zone 'Asia/Seoul')::date then
    raise exception 'Future mission reveal palettes cannot be created';
  end if;

  select mission.color_id
  into target_color_id
  from public.daily_missions as mission
  where mission.challenge_date = target_date;

  if target_color_id is null then
    perform public.get_daily_mission(target_date);

    select mission.color_id
    into target_color_id
    from public.daily_missions as mission
    where mission.challenge_date = target_date;
  end if;

  if target_color_id is null then
    raise exception 'Daily mission is missing';
  end if;

  if (select count(*) from public.color_palette where is_active) < 10 then
    raise exception 'At least ten active colors are required';
  end if;

  return query
  with target_color as (
    select palette.id, palette.slug, palette.name_ko, palette.name_en, palette.hex, palette.on_color_hex
    from public.color_palette as palette
    where palette.id = target_color_id
  ),
  decoys as (
    select palette.id, palette.slug, palette.name_ko, palette.name_en, palette.hex, palette.on_color_hex
    from public.color_palette as palette
    where palette.is_active
      and palette.id <> target_color_id
    order by md5(target_date::text || ':' || palette.slug)
    limit 9
  ),
  wheel_colors as (
    select 0 as wheel_position, * from target_color
    union all
    select row_number() over (order by decoys.slug)::integer as wheel_position, * from decoys
  )
  select
    wheel_colors.wheel_position,
    wheel_colors.id,
    wheel_colors.slug,
    wheel_colors.name_ko,
    wheel_colors.name_en,
    wheel_colors.hex,
    wheel_colors.on_color_hex
  from wheel_colors
  order by wheel_colors.wheel_position;
end;
$$;

revoke all on function public.get_mission_reveal_palette(date) from public;
revoke all on function public.get_mission_reveal_palette(date) from anon;
revoke all on function public.get_mission_reveal_palette(date) from authenticated;
grant execute on function public.get_mission_reveal_palette(date) to authenticated;
