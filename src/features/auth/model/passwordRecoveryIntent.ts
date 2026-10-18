import 'react-native-url-polyfill/auto';

import { createRecoveryConnection } from '@/src/features/auth/api/passwordRecoveryRepository';
import { parsePasswordRecoveryLink } from './passwordRecovery';
import { createPasswordRecoveryFlow } from './passwordRecoveryFlow';

export const passwordRecoveryFlow = createPasswordRecoveryFlow(createRecoveryConnection);

export function redirectPasswordRecoveryIntent(path: string): string {
  const link = parsePasswordRecoveryLink(path, process.env.EXPO_PUBLIC_APP_SCHEME ?? 'mycolorlog');
  if (!link) return path;
  const id = passwordRecoveryFlow.start(link);
  return `/auth/reset-password?recoveryId=${id}`;
}
