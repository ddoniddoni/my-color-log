import { type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/src/design/tokens';

export function Screen({ children, contentContainerStyle, ...props }: PropsWithChildren<ScrollViewProps>) {
  const insets = useSafeAreaInsets();
  return <ScrollView {...props} style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, spacing[5]), paddingBottom: Math.max(insets.bottom, spacing[6]) }, contentContainerStyle]}>{children}</ScrollView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.canvas }, content: { flexGrow: 1, gap: spacing[6], paddingHorizontal: spacing[5] } });
