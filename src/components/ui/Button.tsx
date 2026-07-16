import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { colors, radius, spacing } from '@/src/design/tokens';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, variant = 'primary', style, disabled, accessibilityLabel, ...props }: ButtonProps) {
  const textColor = variant === 'primary' ? 'inverse' : 'primary';
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      style={({ pressed }) => [styles.base, variant === 'primary' ? styles.primary : styles.secondary, disabled && styles.disabled, pressed && !disabled && styles.pressed, style]}>
      <AppText variant="bodyStrong" color={textColor}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: spacing[4] },
  primary: { backgroundColor: colors.textPrimary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78 },
});
