-- Run only on the explicitly selected Color Log project after deploying both
-- cl-process-room-push and cl-notify-room-photo. Never paste secrets here.
-- In Vault, provision cl_push_worker_url and cl_push_worker_secret. The secret
-- must match the Edge Function's CL_PUSH_WORKER_SECRET (>=32 random characters).
-- Enable pg_cron, pg_net and Vault in the project's Extensions settings first.
begin;
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
    or not exists (select 1 from pg_extension where extname = 'pg_net')
    or to_regclass('vault.decrypted_secrets') is null then
    raise exception 'room_push_scheduler_extensions_required';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'cl_push_worker_secret' and length(decrypted_secret) >= 32)
    or not exists (select 1 from vault.decrypted_secrets where name = 'cl_push_worker_url'
      and decrypted_secret ~ '^https://[a-z]{20}[.]supabase[.]co/functions/v1/cl-process-room-push$') then
    raise exception 'room_push_worker_vault_configuration_required';
  end if;
end;
$$;
select cron.schedule('cl-room-push-worker', '* * * * *', $command$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cl_push_worker_url'),
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cl-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cl_push_worker_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$command$);
commit;
