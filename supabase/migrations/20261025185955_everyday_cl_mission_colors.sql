-- FR-MISSION-001/002/003: eight familiar colors plus two occasional accents.
-- Supports either the cl_ baseline or the earlier purple/wine migration.
-- Apply this file alone to the shared project. Never replay old migrations.
-- Old palette rows/identities/tokens and all decided missions/photos stay intact.
-- Rollback requires a new migration that restores the previous active pool and
-- picker. Keep these rows because new missions may already reference them.
begin;
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('colorlog:install', 0));

do $$
declare active_slugs text[];
begin
  select array_agg(slug order by slug) into active_slugs from public.cl_color_palette where is_active;
  if active_slugs is distinct from array[
    'clear-blue','coral-pink','leaf-green','lemon-yellow','lime-green',
    'mint-green','rose-pink','sky-blue','tangerine-orange','tomato-red']::text[]
    and active_slugs is distinct from array[
    'clear-blue','deep-wine','leaf-green','lemon-yellow','mint-green',
    'rose-pink','royal-purple','sky-blue','tangerine-orange','tomato-red']::text[] then
    raise exception 'colorlog_palette_baseline_changed';
  end if;
  if exists (select 1 from public.cl_color_palette where slug like 'everyday-%') then
    raise exception 'colorlog_everyday_palette_already_exists';
  end if;
end;
$$;

alter table public.cl_color_palette add column selection_weight integer not null default 1
  constraint cl_color_palette_selection_weight_check check (selection_weight between 1 and 10);

-- Use new IDs even where the representative HEX is unchanged. Past mission
-- names/prompts keep their meaning rather than being renamed through a join.
update public.cl_color_palette set is_active = false where is_active;
insert into public.cl_color_palette
  (slug,name_ko,name_en,hex,tint_hex,shade_hex,on_color_hex,prompt_ko,selection_weight,is_active)
values
  ('everyday-red','빨강','Red','#E53935','#FCE8E6','#922421','#000000','간판이나 포장지, 소화기에서 빨강을 찾아보세요.',4,true),
  ('everyday-orange','주황','Orange','#F57C00','#FFF0DE','#9A4C00','#1D1C1A','귤이나 당근, 작은 생활용품에서 주황을 찾아보세요.',4,true),
  ('everyday-yellow','노랑','Yellow','#FDD835','#FFF9D9','#8A7100','#1D1C1A','바나나나 메모지, 표지판에서 노랑을 찾아보세요.',4,true),
  ('everyday-green','초록','Green','#43A047','#E8F5E9','#256529','#1D1C1A','나뭇잎이나 화분, 채소에서 초록을 찾아보세요.',4,true),
  ('everyday-blue','파랑','Blue','#1976D2','#E3F2FD','#0D47A1','#FFFFFF','청바지나 펜, 물병 라벨에서 파랑을 찾아보세요.',4,true),
  ('everyday-pink','분홍','Pink','#EC407A','#FCE4EC','#9F2450','#1D1C1A','옷이나 생활용품, 포장지에서 분홍을 찾아보세요.',4,true),
  ('everyday-brown','갈색','Brown','#8D6E63','#F1E9E5','#4E342E','#FFFFFF','책상이나 나무, 빵과 커피에서 갈색을 찾아보세요.',4,true),
  ('everyday-beige','베이지','Beige','#D7C4A3','#F7F1E7','#756147','#1D1C1A','종이봉투나 커튼, 옷에서 베이지를 찾아보세요.',4,true),
  ('everyday-purple','보라','Purple','#7B2FD0','#F0E5FC','#49177F','#FFFFFF','가끔 만나는 특별한 색이에요. 꽃이나 소품에서 보라를 찾아보세요.',1,true),
  ('everyday-wine','와인','Wine','#8B1E4B','#F6E3EB','#56102C','#FFFFFF','가끔 만나는 특별한 색이에요. 붉은 잎이나 천에서 와인빛을 찾아보세요.',1,true);

-- Preserve the existing authentication/date guards, security-definer boundary
-- and exact RPC response. Clients cannot set weights or override a date's color.
CREATE OR REPLACE FUNCTION public.cl_get_daily_mission(p_challenge_date date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, challenge_date date, mission_type text, title_ko text, prompt_ko text, published_at timestamp with time zone, source text, color_id uuid, color_slug text, color_name_ko text, color_name_en text, color_hex text, color_tint_hex text, color_shade_hex text, color_on_color_hex text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  profile_time_zone text;
  target_date date;
  latest_allowed_date date;
  selected_color public.cl_color_palette%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select coalesce(profile.timezone, 'Asia/Seoul')
  into profile_time_zone
  from (select 1) as seed
  left join public.cl_profiles as profile on profile.id = current_user_id;

  target_date := coalesce(p_challenge_date, cl_private.current_date_in_time_zone(profile_time_zone));
  latest_allowed_date := cl_private.latest_current_date_for_user(current_user_id);
  if target_date > latest_allowed_date then
    raise exception 'Future daily missions cannot be created';
  end if;

  -- A date already revealed or recorded never changes with a palette update.
  if not exists (select 1 from public.cl_daily_missions m where m.challenge_date = target_date) then
    -- One snapshot for weights and candidates. Numeric date formatting and C
    -- ordering make selection independent of session DateStyle/collation.
    with candidates as (
      select palette.id,
        sum(palette.selection_weight) over (order by palette.slug collate "C") as ticket_end,
        sum(palette.selection_weight) over () as total_weight
      from public.cl_color_palette palette where palette.is_active
    )
    select palette.* into selected_color
    from candidates
    join public.cl_color_palette palette on palette.id = candidates.id
    where candidates.ticket_end > (
      ('x' || substr(md5(to_char(target_date, 'YYYY-MM-DD') || ':everyday-v1'), 1, 8))::bit(32)::bigint
      % candidates.total_weight
    )
    order by candidates.ticket_end
    limit 1;

    if selected_color.id is null then
      raise exception 'No active colors are available';
    end if;
    insert into public.cl_daily_missions (challenge_date, mission_type, color_id, title_ko, prompt_ko, source)
    values (target_date, 'color', selected_color.id, format('오늘의 %s', selected_color.name_ko),
      selected_color.prompt_ko, 'scheduled')
    on conflict do nothing;
  end if;

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
  from public.cl_daily_missions as mission
  join public.cl_color_palette as palette on palette.id = mission.color_id
  where mission.challenge_date = target_date;
end;
$function$;

revoke all on function public.cl_get_daily_mission(p_challenge_date date) from public, anon, authenticated, service_role;

grant execute on function public.cl_get_daily_mission(p_challenge_date date) to authenticated;

insert into cl_private.schema_migrations(version) values ('20261025185955');
commit;
