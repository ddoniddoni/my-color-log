import { validatePassword, validatePasswordConfirmation } from './emailPassword';
import { getRecoveryError, type RecoveryCredentials, type RecoveryError, type RecoveryLink } from './passwordRecovery';

export type RecoveryConnection = {
  authenticate: (credentials: RecoveryCredentials) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  dispose: () => void;
};
export type RecoverySnapshot = {
  id: string;
  status: 'idle' | 'checking' | 'ready' | 'saving' | 'complete' | 'error';
  error: RecoveryError | null;
};

// Single, memory-only recovery attempt. No tokens or passwords enter router
// params, TanStack Query, AsyncStorage, or the app's signed-in session.
export function createPasswordRecoveryFlow(connect: () => RecoveryConnection) {
  let snapshot: RecoverySnapshot = { id: '', status: 'idle', error: null };
  let sequence = 0;
  let active: { id: string; connection: RecoveryConnection; credentials: RecoveryCredentials; verified: boolean } | null = null;
  const leases = new Map<string, number>();
  const listeners = new Set<() => void>();
  const publish = (next: RecoverySnapshot): void => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const clearConnection = (): void => {
    active?.connection.dispose();
    active = null;
  };
  const verify = async (attempt: NonNullable<typeof active>): Promise<void> => {
    if (attempt.verified) return;
    publish({ id: attempt.id, status: 'checking', error: null });
    try {
      await attempt.connection.authenticate(attempt.credentials);
      if (active !== attempt) return;
      attempt.verified = true;
      publish({ id: attempt.id, status: 'ready', error: null });
    } catch (error) {
      if (active !== attempt) return;
      const reason = getRecoveryError(error);
      if (reason !== 'network') clearConnection();
      publish({ id: attempt.id, status: 'error', error: reason });
    }
  };
  return {
    getSnapshot: (): RecoverySnapshot => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start(link: RecoveryLink): string {
      // Native link delivery may repeat. In particular, a token hash can only be
      // verified once, so keep the current attempt when its link arrives again.
      if (active && sameCredentials(active.credentials, link)) return active.id;
      clearConnection();
      const id = String(++sequence);
      if (link.kind === 'invalid') {
        publish({ id, status: 'error', error: link.reason });
        return id;
      }
      try {
        active = { id, connection: connect(), credentials: link, verified: false };
        void verify(active);
      } catch {
        publish({ id, status: 'error', error: 'invalid' });
      }
      return id;
    },
    retry(id: string): void {
      if (active?.id === id && snapshot.status === 'error' && !active.verified) void verify(active);
    },
    retain(id: string): () => void {
      leases.set(id, (leases.get(id) ?? 0) + 1);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        leases.set(id, Math.max(0, (leases.get(id) ?? 1) - 1));
        // Strict Mode immediately replays effects; only a real unmount cancels.
        void Promise.resolve().then(() => {
          if (leases.get(id) !== 0) return;
          leases.delete(id);
          if (snapshot.id !== id) return;
          clearConnection();
          publish({ id: '', status: 'idle', error: null });
        });
      };
    },
    async submit(id: string, password: string, confirmation: string): Promise<boolean> {
      if (active?.id !== id || snapshot.status !== 'ready') return false;
      if (!validatePassword(password).isValid || !validatePasswordConfirmation(password, confirmation).isValid) return false;
      const attempt = active;
      publish({ id, status: 'saving', error: null });
      try {
        await attempt.connection.updatePassword(password);
        if (active !== attempt) return false;
        clearConnection();
        publish({ id, status: 'complete', error: null });
        return true;
      } catch (error) {
        if (active !== attempt) return false;
        const reason = getRecoveryError(error);
        if (reason === 'expired') clearConnection();
        publish({ id, status: reason === 'expired' ? 'error' : 'ready', error: reason });
        return false;
      }
    },
    clear(id: string): void {
      if (snapshot.id !== id) return;
      clearConnection();
      publish({ id: '', status: 'idle', error: null });
    },
  };
}

function sameCredentials(first: RecoveryCredentials, second: RecoveryLink): boolean {
  if (first.kind === 'tokens' && second.kind === 'tokens') return first.accessToken === second.accessToken && first.refreshToken === second.refreshToken;
  return first.kind === 'token-hash' && second.kind === 'token-hash' && first.tokenHash === second.tokenHash;
}
