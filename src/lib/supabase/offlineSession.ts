import { type Session } from '@supabase/supabase-js';

import { getPublicEnv } from '@/src/lib/env/publicEnv';
import { secureStorage } from '@/src/lib/supabase/storage';

// Matches the existing Supabase SDK key; no second copy of credentials is kept.
export function getAuthStorageKey(): string {
  return `sb-${new URL(getPublicEnv().supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

export async function readOfflineSession(): Promise<Session | null> {
  const raw = await secureStorage.getItem(getAuthStorageKey());
  return parseOfflineSession(raw);
}

export function parseOfflineSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || !isRecord(value.user)) return null;
    if (typeof value.access_token !== 'string' || typeof value.refresh_token !== 'string'
      || typeof value.token_type !== 'string' || typeof value.expires_in !== 'number'
      || typeof value.user.id !== 'string' || typeof value.user.aud !== 'string'
      || typeof value.user.created_at !== 'string' || !isRecord(value.user.app_metadata)
      || !isRecord(value.user.user_metadata)) return null;
    // This is a local UI identity only. Supabase still refreshes credentials and
    // RLS validates every remote operation; expiry does not erase offline photos.
    return value as unknown as Session;
  } catch { return null; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
