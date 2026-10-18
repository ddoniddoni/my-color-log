import { createPasswordRecoveryFlow, type RecoveryConnection } from '../passwordRecoveryFlow';
import type { RecoveryCredentials } from '../passwordRecovery';

const credentials: RecoveryCredentials = { kind: 'token-hash', tokenHash: 'test-recovery-secret' };
const password = 'new-test-password';
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}
function setup() {
  const connection = {
    authenticate: jest.fn<Promise<void>, [RecoveryCredentials]>().mockResolvedValue(undefined),
    updatePassword: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    dispose: jest.fn(),
  } satisfies RecoveryConnection;
  const connect = jest.fn(() => connection);
  return { connection, connect, flow: createPasswordRecoveryFlow(connect) };
}

describe('isolated password recovery lifecycle', () => {
  it('only saves after server verification, validates both inputs, and clears its session on success', async () => {
    const { flow, connection } = setup();
    const id = flow.start(credentials);
    expect(flow.getSnapshot().status).toBe('checking');
    expect(await flow.submit(id, password, password)).toBe(false);
    await flush();
    expect(flow.getSnapshot().status).toBe('ready');
    expect(await flow.submit(id, 'short', 'short')).toBe(false);
    expect(await flow.submit(id, password, 'mismatch')).toBe(false);
    expect(connection.updatePassword).not.toHaveBeenCalled();
    expect(await flow.submit(id, password, password)).toBe(true);
    expect(connection.updatePassword).toHaveBeenCalledWith(password);
    expect(connection.dispose).toHaveBeenCalledTimes(1);
    expect(flow.getSnapshot()).toEqual({ id, status: 'complete', error: null });
    expect(JSON.stringify(flow.getSnapshot())).not.toContain('secret');
    expect(JSON.stringify(flow.getSnapshot())).not.toContain(password);
  });

  it('does not authenticate invalid links and cannot save without an active recovery session', async () => {
    const { flow, connect } = setup();
    const id = flow.start({ kind: 'invalid', reason: 'expired' });
    expect(connect).not.toHaveBeenCalled();
    expect(await flow.submit(id, password, password)).toBe(false);
    expect(flow.getSnapshot()).toEqual({ id, status: 'error', error: 'expired' });
  });

  it('deduplicates repeated delivery of a one-time email link', async () => {
    const { flow, connection, connect } = setup();
    const id = flow.start(credentials);
    expect(flow.start({ ...credentials })).toBe(id);
    await flush();
    expect(flow.start({ ...credentials })).toBe(id);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connection.authenticate).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate password updates while saving', async () => {
    const { flow, connection } = setup();
    const saving = deferred();
    connection.updatePassword.mockReturnValueOnce(saving.promise);
    const id = flow.start(credentials);
    await flush();
    const first = flow.submit(id, password, password);
    expect(await flow.submit(id, password, password)).toBe(false);
    saving.resolve();
    expect(await first).toBe(true);
    expect(connection.updatePassword).toHaveBeenCalledTimes(1);
  });

  it('allows verification retry after a connection failure, and disposes expired sessions', async () => {
    const { flow, connection } = setup();
    connection.authenticate.mockRejectedValueOnce(new Error('offline'));
    const id = flow.start(credentials);
    await flush();
    expect(flow.getSnapshot().error).toBe('network');
    flow.retry(id);
    await flush();
    expect(flow.getSnapshot().status).toBe('ready');
    connection.updatePassword.mockRejectedValueOnce({ code: 'session_expired' });
    expect(await flow.submit(id, password, password)).toBe(false);
    expect(flow.getSnapshot()).toEqual({ id, status: 'error', error: 'expired' });
    expect(connection.dispose).toHaveBeenCalledTimes(1);
  });

  it.each(['weak_password', 'same_password', 'over_request_rate_limit', undefined])('allows correcting or retrying a recoverable save failure: %s', async (code) => {
    const { flow, connection } = setup();
    const id = flow.start(credentials);
    await flush();
    connection.updatePassword.mockRejectedValueOnce({ code });
    expect(await flow.submit(id, password, password)).toBe(false);
    expect(flow.getSnapshot().status).toBe('ready');
    expect(connection.dispose).not.toHaveBeenCalled();
    expect(await flow.submit(id, password, password)).toBe(true);
  });

  it('ignores late verification results from a superseded link', async () => {
    const { flow, connection } = setup();
    const first = deferred();
    connection.authenticate.mockReturnValueOnce(first.promise);
    const firstId = flow.start(credentials);
    const secondId = flow.start({ kind: 'token-hash', tokenHash: 'another-secret' });
    await flush();
    first.reject({ code: 'otp_expired' });
    await flush();
    expect(flow.getSnapshot()).toEqual({ id: secondId, status: 'ready', error: null });
    expect(await flow.submit(firstId, password, password)).toBe(false);
  });

  it('ignores a late password update after leaving the screen', async () => {
    const { flow, connection } = setup();
    const saving = deferred();
    connection.updatePassword.mockReturnValueOnce(saving.promise);
    const id = flow.start(credentials);
    await flush();
    const pending = flow.submit(id, password, password);
    flow.clear(id);
    saving.resolve();
    expect(await pending).toBe(false);
    expect(flow.getSnapshot().status).toBe('idle');
  });

  it('survives Strict Mode effect replay, then cancels on a real unmount', async () => {
    const { flow, connection } = setup();
    const id = flow.start(credentials);
    const cleanup = flow.retain(id);
    cleanup();
    const realCleanup = flow.retain(id);
    await flush();
    expect(flow.getSnapshot().status).toBe('ready');
    expect(connection.dispose).not.toHaveBeenCalled();
    realCleanup();
    realCleanup();
    await flush();
    expect(connection.dispose).toHaveBeenCalledTimes(1);
    expect(flow.getSnapshot().status).toBe('idle');
  });

  it('never clears a newer attempt when the previous screen unmounts', async () => {
    const { flow } = setup();
    const id = flow.start(credentials);
    const cleanup = flow.retain(id);
    const newId = flow.start({ kind: 'token-hash', tokenHash: 'new-link' });
    cleanup();
    await flush();
    expect(flow.getSnapshot()).toEqual({ id: newId, status: 'ready', error: null });
  });
});
