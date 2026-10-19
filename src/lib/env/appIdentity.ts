import Constants from 'expo-constants';

// Native configuration wins over a stale local .env when variants coexist.
export function getAppScheme(): string {
  const scheme = Constants.expoConfig?.scheme;
  if (typeof scheme === 'string' && scheme) return scheme;
  if (Array.isArray(scheme) && scheme[0]) return scheme[0];
  return process.env.EXPO_PUBLIC_APP_SCHEME?.trim() || 'mycolorlog';
}

export function getEasProjectId(): string | null {
  return Constants.easConfig?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || null;
}
