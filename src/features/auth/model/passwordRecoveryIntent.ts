import 'react-native-url-polyfill/auto';

import { createRecoveryConnection } from '@/src/features/auth/api/passwordRecoveryRepository';
import { getAppScheme } from '@/src/lib/env/appIdentity';
import { parsePasswordRecoveryLink } from './passwordRecovery';
import { createPasswordRecoveryFlow } from './passwordRecoveryFlow';

export const passwordRecoveryFlow = createPasswordRecoveryFlow(createRecoveryConnection);

export function redirectPasswordRecoveryIntent(path: string): string {
  const link = parsePasswordRecoveryLink(path, getAppScheme());
  if (!link) return path;
  const id = passwordRecoveryFlow.start(link);
  return `/auth/reset-password?recoveryId=${id}`;
}
