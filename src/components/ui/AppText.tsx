import { Children, type PropsWithChildren, type ReactNode } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { useAppTheme } from '@/src/design/ThemeProvider';
import { typography } from '@/src/design/tokens';
import { useOptionalAppLanguage } from '@/src/lib/localization/LanguageProvider';

type TextVariant = keyof typeof typography;
type TextColor = 'primary' | 'secondary' | 'tertiary' | 'inverse';

type AppTextProps = PropsWithChildren<TextProps> & {
  variant?: TextVariant;
  color?: TextColor;
  localize?: boolean;
};

export function AppText({ children, variant = 'body', color = 'primary', localize = true, style, ...props }: AppTextProps) {
  const theme = useAppTheme();
  const { t } = useOptionalAppLanguage();
  const colorMap: Record<TextColor, string> = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    inverse: theme.colors.white,
  };

  return <Text {...props} style={[styles.base, typography[variant], { color: colorMap[color] }, style]}>{localize ? localizeChildren(children, t) : children}</Text>;
}

function localizeChildren(children: ReactNode, t: (text: string) => string): ReactNode {
  return Children.map(children, (child) => typeof child === 'string' ? t(child) : child);
}

const styles = StyleSheet.create({ base: { flexShrink: 1 } });
