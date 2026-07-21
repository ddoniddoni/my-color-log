import { parseProfile, validateNickname } from '@/src/features/profile/model/profile';

describe('validateNickname', () => {
  it('trims a valid nickname', () => {
    expect(validateNickname('  오늘빛  ')).toEqual({ isValid: true, value: '오늘빛' });
  });

  it.each(['', 'a', '1234567890123'])('rejects an out-of-range nickname: %s', (nickname) => {
    expect(validateNickname(nickname).isValid).toBe(false);
  });
});

describe('parseProfile', () => {
  it('maps a valid database row to the domain model', () => {
    expect(parseProfile({ id: 'user-id', nickname: '오늘빛', timezone: 'Asia/Seoul', is_onboarded: true })).toEqual({ id: 'user-id', nickname: '오늘빛', timezone: 'Asia/Seoul', isOnboarded: true });
  });

  it('rejects malformed rows', () => {
    expect(() => parseProfile({ id: 'user-id', nickname: 'a', timezone: 'Asia/Seoul', is_onboarded: true })).toThrow('Invalid profile nickname');
  });

  it('rejects a non-IANA timezone', () => {
    expect(() => parseProfile({ id: 'user-id', nickname: '오늘빛', timezone: 'GMT+9ish', is_onboarded: true })).toThrow('Invalid profile timezone');
  });
});
