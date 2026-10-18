import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { validateEmail } from '@/src/features/auth/model/emailPassword';
import { getPasswordRecoveryRedirectUrl } from '@/src/features/auth/model/passwordRecovery';
import type { RecoveryConnection } from '@/src/features/auth/model/passwordRecoveryFlow';
import { getPublicEnv } from '@/src/lib/env/publicEnv';

let recoveryClientSequence = 0;

function createRecoveryClient() {
  const env = getPublicEnv();
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      storageKey: `mycolorlog-password-recovery-${++recoveryClientSequence}`,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'implicit',
    },
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  const validation = validateEmail(email);
  if (!validation.isValid) throw new Error('invalid_email');
  const client = createRecoveryClient();
  try {
    const { error } = await client.auth.resetPasswordForEmail(validation.value, {
      redirectTo: getPasswordRecoveryRedirectUrl(getPublicEnv().appScheme),
    });
    if (error) throw error;
  } finally {
    await client.auth.dispose();
  }
}

export function createRecoveryConnection(): RecoveryConnection {
  const client = createRecoveryClient();
  return {
    async authenticate(credentials) {
      const { data, error } = credentials.kind === 'tokens'
        ? await client.auth.setSession({ access_token: credentials.accessToken, refresh_token: credentials.refreshToken })
        : await client.auth.verifyOtp({ token_hash: credentials.tokenHash, type: 'recovery' });
      if (error) throw error;
      if (!data.session || !data.user) throw Object.assign(new Error('recovery_session_missing'), { code: 'session_not_found' });
    },
    async updatePassword(password) {
      const { data, error } = await client.auth.updateUser({ password });
      if (error) throw error;
      if (!data.user) throw Object.assign(new Error('recovery_session_missing'), { code: 'session_not_found' });
    },
    dispose() { void client.auth.dispose().catch(() => undefined); },
  };
}
