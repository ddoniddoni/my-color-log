export type PushJob = {
  id: string;
  leaseToken: string;
  state: 'pending' | 'awaiting_receipt';
  sendAttempts: number;
  receiptAttempts: number;
  ticketId: string | null;
  ticketCreatedAt: number | null;
};
export type PushMessage = { to: string; title: string; body: string; data: Record<string, string> };
export type PushOutcome = {
  state: 'pending' | 'awaiting_receipt' | 'provider_accepted' | 'failed' | 'unknown' | 'cancelled';
  errorCode?: string;
  ticketId?: string;
  retryAfterSeconds?: number;
  disableDevice?: boolean;
};
export type PushStore = {
  claim: (limit: number) => Promise<PushJob[]>;
  payload: (job: PushJob) => Promise<PushMessage | null>;
  finish: (job: PushJob, outcome: PushOutcome) => Promise<void>;
};
type Transport = (url: string, init: RequestInit) => Promise<Response>;
const EXPO_API = 'https://exp.host/--/api/v2/push/';
const MAX_SEND_ATTEMPTS = 8;
const RECEIPT_DELAY_SECONDS = 900;
const MAX_RECEIPT_AGE_MS = 23 * 3600_000;

// A dedicated secret limits this endpoint to the scheduler; user JWTs and public
// API keys cannot drain the queue. Do not log request headers or message bodies.
export function isWorkerAuthorized(provided: string | null, expected: string | undefined): boolean {
  if (!expected || expected.length < 32 || !provided || provided.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i += 1) difference |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

export async function processPushJobs(store: PushStore, transport: Transport = fetch, now = Date.now(), accessToken?: string) {
  const jobs = await store.claim(12);
  let processed = 0;
  let errors = 0;
  let cursor = 0;
  // Bound HTTP concurrency and total runtime below the three-minute DB lease.
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      try {
        const message = await store.payload(job);
        const outcome = message
          ? await deliver(job, message, transport, now, accessToken)
          : { state: 'cancelled' as const, errorCode: 'no_longer_eligible' };
        // A failed DB write must not be converted into another outcome: the
        // lease recovers it. Expo has no exactly-once send guarantee.
        await store.finish(job, outcome);
        processed += 1;
      } catch { errors += 1; }
    }
  }));
  return { claimed: jobs.length, processed, errors };
}

async function deliver(job: PushJob, message: PushMessage, transport: Transport, now: number, accessToken?: string): Promise<PushOutcome> {
  const receipt = job.state === 'awaiting_receipt';
  if (receipt && (!job.ticketId || job.ticketCreatedAt === null || now - job.ticketCreatedAt >= MAX_RECEIPT_AGE_MS)) {
    return { state: 'unknown', errorCode: 'receipt_expired' };
  }
  let response: Response;
  try {
    response = await transport(EXPO_API + (receipt ? 'getReceipts' : 'send'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify(receipt ? { ids: [job.ticketId] } : [{ ...message, sound: 'default', channelId: 'room-activity', ttl: 3600 }]),
      signal: AbortSignal.timeout(12_000),
    });
  } catch { return retry(job, 'transport_error'); }
  if (response.status === 429 || response.status >= 500) return retry(job, 'transport_error');
  if (!response.ok) return { state: 'failed', errorCode: 'request_rejected' };
  let payload: unknown;
  try { payload = await response.json(); } catch { return retry(job, 'invalid_response'); }
  if (!isRecord(payload)) return retry(job, 'invalid_response');

  let result: unknown;
  if (receipt) {
    if (!isRecord(payload.data)) return retry(job, 'invalid_response');
    result = payload.data[job.ticketId!];
    if (result === undefined) return retry(job, 'receipt_missing');
  } else {
    if (!Array.isArray(payload.data) || payload.data.length !== 1) return retry(job, 'invalid_response');
    result = payload.data[0];
  }
  if (!isRecord(result)) return retry(job, 'invalid_response');
  if (result.status === 'ok') {
    if (receipt) return { state: 'provider_accepted' };
    if (typeof result.id !== 'string' || result.id.length === 0 || result.id.length > 256) return retry(job, 'invalid_response');
    return { state: 'awaiting_receipt', ticketId: result.id, retryAfterSeconds: RECEIPT_DELAY_SECONDS };
  }
  if (result.status !== 'error') return retry(job, 'invalid_response');
  const error = isRecord(result.details) ? result.details.error : undefined;
  if (error === 'DeviceNotRegistered') return { state: 'failed', errorCode: error, disableDevice: true };
  if (error === 'MessageRateExceeded') return retrySend(job, error);
  if (error === 'InvalidCredentials' || error === 'MismatchSenderId' || error === 'MessageTooBig') return { state: 'failed', errorCode: error };
  return { state: 'failed', errorCode: 'provider_error' };
}

function retry(job: PushJob, errorCode: string): PushOutcome {
  if (job.state === 'awaiting_receipt') return { state: 'awaiting_receipt', errorCode, retryAfterSeconds: RECEIPT_DELAY_SECONDS };
  return retrySend(job, errorCode);
}
function retrySend(job: PushJob, errorCode: string): PushOutcome {
  if (job.sendAttempts >= MAX_SEND_ATTEMPTS) return { state: 'failed', errorCode: 'send_attempts_exhausted' };
  return { state: 'pending', errorCode, retryAfterSeconds: Math.min(3600, 60 * 2 ** Math.max(0, job.sendAttempts - 1)) };
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
