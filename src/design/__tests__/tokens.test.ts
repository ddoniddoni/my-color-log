import { colors, spacing, typography } from '@/src/design/tokens';

describe('design tokens', () => {
  it('keeps the neutral app canvas and readable base typography', () => {
    expect(colors.canvas).toBe('#F7F5F1');
    expect(spacing[5]).toBe(20);
    expect(typography.body.fontSize).toBe(16);
  });
});
