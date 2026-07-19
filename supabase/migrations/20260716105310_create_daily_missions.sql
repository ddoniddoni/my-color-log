create table public.color_palette (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_ko text not null,
  name_en text not null,
  hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  tint_hex text not null check (tint_hex ~ '^#[0-9A-Fa-f]{6}$'),
  shade_hex text not null check (shade_hex ~ '^#[0-9A-Fa-f]{6}$'),
  on_color_hex text not null check (on_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  prompt_ko text not null,
  is_active boolean not null default true
);

create table public.daily_missions (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null unique,
  mission_type text not null check (mission_type = 'color'),
  color_id uuid not null references public.color_palette(id),
  title_ko text not null,
  prompt_ko text not null,
  published_at timestamptz not null default now(),
  source text not null check (source in ('manual', 'scheduled', 'fallback'))
);

alter table public.color_palette enable row level security;
alter table public.daily_missions enable row level security;

insert into public.color_palette (slug, name_ko, name_en, hex, tint_hex, shade_hex, on_color_hex, prompt_ko)
values
  ('cherry-red', '체리 레드', 'Cherry Red', '#D94A4A', '#F9E6E6', '#8D2727', '#FFFFFF', '오늘 스쳐 간 빨강을 찾아보세요.'),
  ('apricot-orange', '살구 오렌지', 'Apricot Orange', '#E98B4A', '#FBEBDD', '#9D5428', '#1D1C1A', '따뜻하게 빛난 주황을 찾아보세요.'),
  ('butter-yellow', '버터 옐로', 'Butter Yellow', '#E8BF45', '#FBF4D9', '#8A6B10', '#1D1C1A', '오늘을 밝힌 노랑을 찾아보세요.'),
  ('leaf-green', '리프 그린', 'Leaf Green', '#5E9A62', '#E6F1E7', '#326A3B', '#FFFFFF', '스쳐 간 초록의 결을 찾아보세요.'),
  ('sky-blue', '스카이 블루', 'Sky Blue', '#5B9BC8', '#E3F0F8', '#356A91', '#FFFFFF', '오늘의 맑은 파랑을 찾아보세요.'),
  ('midnight-blue', '미드나잇 블루', 'Midnight Blue', '#3D527D', '#E5E9F2', '#243352', '#FFFFFF', '조용히 깊어진 파랑을 찾아보세요.'),
  ('lilac-purple', '라일락 퍼플', 'Lilac Purple', '#9471B6', '#F0EAF6', '#5D3F78', '#FFFFFF', '은은하게 머문 보라를 찾아보세요.'),
  ('rose-pink', '로즈 핑크', 'Rose Pink', '#D87892', '#F9E7EC', '#8E4157', '#FFFFFF', '오늘 곁에 있던 분홍을 찾아보세요.'),
  ('cocoa-brown', '코코아 브라운', 'Cocoa Brown', '#956C55', '#F0E8E2', '#5C3E2E', '#FFFFFF', '차분한 갈색을 찾아보세요.'),
  ('cloud-gray', '클라우드 그레이', 'Cloud Gray', '#8A8B91', '#ECECEF', '#5A5B61', '#FFFFFF', '오늘의 부드러운 회색을 찾아보세요.')
on conflict (slug) do nothing;

create function public.get_daily_mission(p_challenge_date date default null)
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
  on conflict (challenge_date) do nothing;

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
grant execute on function public.get_daily_mission(date) to authenticated;
