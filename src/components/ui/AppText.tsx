import { type PropsWithChildren } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { useAppTheme } from '@/src/design/ThemeProvider';
import { typography } from '@/src/design/tokens';

type TextVariant = keyof typeof typography;
type TextColor = 'primary' | 'secondary' | 'tertiary' | 'inverse';

type AppTextProps = PropsWithChildren<TextProps> & {
  variant?: TextVariant;
  color?: TextColor;
};

export function AppText({ children, variant = 'body', color = 'primary', style, ...props }: AppTextProps) {
  const theme = useAppTheme();
  const colorMap: Record<TextColor, string> = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    inverse: theme.colors.white,
  };

  return <Text {...props} style={[styles.base, typography[variant], { color: colorMap[color] }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({ base: { flexShrink: 1 } });
