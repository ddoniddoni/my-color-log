import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { LoadingSkeleton } from '@/src/components/feedback/LoadingSkeleton';
import { Screen } from '@/src/components/layout/Screen';
import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { MissionReveal } from '@/src/features/missions/components/MissionReveal';
import { TodayJournal } from '@/src/features/missions/components/TodayJournal';
import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { useDailyEntry } from '@/src/features/entries/hooks/useDailyEntry';
import { getNextPhotoPosition, mergeTodayPhotos } from '@/src/features/entries/model/todayPhotos';
import { useDailyMission } from '@/src/features/missions/hooks/useDailyMission';
import { useKstCountdown } from '@/src/features/missions/hooks/useKstCountdown';
import { useKstDateKey } from '@/src/features/missions/hooks/useKstDateKey';
import { useMissionReveal } from '@/src/features/missions/hooks/useMissionReveal';
import { useReducedMotion } from '@/src/features/missions/hooks/useReducedMotion';
import { useDayPhotoQueue } from '@/src/features/sync/hooks/useDayPhotoQueue';
import { usePhotoSync } from '@/src/features/sync/hooks/usePhotoSync';
import { radius, spacing } from '@/src/design/tokens';

export default function TodayScreen() {
  const router = useRouter();
  const dateKey = useKstDateKey();
  const sessionState = useSessionBootstrap();
  const userId = sessionState.status === 'ready' ? sessionState.session?.user.id ?? null : null;
  const missionQuery = useDailyMission(dateKey);
  const entryQuery = useDailyEntry(userId, dateKey);
  const queueQuery = useDayPhotoQueue(userId, dateKey);
  const reveal = useMissionReveal(dateKey);
  const reduceMotion = useReducedMotion();
  const millisecondsUntilMidnight = useKstCountdown();
  const photoSync = usePhotoSync({ userId, dateKey, photos: queueQuery.data ?? [] });

  if (sessionState.status === 'loading' || missionQuery.isPending || reveal.isLoading) return <TodayLoadingScreen />;
  if (sessionState.status === 'error' || !userId) return <TodayMissionError onRetry={sessionState.retry} />;
  if (entryQuery.isPending || queueQuery.isPending) return <TodayLoadingScreen />;
  if (entryQuery.isError || queueQuery.isError) return <TodayMissionError onRetry={() => { void entryQuery.refetch(); void queueQuery.refetch(); }} />;
  if (missionQuery.isError || !missionQuery.data) return <TodayMissionError onRetry={() => void missionQuery.refetch()} />;

  const mission = missionQuery.data;
  if (!reveal.isRevealed) return <MissionReveal mission={mission} reduceMotion={reduceMotion} onRevealed={reveal.reveal} />;

  const photos = mergeTodayPhotos(entryQuery.data, queueQuery.data ?? []);
  const nextPosition = getNextPhotoPosition(photos);
  const hasSyncFailure = photos.some((photo) => photo.status === 'failed');
  return (
    <TodayJournal
      hasSyncFailure={hasSyncFailure}
      isSyncing={photoSync.isSyncing}
      millisecondsUntilMidnight={millisecondsUntilMidnight}
      mission={mission}
      onCapturePress={() => {
        if (!nextPosition) return;
        router.push({ pathname: '/camera', params: { missionId: mission.id, dateKey, position: String(nextPosition), colorNameEn: mission.color.nameEn } });
      }}
      onRetrySync={() => void photoSync.retryFailed()}
      photos={photos}
    />
  );
}

function TodayLoadingScreen() {
  return <Screen><LoadingSkeleton style={styles.headerSkeleton} /><LoadingSkeleton style={styles.heroSkeleton} /><LoadingSkeleton style={styles.bodySkeleton} /></Screen>;
}

function TodayMissionError({ onRetry }: { onRetry: () => void }) {
  return <Screen contentContainerStyle={styles.errorContent}><View style={styles.errorCopy}><AppText variant="title2">오늘의 색을 불러올 수 없어요</AppText><AppText color="secondary">연결되면 다시 시도할 수 있어요. 임의의 색으로 바꾸지는 않을게요.</AppText></View><Button label="다시 시도" onPress={onRetry} /></Screen>;
}

const styles = StyleSheet.create({
  headerSkeleton: { width: 124, height: 48 },
  heroSkeleton: { height: 190, borderRadius: radius.xl },
  bodySkeleton: { width: '74%', height: 24 },
  errorContent: { justifyContent: 'center' },
  errorCopy: { gap: spacing[3] },
});
