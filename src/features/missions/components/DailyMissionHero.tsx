import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { Surface } from '@/src/components/ui/Surface';
import { type DailyMission } from '@/src/features/missions/model/dailyMission';
import { formatKstCountdown } from '@/src/features/missions/model/countdown';
import { radius, spacing } from '@/src/design/tokens';

type DailyMissionHeroProps = { mission: DailyMission; millisecondsUntilMidnight: number };

export function DailyMissionHero({ mission, millisecondsUntilMidnight }: DailyMissionHeroProps) {
  return (
    <Surface style={[styles.hero, { backgroundColor: mission.color.accentTint, borderColor: mission.color.accentTint }]}>
      <View style={[styles.colorDisc, { backgroundColor: mission.color.accent }]} accessibilityLabel={`${mission.color.nameKo} 색상`} />
      <View style={styles.copy}>
        <AppText variant="caption" style={{ color: mission.color.accentShade }}>{formatMissionDate(mission.challengeDate)} · 오늘의 색</AppText>
        <AppText variant="title2">{mission.color.nameKo}</AppText>
        <AppText variant="callout" color="secondary">{mission.color.nameEn}</AppText>
        <AppText color="secondary">{mission.promptKo}</AppText>
        <AppText variant="caption" color="secondary">자정까지 {formatKstCountdown(millisecondsUntilMidnight)}</AppText>
      </View>
    </Surface>
  );
}

function formatMissionDate(dateKey: string): string {
  const [, month = '', day = ''] = dateKey.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  colorDisc: { width: 84, height: 84, borderRadius: radius.pill },
  copy: { flex: 1, gap: spacing[1] },
});
