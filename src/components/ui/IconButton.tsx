import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { colors, radius } from '@/src/design/tokens';

type IconButtonProps = Omit<PressableProps, 'children' | 'style'> & { label: string; symbol: string; style?: StyleProp<ViewStyle> };

export function IconButton({ label, symbol, style, ...props }: IconButtonProps) {
  return (
    <Pressable {...props} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [styles.base, pressed && styles.pressed, style]}>
      <AppText>{symbol}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({ base: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill }, pressed: { backgroundColor: colors.surfaceMuted } });
