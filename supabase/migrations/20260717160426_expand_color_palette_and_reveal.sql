insert into public.color_palette (slug, name_ko, name_en, hex, tint_hex, shade_hex, on_color_hex, prompt_ko)
values
  ('berry-red', '베리 레드', 'Berry Red', '#C84D5C', '#F8E6E9', '#852E3A', '#FFFFFF', '오늘 곁에 있던 깊은 딸기빛을 찾아보세요.'),
  ('blush-pink', '블러시 핑크', 'Blush Pink', '#E6A0A8', '#FCEBED', '#A65E69', '#1D1C1A', '살며시 번진 연한 분홍을 찾아보세요.'),
  ('tangerine-orange', '탠저린 오렌지', 'Tangerine Orange', '#F07A38', '#FDEBDD', '#A94316', '#1D1C1A', '상큼하게 눈에 들어온 귤빛을 찾아보세요.'),
  ('lemon-yellow', '레몬 옐로', 'Lemon Yellow', '#E9CF55', '#FFF9DD', '#8A7312', '#1D1C1A', '햇빛처럼 산뜻한 노랑을 찾아보세요.'),
  ('mint-green', '민트 그린', 'Mint Green', '#78BFA2', '#E5F4ED', '#3F8065', '#1D1C1A', '시원하고 가벼운 민트빛을 찾아보세요.'),
  ('sage-green', '세이지 그린', 'Sage Green', '#8EA77D', '#EDF2E9', '#536945', '#1D1C1A', '차분하게 바랜 초록을 찾아보세요.'),
  ('olive-green', '올리브 그린', 'Olive Green', '#849143', '#F0F2DF', '#4D591B', '#FFFFFF', '노란 기운이 감도는 초록을 찾아보세요.'),
  ('ocean-blue', '오션 블루', 'Ocean Blue', '#3F86A8', '#E1F1F6', '#205E7B', '#FFFFFF', '짙고 시원한 바다빛을 찾아보세요.'),
  ('denim-blue', '데님 블루', 'Denim Blue', '#52729B', '#E6ECF4', '#2F4B70', '#FFFFFF', '일상에 닿아 있는 청색을 찾아보세요.'),
  ('lavender-purple', '라벤더 퍼플', 'Lavender Purple', '#B194C4', '#F4EEF7', '#70517F', '#1D1C1A', '부드럽게 번진 연보라를 찾아보세요.'),
  ('plum-purple', '플럼 퍼플', 'Plum Purple', '#744E77', '#F0E7F0', '#432D48', '#FFFFFF', '조용히 깊어진 보랏빛을 찾아보세요.'),
  ('oat-beige', '오트 베이지', 'Oat Beige', '#C8AD8E', '#F7F0E8', '#82684C', '#1D1C1A', '따뜻한 곡물빛을 찾아보세요.'),
  ('sand-beige', '샌드 베이지', 'Sand Beige', '#D6BD91', '#FBF4E7', '#907448', '#1D1C1A', '볕에 데워진 모래빛을 찾아보세요.'),
  ('charcoal-gray', '차콜 그레이', 'Charcoal Gray', '#4E5158', '#E7E8EA', '#292C32', '#FFFFFF', '검정에 가까운 단단한 회색을 찾아보세요.')
on conflict (slug) do nothing;

create function public.get_mission_reveal_palette(p_challenge_date date default null)
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

  if (select count(*) from public.color_palette where is_active) < 12 then
    raise exception 'At least twelve active colors are required';
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
    limit 11
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
