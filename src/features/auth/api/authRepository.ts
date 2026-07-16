import { type Session, type User } from '@supabase/supabase-js';

import { supabase } from '@/src/lib/supabase/client';

export async function getStoredSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('session_restore_failed');
  return data.session;
}

export async function ensureAnonymousUser(): Promise<User> {
  const currentSession = await getStoredSession();
  if (currentSession?.user) return currentSession.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw new Error('anonymous_sign_in_failed');
  return data.user;
}
