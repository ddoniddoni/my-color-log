export const colors = {
  canvas: '#F7F5F1',
  surface: '#FFFFFF',
  surfaceMuted: '#F0EEE9',
  textPrimary: '#1D1C1A',
  textSecondary: '#6C6963',
  textTertiary: '#9A968E',
  border: '#E3E0D9',
  borderStrong: '#CBC7BE',
  overlay: 'rgba(20, 19, 18, 0.52)',
  success: '#2F7D59',
  warning: '#9A681B',
  danger: '#B74747',
  info: '#416E91',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

export const radius = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;

export const typography = {
  display: { fontSize: 36, lineHeight: 44, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 35, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 29, fontWeight: '700' },
  title3: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  callout: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
} as const;
