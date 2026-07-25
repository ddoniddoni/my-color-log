import { ACCOUNT_DELETION_CONFIRMATION, getAccountDeletionConfirmation, isAccountDeletionConfirmed } from '@/src/features/auth/model/accountDeletion';

describe('account deletion confirmation', () => {
  it('requires the exact Korean confirmation word', () => {
    expect(isAccountDeletionConfirmed(ACCOUNT_DELETION_CONFIRMATION)).toBe(true);
    expect(isAccountDeletionConfirmed(' 삭제')).toBe(false);
    expect(isAccountDeletionConfirmed('delete')).toBe(false);
  });

  it('uses a locale-specific confirmation word', () => {
    expect(getAccountDeletionConfirmation('en')).toBe('DELETE');
    expect(isAccountDeletionConfirmed('DELETE', getAccountDeletionConfirmation('en'))).toBe(true);
  });
});
