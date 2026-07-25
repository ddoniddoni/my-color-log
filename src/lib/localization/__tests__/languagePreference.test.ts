import { parseLanguagePreference } from '@/src/lib/localization/languagePreference';
import { translateText } from '@/src/lib/localization/translations';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

describe('language preference', () => {
  it('uses Korean for missing or malformed persisted values', () => {
    expect(parseLanguagePreference(null)).toBe('ko');
    expect(parseLanguagePreference('fr')).toBe('ko');
  });

  it('preserves Korean and English choices', () => {
    expect(parseLanguagePreference('ko')).toBe('ko');
    expect(parseLanguagePreference('en')).toBe('en');
  });

  it('translates registered text in both directions', () => {
    expect(translateText('ko', 'New Canvas')).toBe('새로운 캔버스');
    expect(translateText('en', '새로운 캔버스')).toBe('New Canvas');
  });

  it('localizes email entry guidance and validation feedback', () => {
    expect(translateText('ko', 'Enter your email.')).toBe('이메일을 입력해 주세요.');
    expect(translateText('en', '이메일을 입력해 주세요.')).toBe('Enter your email.');
    expect(translateText('en', '이메일 주소를 확인해 주세요.')).toBe('Check your email address.');
    expect(translateText('en', '비밀번호 표시')).toBe('Show password');
  });
});
