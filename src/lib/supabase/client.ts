import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { getPublicEnv } from '@/src/lib/env/publicEnv';
import { secureStorage } from '@/src/lib/supabase/storage';

const env = getPublicEnv();

export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
