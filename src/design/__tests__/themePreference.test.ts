import { parseThemePreference } from '@/src/design/themePreference';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

describe('theme preference', () => {
  it('uses the system setting for missing or malformed persisted values', () => {
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference('night')).toBe('system');
  });

  it('preserves supported choices', () => {
    expect(parseThemePreference('system')).toBe('system');
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
  });
});
