export type Profile = {
  id: string;
  nickname: string;
  timezone: string;
  isOnboarded: boolean;
};

export type NicknameValidation = { isValid: true; value: string } | { isValid: false; message: string };

export function validateNickname(input: string): NicknameValidation {
  const value = input.trim();
  if (value.length < 2 || value.length > 12) return { isValid: false, message: '닉네임은 2~12자로 입력해 주세요.' };
  return { isValid: true, value };
}

export function parseProfile(value: unknown): Profile {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.nickname !== 'string' || typeof value.timezone !== 'string' || typeof value.is_onboarded !== 'boolean') {
    throw new Error('Invalid profile response');
  }

  const nickname = validateNickname(value.nickname);
  if (!nickname.isValid) throw new Error('Invalid profile nickname');

  return { id: value.id, nickname: nickname.value, timezone: value.timezone, isOnboarded: value.is_onboarded };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
