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
      accessibilityState={{ ...props.accessibilityState, disabled: disabled ?? false }}
      disabled={disabled}
      style={({ pressed }) => [styles.base, variant === 'primary' ? styles.primary : styles.secondary, disabled && styles.disabled, pressed && !disabled && styles.pressed, style]}>
      <AppText variant="bodyStrong" color={textColor}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing[4] },
  primary: { backgroundColor: colors.ink, borderColor: colors.ink },
  secondary: { backgroundColor: colors.paper, borderColor: colors.ink },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
});
