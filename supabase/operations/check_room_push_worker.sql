-- Read-only health inspection after installing the queue and scheduler.
-- Run as the project administrator. Never output Vault values, tokens, photo
-- payloads, or cron commands (other apps may embed credentials in commands).
select jsonb_build_object(
  'migration_applied', exists (
    select 1 from cl_private.schema_migrations where version = '20261022111011'
  ),
  'queue_rls_enabled', (
    select relrowsecurity from pg_class where oid = 'public.cl_room_push_jobs'::regclass
  ),
  'client_queue_access', jsonb_build_object(
    'anon', has_table_privilege('anon', 'public.cl_room_push_jobs', 'SELECT,INSERT,UPDATE,DELETE'),
    'authenticated', has_table_privilege('authenticated', 'public.cl_room_push_jobs', 'SELECT,INSERT,UPDATE,DELETE')
  ),
  'worker_rpc_permissions', (
    select jsonb_agg(jsonb_build_object('name', p.proname,
      'anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'service_role', has_function_privilege('service_role', p.oid, 'EXECUTE')) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'cl_claim_room_push_jobs', 'cl_get_room_push_payload', 'cl_finish_room_push_job'
    )
  ),
  'vault_names_present', (
    select count(*) = 2 from vault.secrets where name in ('cl_push_worker_secret', 'cl_push_worker_url')
  ),
  'scheduler', (
    select jsonb_agg(jsonb_build_object('name', jobname, 'schedule', schedule, 'active', active))
    from cron.job where jobname = 'cl-room-push-worker'
  ),
  'recent_runs', (
    select jsonb_agg(jsonb_build_object('status', status, 'started_at', start_time, 'finished_at', end_time))
    from (
      select status, start_time, end_time from cron.job_run_details
      where jobid in (select jobid from cron.job where jobname = 'cl-room-push-worker')
      order by start_time desc limit 3
    ) runs
  ),
  'queue_counts', (
    select coalesce(jsonb_object_agg(state, total), '{}'::jsonb)
    from (select state, count(*) total from public.cl_room_push_jobs group by state) counts
  ),
  -- Cron success means the HTTP request was queued, not that the Edge Function
  -- or push provider succeeded. Return only the worker's count-only responses.
  'recent_worker_http', (
    select jsonb_agg(jsonb_build_object('status_code', status_code, 'timed_out', timed_out,
      'created_at', created, 'counts', content::jsonb))
    from (
      select status_code, timed_out, created, content from net._http_response
      where content ~ '^\{"claimed":[0-9]+,"processed":[0-9]+,"errors":[0-9]+\}$'
      order by created desc limit 3
    ) responses
  )
) as room_push_health;
