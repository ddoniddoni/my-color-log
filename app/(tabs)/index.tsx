import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoadingSkeleton } from '@/src/components/feedback/LoadingSkeleton';
import { Screen } from '@/src/components/layout/Screen';
import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { PhotoSourceModal } from '@/src/features/camera/components/PhotoSourceModal';
import { usePhotoSourceSelection } from '@/src/features/camera/hooks/usePhotoSourceSelection';
import { MissionReveal } from '@/src/features/missions/components/MissionReveal';
import { TodayJournal } from '@/src/features/missions/components/TodayJournal';
import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { useDailyEntry } from '@/src/features/entries/hooks/useDailyEntry';
import { useTodayPhotoActions } from '@/src/features/entries/hooks/useTodayPhotoActions';
import { TodayPhotoManagerModal } from '@/src/features/entries/components/TodayPhotoManagerModal';
import { canMovePhoto } from '@/src/features/entries/model/photoManagement';
import { getNextPhotoPosition, mergeTodayPhotos } from '@/src/features/entries/model/todayPhotos';
import { useDailyMission } from '@/src/features/missions/hooks/useDailyMission';
import { useKstCountdown } from '@/src/features/missions/hooks/useKstCountdown';
import { useKstDateKey } from '@/src/features/missions/hooks/useKstDateKey';
import { useMissionReveal } from '@/src/features/missions/hooks/useMissionReveal';
import { useMissionRevealPalette } from '@/src/features/missions/hooks/useMissionRevealPalette';
import { useReducedMotion } from '@/src/features/missions/hooks/useReducedMotion';
import { useDayPhotoQueue } from '@/src/features/sync/hooks/useDayPhotoQueue';
import { usePhotoSync } from '@/src/features/sync/hooks/usePhotoSync';
import { radius, spacing } from '@/src/design/tokens';

export default function TodayScreen() {
  const dateKey = useKstDateKey();
  const sessionState = useSessionBootstrap();
  const userId = sessionState.status === 'ready' ? sessionState.session?.user.id ?? null : null;
  const missionQuery = useDailyMission(dateKey);
  const entryQuery = useDailyEntry(userId, dateKey);
  const queueQuery = useDayPhotoQueue(userId, dateKey);
  const reveal = useMissionReveal(dateKey);
  const revealPaletteQuery = useMissionRevealPalette(dateKey, !reveal.isRevealed);
  const reduceMotion = useReducedMotion();
  const millisecondsUntilMidnight = useKstCountdown();
  const photoSync = usePhotoSync(dateKey);
  const photoActions = useTodayPhotoActions({ dateKey, entry: entryQuery.data, queuedPhotos: queueQuery.data ?? [], userId });
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const photoSource = usePhotoSourceSelection();

  if (sessionState.status === 'loading' || missionQuery.isPending || reveal.isLoading || (!reveal.isRevealed && revealPaletteQuery.isPending)) return <TodayLoadingScreen />;
  if (sessionState.status === 'error' || !userId) return <TodayMissionError onRetry={sessionState.retry} />;
  if (entryQuery.isPending || queueQuery.isPending) return <TodayLoadingScreen />;
  if (entryQuery.isError || queueQuery.isError) return <TodayMissionError onRetry={() => { void entryQuery.refetch(); void queueQuery.refetch(); }} />;
  if (missionQuery.isError || (!reveal.isRevealed && revealPaletteQuery.isError) || !missionQuery.data) return <TodayMissionError onRetry={() => { void missionQuery.refetch(); void revealPaletteQuery.refetch(); }} />;

  const mission = missionQuery.data;
  if (!reveal.isRevealed) {
    if (!revealPaletteQuery.data) return <TodayMissionError onRetry={() => void revealPaletteQuery.refetch()} />;
    return <MissionReveal mission={mission} palette={revealPaletteQuery.data} reduceMotion={reduceMotion} onRevealed={reveal.reveal} />;
  }

  const photos = mergeTodayPhotos(entryQuery.data, queueQuery.data ?? []);
  const nextPosition = getNextPhotoPosition(photos);
  const hasSyncFailure = photos.some((photo) => photo.status === 'failed');
  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId) ?? null;
  return (
    <>
      <TodayJournal
        hasSyncFailure={hasSyncFailure}
        isSyncing={photoSync.isSyncing}
        millisecondsUntilMidnight={millisecondsUntilMidnight}
        mission={mission}
        onAddPhotoPress={() => {
          if (!nextPosition) return;
          photoSource.openPhotoSource({
            colorHex: mission.color.accent,
            colorNameEn: mission.color.nameEn,
            dateKey,
            missionId: mission.id,
            position: nextPosition,
            userId,
          });
        }}
        onPhotoLongPress={(photo) => setSelectedPhotoId(photo.id)}
        onPhotoPress={(photo) => setSelectedPhotoId(photo.id)}
        onRetrySync={() => void photoSync.retryFailed()}
        photos={photos}
      />
      <TodayPhotoManagerModal
        moveAvailability={{
          backward: selectedPhoto ? canMovePhoto(photos, selectedPhoto.id, 'backward') : false,
          forward: selectedPhoto ? canMovePhoto(photos, selectedPhoto.id, 'forward') : false,
        }}
        onClose={() => setSelectedPhotoId(null)}
        onDelete={photoActions.deletePhoto}
        onMove={(photo, direction) => photoActions.movePhoto({ direction, photoId: photo.id, photos })}
        operation={photoActions.isDeleting ? 'deleting' : photoActions.isMoving || photoSync.isSyncing ? 'moving' : 'idle'}
        selectedPhoto={selectedPhoto}
        visible={selectedPhoto !== null}
      />
      <PhotoSourceModal
        errorMessage={photoSource.errorMessage}
        isImporting={photoSource.isGalleryImporting}
        onCamera={photoSource.chooseCamera}
        onClose={photoSource.closePhotoSource}
        onGallery={() => void photoSource.chooseGallery()}
        visible={photoSource.isSourceModalVisible}
      />
    </>
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
