import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { radius, spacing } from '@/src/design/tokens';
import { useOptionalAppLanguage } from '@/src/lib/localization/LanguageProvider';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, variant = 'primary', style, disabled, accessibilityLabel, ...props }: ButtonProps) {
  const theme = useAppTheme();
  const { t } = useOptionalAppLanguage();
  const textColor = variant === 'primary' ? 'inverse' : 'primary';
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={t(accessibilityLabel ?? label)}
      accessibilityState={{ ...props.accessibilityState, disabled: disabled ?? false }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary'
          ? { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink }
          : { backgroundColor: theme.colors.paper, borderColor: theme.colors.ink },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <AppText variant="bodyStrong" color={textColor}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing[4] },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
});
