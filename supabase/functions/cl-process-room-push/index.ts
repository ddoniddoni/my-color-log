import { createClient } from 'npm:@supabase/supabase-js@2.110.6';
import { getProjectKey } from '../_shared/environment.ts';
import { isWorkerAuthorized, processPushJobs, type PushJob, type PushMessage, type PushStore } from './worker.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  if (!isWorkerAuthorized(request.headers.get('x-cl-worker-secret'), Deno.env.get('CL_PUSH_WORKER_SECRET'))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = Deno.env.get('SUPABASE_URL');
  const key = getProjectKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return Response.json({ error: 'configuration_required' }, { status: 503 });
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const store: PushStore = {
    async claim(limit) {
      const { data, error } = await client.rpc('cl_claim_room_push_jobs', { p_limit: limit }).abortSignal(AbortSignal.timeout(10_000));
      if (error) throw new Error('queue_claim_failed');
      const value: unknown = data;
      if (!Array.isArray(value)) throw new Error('invalid_queue_response');
      return value.map(parseJob);
    },
    async payload(job) {
      const { data, error } = await client.rpc('cl_get_room_push_payload', { p_job_id: job.id, p_lease_token: job.leaseToken }).abortSignal(AbortSignal.timeout(10_000));
      if (error) throw new Error('payload_lookup_failed');
      return data === null ? null : parseMessage(data);
    },
    async finish(job, outcome) {
      const { data, error } = await client.rpc('cl_finish_room_push_job', {
        p_job_id: job.id, p_lease_token: job.leaseToken, p_state: outcome.state,
        p_error_code: outcome.errorCode ?? null, p_ticket_id: outcome.ticketId ?? null,
        p_retry_after_seconds: outcome.retryAfterSeconds ?? 900, p_disable_device: outcome.disableDevice ?? false,
      }).abortSignal(AbortSignal.timeout(10_000));
      if (error || data !== true) throw new Error('queue_finish_failed');
    },
  };
  try {
    const counts = await processPushJobs(store, fetch, Date.now(), Deno.env.get('EXPO_ACCESS_TOKEN'));
    // Only aggregate counters: never log tokens, nicknames, room names or payloads.
    console.log(JSON.stringify({ operation: 'room_push_worker', ...counts }));
    return Response.json(counts);
  } catch {
    console.error('room_push_worker_failed');
    return Response.json({ error: 'worker_failed' }, { status: 500 });
  }
});

function parseJob(value: unknown): PushJob {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.lease_token !== 'string'
    || (value.state !== 'pending' && value.state !== 'awaiting_receipt')
    || typeof value.send_attempts !== 'number' || typeof value.receipt_attempts !== 'number'
    || (value.ticket_id !== null && typeof value.ticket_id !== 'string')
    || (value.ticket_created_at !== null && (typeof value.ticket_created_at !== 'string' || !Number.isFinite(Date.parse(value.ticket_created_at))))) {
    throw new Error('invalid_push_job');
  }
  return { id: value.id, leaseToken: value.lease_token, state: value.state, sendAttempts: value.send_attempts,
    receiptAttempts: value.receipt_attempts, ticketId: value.ticket_id,
    ticketCreatedAt: value.ticket_created_at === null ? null : Date.parse(value.ticket_created_at) };
}
function parseMessage(value: unknown): PushMessage {
  if (!isRecord(value) || typeof value.to !== 'string' || typeof value.title !== 'string'
    || typeof value.body !== 'string' || !isRecord(value.data)) throw new Error('invalid_push_payload');
  const data: Record<string, string> = {};
  for (const [key, item] of Object.entries(value.data)) {
    if (typeof item !== 'string') throw new Error('invalid_push_payload');
    data[key] = item;
  }
  return { to: value.to, title: value.title, body: value.body, data };
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
