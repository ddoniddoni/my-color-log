import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/src/components/ui/AppText';
import { colors, radius, spacing } from '@/src/design/tokens';

export function OfflineBanner({ visible }: { visible: boolean }) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
      style={[styles.container, { top: insets.top + spacing[2] }]}
    >
      <View style={styles.banner}>
        <AppText style={styles.title}>지금은 오프라인이에요.</AppText>
        <AppText style={styles.description}>사진은 기기에 보관하고, 연결되면 자동으로 다시 올릴게요.</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { left: spacing[4], position: 'absolute', right: spacing[4], zIndex: 100 },
  banner: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong, borderRadius: radius.md, borderWidth: 1, gap: spacing[1], padding: spacing[3] },
  title: { color: colors.ink, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  description: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
});
