-- FR-MISSION-001/002/003: diversify the ten-color pool for NEW missions.
-- Apply only this file after the cl_ baseline. Never replay historical migrations
-- on a shared project. Existing palette identities, missions and photo references
-- stay intact; only coral/lime eligibility changes.
-- Rollback is another migration: reactivate coral-pink/lime-green and deactivate
-- royal-purple/deep-wine. Keep all rows and all missions created in the meantime.
begin;
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('colorlog:install', 0));

-- Fail atomically if an operator has changed the candidate pool since review.
-- Do not silently replace their colors or overwrite a colliding new slug.
do $$
begin
  if (select array_agg(slug order by slug) from public.cl_color_palette where is_active)
    is distinct from array[
      'clear-blue', 'coral-pink', 'leaf-green', 'lemon-yellow', 'lime-green',
      'mint-green', 'rose-pink', 'sky-blue', 'tangerine-orange', 'tomato-red'
    ]::text[] then
    raise exception 'colorlog_palette_baseline_changed';
  end if;
end;
$$;

insert into public.cl_color_palette
  (slug, name_ko, name_en, hex, tint_hex, shade_hex, on_color_hex, prompt_ko, is_active)
values
  ('royal-purple', '로열 퍼플', 'Royal Purple', '#7B2FD0', '#F0E5FC', '#49177F', '#FFFFFF', '꽃잎이나 작은 소품에 숨어 있는 선명한 보라를 찾아보세요.', true),
  ('deep-wine', '딥 와인', 'Deep Wine', '#8B1E4B', '#F6E3EB', '#56102C', '#FFFFFF', '붉은 잎이나 천에 스며든 깊은 와인빛을 찾아보세요.', true);

update public.cl_color_palette
set is_active = false
where slug in ('coral-pink', 'lime-green');

-- Existing RPCs already use the active pool for creation and include the actual
-- mission color even when inactive. Keep their response shape, date gates, RLS
-- and grants unchanged. In particular, never UPDATE cl_daily_missions here.
insert into cl_private.schema_migrations (version) values ('20261021180718');
commit;
