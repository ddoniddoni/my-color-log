import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { colors, radius, spacing } from '@/src/design/tokens';

export function OfflineBanner() {
  return <View accessibilityRole="alert" style={styles.banner}><AppText variant="callout">지금은 오프라인이에요. 연결되면 자동으로 다시 올릴게요.</AppText></View>;
}

const styles = StyleSheet.create({ banner: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing[3] } });
