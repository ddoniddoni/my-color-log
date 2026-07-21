import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius } from '@/src/design/tokens';

export function LoadingSkeleton({ style }: { style?: ViewStyle }) {
  return <View accessibilityLabel="불러오는 중" accessibilityRole="progressbar" accessible style={[styles.base, style]} />;
}

const styles = StyleSheet.create({ base: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md } });
