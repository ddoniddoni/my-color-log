import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { radius, spacing } from '@/src/design/tokens';

export function OfflineBanner({ visible }: { visible: boolean }) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();

  if (!visible) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
      style={[styles.container, { top: insets.top + spacing[2] }]}
    >
      <View style={[styles.banner, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}>
        <AppText style={[styles.title, { color: theme.colors.ink }]}>지금은 오프라인이에요.</AppText>
        <AppText style={[styles.description, { color: theme.colors.textSecondary }]}>사진은 기기에 보관하고, 연결되면 자동으로 다시 올릴게요.</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { left: spacing[4], position: 'absolute', right: spacing[4], zIndex: 100 },
  banner: { borderRadius: radius.md, borderWidth: 1, gap: spacing[1], padding: spacing[3] },
  title: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  description: { fontSize: 12, lineHeight: 17 },
});
