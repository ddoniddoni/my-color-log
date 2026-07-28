import { type Session } from '@supabase/supabase-js';

import { mapSignInErrorCode, mapSignUpErrorCode } from '@/src/features/auth/model/authErrors';
import { logError } from '@/src/lib/logging/logger';
import { getSupabaseClient } from '@/src/lib/supabase/client';

export async function getStoredSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) {
    logError('session_restore_failed', { code: error.code, message: error.message });
    throw new Error('session_restore_failed');
  }
  return data.session;
}

export async function signUpWithEmailPassword(email: string, password: string): Promise<Session> {
  const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
  if (error) throw new Error(mapSignUpErrorCode(error.code));
  if (data.user?.identities?.length === 0) throw new Error('email_already_registered');
  if (!data.session) throw new Error('email_confirmation_required');
  return data.session;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<Session> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw new Error(mapSignInErrorCode(error.code));
  if (!data.session) throw new Error('password_sign_in_failed');
  return data.session;
}

export async function signOutCurrentSession(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
  if (error) throw new Error('sign_out_failed');
}
