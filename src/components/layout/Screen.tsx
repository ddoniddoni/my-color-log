import { type PropsWithChildren, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing } from '@/src/design/tokens';

export function Screen({ children, contentContainerStyle, header, ...props }: PropsWithChildren<ScrollViewProps & { header?: ReactNode }>) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const content = <ScrollView {...props} style={[styles.screen, { backgroundColor: theme.colors.canvas }]} contentContainerStyle={[styles.content, { paddingTop: header ? spacing[5] : Math.max(insets.top, spacing[5]), paddingBottom: Math.max(insets.bottom, spacing[6]) }, contentContainerStyle]}>{children}</ScrollView>;
  return header ? <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>{header}{content}</View> : content;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flexGrow: 1, gap: spacing[6], paddingHorizontal: spacing[5] } });
