import type { AppLanguage } from '@/src/lib/localization/languagePreference';

export const ACCOUNT_DELETION_CONFIRMATION = '삭제';
export const ACCOUNT_DELETION_CONFIRMATIONS: Readonly<Record<AppLanguage, string>> = {
  en: 'DELETE',
  ko: ACCOUNT_DELETION_CONFIRMATION,
};

export function getAccountDeletionConfirmation(language: AppLanguage): string {
  return ACCOUNT_DELETION_CONFIRMATIONS[language];
}

export function isAccountDeletionConfirmed(value: string, confirmation = ACCOUNT_DELETION_CONFIRMATION): boolean {
  return value === confirmation;
}
