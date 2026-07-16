import { type PropsWithChildren } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, typography } from '@/src/design/tokens';

type TextVariant = keyof typeof typography;
type TextColor = 'primary' | 'secondary' | 'tertiary' | 'inverse';

type AppTextProps = PropsWithChildren<TextProps> & {
  variant?: TextVariant;
  color?: TextColor;
};

const colorMap: Record<TextColor, string> = {
  primary: colors.textPrimary,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  inverse: colors.white,
};

export function AppText({ children, variant = 'body', color = 'primary', style, ...props }: AppTextProps) {
  return <Text {...props} style={[styles.base, typography[variant], { color: colorMap[color] }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({ base: { flexShrink: 1 } });
