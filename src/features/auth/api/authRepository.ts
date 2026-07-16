import { type Session, type User } from '@supabase/supabase-js';

import { supabase } from '@/src/lib/supabase/client';

export async function getStoredSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('session_restore_failed');
  return data.session;
}

export async function requestEmailOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new Error('email_otp_request_failed');
}

export async function verifyEmailOtp(email: string, token: string): Promise<User> {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data.user) throw new Error('email_otp_verification_failed');
  return data.user;
}
