-- Read-only verification; safe on a shared production project.
-- One result set: the Management API returns only the last statement's rows.
select
  (select jsonb_agg(jsonb_build_object('table', tablename, 'rls_enabled', rowsecurity) order by tablename)
   from pg_tables where schemaname='public' and starts_with(tablename,'cl_')) as tables,
  (select jsonb_build_object('id', id, 'public', public, 'file_size_limit', file_size_limit,
    'allowed_mime_types', allowed_mime_types) from storage.buckets where id='cl-entry-photos') as bucket,
  (select jsonb_agg(version order by version) from cl_private.schema_migrations) as migrations,
  (select count(*) from public.cl_color_palette where is_active) as active_palette_colors,
  (select count(*) from public.cl_color_palette) as total_palette_colors,
  (select jsonb_agg(slug order by slug) from public.cl_color_palette where is_active) as active_palette_slugs,
  (select jsonb_agg(tablename order by tablename) from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public' and starts_with(tablename,'cl_')) as realtime_tables;
