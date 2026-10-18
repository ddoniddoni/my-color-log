import { redirectPasswordRecoveryIntent } from '@/src/features/auth/model/passwordRecoveryIntent';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return redirectPasswordRecoveryIntent(path);
  } catch {
    return '/auth/reset-password';
  }
}
