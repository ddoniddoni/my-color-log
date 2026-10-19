import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing } from '@/src/design/tokens';
import { formatCountdown } from '@/src/features/missions/model/countdown';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

export function NextColorCountdown({ milliseconds }: { milliseconds: number }) {
  const { colors } = useAppTheme();
  const { format } = useAppLanguage();
  const countdown = formatCountdown(milliseconds);
  return (
    <View accessible accessibilityLabel={format('다음 색까지 {countdown}', { countdown })} style={styles.row}>
      <AppText variant="caption" color="secondary">{milliseconds <= 60_000 ? '곧 새로운 색이 열려요' : '다음 색까지'}</AppText>
      <View style={[styles.separator, { backgroundColor: colors.borderStrong }]} />
      <AppText localize={false} variant="caption" style={styles.time}>{countdown}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: spacing[2], paddingVertical: spacing[1] },
  separator: { width: 12, height: StyleSheet.hairlineWidth },
  time: { fontVariant: ['tabular-nums'], letterSpacing: 0.8, fontWeight: '600' },
});
