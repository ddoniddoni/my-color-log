import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, spacing } from '@/src/design/tokens';

export function Surface({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.surface, style]} />;
}

const styles = StyleSheet.create({ surface: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, gap: spacing[2], padding: spacing[4] } });
