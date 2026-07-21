import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getPublicEnv } from '@/src/lib/env/publicEnv';
import { secureStorage } from '@/src/lib/supabase/storage';

const env = getPublicEnv();

type SupabaseGlobal = typeof globalThis & {
  __myColorLogSupabaseClient?: SupabaseClient;
};

const supabaseGlobal = globalThis as SupabaseGlobal;

function createSupabaseClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseGlobal.__myColorLogSupabaseClient) {
    supabaseGlobal.__myColorLogSupabaseClient = createSupabaseClient();
  }

  return supabaseGlobal.__myColorLogSupabaseClient;
}
