export const ACCOUNT_DELETION_CONFIRMATION = '삭제';

export function isAccountDeletionConfirmed(value: string): boolean {
  return value === ACCOUNT_DELETION_CONFIRMATION;
}
