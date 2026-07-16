import { StyleSheet, View } from 'react-native';

import { LoadingSkeleton } from '@/src/components/feedback/LoadingSkeleton';
import { Screen } from '@/src/components/layout/Screen';
import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { DailyMissionHero } from '@/src/features/missions/components/DailyMissionHero';
import { MissionReveal } from '@/src/features/missions/components/MissionReveal';
import { useDailyMission } from '@/src/features/missions/hooks/useDailyMission';
import { useKstCountdown } from '@/src/features/missions/hooks/useKstCountdown';
import { useKstDateKey } from '@/src/features/missions/hooks/useKstDateKey';
import { useMissionReveal } from '@/src/features/missions/hooks/useMissionReveal';
import { useReducedMotion } from '@/src/features/missions/hooks/useReducedMotion';
import { radius, spacing } from '@/src/design/tokens';

export default function TodayScreen() {
  const dateKey = useKstDateKey();
  const missionQuery = useDailyMission(dateKey);
  const reveal = useMissionReveal(dateKey);
  const reduceMotion = useReducedMotion();
  const millisecondsUntilMidnight = useKstCountdown();

  if (missionQuery.isPending || reveal.isLoading) return <TodayLoadingScreen />;
  if (missionQuery.isError || !missionQuery.data) return <TodayMissionError onRetry={() => void missionQuery.refetch()} />;

  const mission = missionQuery.data;
  return (
    <Screen>
      <View style={styles.header}><AppText variant="caption">오늘</AppText><AppText variant="title1">나의 컬러 기록</AppText></View>
      {reveal.isRevealed ? <DailyMissionHero mission={mission} millisecondsUntilMidnight={millisecondsUntilMidnight} /> : <MissionReveal mission={mission} reduceMotion={reduceMotion} onRevealed={reveal.reveal} />}
      <View style={styles.emptyState}>
        <AppText variant="title3">한 장만 남겨도 오늘의 기록이에요.</AppText>
        <AppText color="secondary">카메라와 로컬 저장 기능은 다음 단계에서 연결돼요.</AppText>
      </View>
      <Button label="첫 번째 색 발견하기" disabled accessibilityHint="카메라 기능 준비 중" />
    </Screen>
  );
}

function TodayLoadingScreen() {
  return <Screen><LoadingSkeleton style={styles.headerSkeleton} /><LoadingSkeleton style={styles.heroSkeleton} /><LoadingSkeleton style={styles.bodySkeleton} /></Screen>;
}

function TodayMissionError({ onRetry }: { onRetry: () => void }) {
  return <Screen contentContainerStyle={styles.errorContent}><View style={styles.errorCopy}><AppText variant="title2">오늘의 색을 불러올 수 없어요</AppText><AppText color="secondary">연결되면 다시 시도할 수 있어요. 임의의 색으로 바꾸지는 않을게요.</AppText></View><Button label="다시 시도" onPress={onRetry} /></Screen>;
}

const styles = StyleSheet.create({
  header: { gap: spacing[1] },
  emptyState: { gap: spacing[2], paddingVertical: spacing[4] },
  headerSkeleton: { width: 124, height: 48 },
  heroSkeleton: { height: 190, borderRadius: radius.xl },
  bodySkeleton: { width: '74%', height: 24 },
  errorContent: { justifyContent: 'center' },
  errorCopy: { gap: spacing[3] },
});
