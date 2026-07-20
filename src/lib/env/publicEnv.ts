type PublicEnv = { supabaseUrl: string; supabasePublishableKey: string; appScheme: string; easProjectId: string | null };

function requirePublicValue(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'): string {
  const value = name === 'EXPO_PUBLIC_SUPABASE_URL'
    ? process.env.EXPO_PUBLIC_SUPABASE_URL
    : process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!value) throw new Error(`Missing required public environment variable: ${name}`);
  return value;
}

export function getPublicEnv(): PublicEnv {
  return {
    supabaseUrl: requirePublicValue('EXPO_PUBLIC_SUPABASE_URL'),
    supabasePublishableKey: requirePublicValue('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    appScheme: process.env.EXPO_PUBLIC_APP_SCHEME ?? 'mycolorlog',
    easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? null,
  };
}
