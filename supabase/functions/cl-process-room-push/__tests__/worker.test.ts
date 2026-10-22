import { processPushJobs, isWorkerAuthorized, type PushJob, type PushStore } from '../worker';

const now = Date.parse('2026-10-22T10:00:00Z');
const job: PushJob = { id: 'job', leaseToken: 'lease', state: 'pending', sendAttempts: 1, receiptAttempts: 0, ticketId: null, ticketCreatedAt: null };
const message = { to: 'ExpoPushToken[test]', title: '친구방', body: '새 사진이 있어요.', data: { destination: 'room', recipientUserId: 'recipient' } };
function setup(overrides: Partial<PushJob> = {}) {
  const store: jest.Mocked<PushStore> = { claim: jest.fn().mockResolvedValue([{ ...job, ...overrides }]), payload: jest.fn().mockResolvedValue(message), finish: jest.fn().mockResolvedValue(undefined) };
  const transport = jest.fn<Promise<Response>, [string, RequestInit]>();
  const run = () => processPushJobs(store, transport, now, 'expo-access-test');
  return { store, transport, run };
}
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status }); }

describe('durable room push worker', () => {
  it('requires the dedicated worker secret; rejects missing configuration and user JWTs', () => {
    const secret = 'a'.repeat(40);
    expect(isWorkerAuthorized(secret, secret)).toBe(true);
    expect(isWorkerAuthorized('Bearer user-jwt', secret)).toBe(false);
    expect(isWorkerAuthorized(null, secret)).toBe(false);
    expect(isWorkerAuthorized('', '')).toBe(false);
    expect(isWorkerAuthorized('short', 'short')).toBe(false);
  });
  it('persists the ticket and waits 15 minutes for a receipt, without claiming device delivery', async () => {
    const { store, transport, run } = setup();
    transport.mockResolvedValue(json({ data: [{ status: 'ok', id: 'ticket-1' }] }));
    await run();
    expect(store.finish).toHaveBeenCalledWith(expect.objectContaining({ id: 'job' }), { state: 'awaiting_receipt', ticketId: 'ticket-1', retryAfterSeconds: 900 });
    expect(transport.mock.calls[0][1].headers).toEqual(expect.objectContaining({ Authorization: 'Bearer expo-access-test' }));
    expect(JSON.parse(transport.mock.calls[0][1].body as string)[0]).toEqual(expect.objectContaining({ ...message, channelId: 'room-activity', ttl: 3600 }));
  });
  it.each([429, 500, 503])('retries a transient HTTP %i without disabling the device', async (status) => {
    const { store, transport, run } = setup({ sendAttempts: 3 });
    transport.mockResolvedValue(json({}, status));
    await run();
    expect(store.finish).toHaveBeenCalledWith(expect.anything(), { state: 'pending', errorCode: 'transport_error', retryAfterSeconds: 240 });
  });
  it('bounds retry attempts after network errors', async () => {
    const { store, transport, run } = setup({ sendAttempts: 8 });
    transport.mockRejectedValue(new Error('must not persist tokens or request contents'));
    await run();
    expect(store.finish).toHaveBeenCalledWith(expect.anything(), { state: 'failed', errorCode: 'send_attempts_exhausted' });
  });
  it('does not silently accept malformed or missing tickets', async () => {
    const { store, transport, run } = setup();
    transport.mockResolvedValue(json({ data: [{ status: 'ok' }] }));
    await run();
    expect(store.finish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ state: 'pending', errorCode: 'invalid_response' }));
  });
  it('marks credential failures terminal without disabling a valid device', async () => {
    const { store, transport, run } = setup();
    transport.mockResolvedValue(json({ data: [{ status: 'error', details: { error: 'InvalidCredentials' } }] }));
    await run();
    expect(store.finish).toHaveBeenCalledWith(expect.anything(), { state: 'failed', errorCode: 'InvalidCredentials' });
  });
  it('checks a stored receipt and records provider acceptance without sending again', async () => {
    const { store, transport, run } = setup({ state: 'awaiting_receipt', ticketId: 'ticket-1', ticketCreatedAt: now - 900_000, receiptAttempts: 1 });
    transport.mockResolvedValue(json({ data: { 'ticket-1': { status: 'ok' } } }));
    await run();
    expect(transport.mock.calls[0][0]).toMatch(/getReceipts$/);
    expect(store.finish).toHaveBeenCalledWith(expect.anything(), { state: 'provider_accepted' });
  });
  it('disables an unregistered device reported by a receipt', async () => {
    const { store, transport, run } = setup({ state: 'awaiting_receipt', ticketId: 'ticket-1', ticketCreatedAt: now - 900_000 });
    transport.mockResolvedValue(json({ data: { 'ticket-1': { status: 'error', details: { error: 'DeviceNotRegistered' } } } }));
    await run();
    expect(store.finish).toHaveBeenCalledWith(expect.anything(), { state: 'failed', errorCode: 'DeviceNotRegistered', disableDevice: true });
  });
  it('polls missing receipts, then marks them unknown instead of resending accepted tickets', async () => {
    const { store, transport, run } = setup({ state: 'awaiting_receipt', ticketId: 'ticket-1', ticketCreatedAt: now - 900_000 });
    transport.mockResolvedValue(json({ data: {} }));
    await run();
    expect(store.finish).toHaveBeenLastCalledWith(expect.anything(), { state: 'awaiting_receipt', errorCode: 'receipt_missing', retryAfterSeconds: 900 });
    store.claim.mockResolvedValue([{ ...job, state: 'awaiting_receipt', ticketId: 'ticket-1', ticketCreatedAt: now - 23 * 3600_000 }]);
    await run();
    expect(store.finish).toHaveBeenLastCalledWith(expect.anything(), { state: 'unknown', errorCode: 'receipt_expired' });
  });
  it('cancels when permissions, session, photo, or device have changed before send', async () => {
    const { store, transport, run } = setup();
    store.payload.mockResolvedValue(null);
    await run();
    expect(transport).not.toHaveBeenCalled();
    expect(store.finish).toHaveBeenCalledWith(expect.anything(), { state: 'cancelled', errorCode: 'no_longer_eligible' });
  });
  it('leaves a failed persistence operation recoverable by lease expiry', async () => {
    const { store, transport, run } = setup();
    transport.mockResolvedValue(json({ data: [{ status: 'ok', id: 'ticket-1' }] }));
    store.finish.mockRejectedValue(new Error('db unavailable'));
    expect(await run()).toEqual({ claimed: 1, processed: 0, errors: 1 });
    expect(store.finish).toHaveBeenCalledTimes(1);
  });
});
