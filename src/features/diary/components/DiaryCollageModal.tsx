import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { Image } from 'expo-image';

import { AppConfirmationDialog } from '@/src/components/ui/AppConfirmationDialog';
import { AppModal } from '@/src/components/ui/AppModal';
import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing, type ThemeColors } from '@/src/design/tokens';
import { saveDiaryCollageToLibrary, shareDiaryCollage } from '@/src/features/diary/api/collageRepository';
import { DIARY_COLLAGE_MAX_PHOTOS, getDiaryCollageFilename, getDiaryCollageRowCounts } from '@/src/features/diary/model/diaryCollage';
import { type DiaryEntry, type DiaryPhoto } from '@/src/features/diary/model/diaryMonth';
import { formatDateKey } from '@/src/lib/localization/dateFormat';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

type DiaryCollageModalProps = {
  entry: DiaryEntry | null;
  onClose: () => void;
  visible: boolean;
};

type CollageAction = 'idle' | 'saving' | 'sharing';

type CollageNotice = {
  description: string;
  title: string;
};

export function DiaryCollageModal({ entry, onClose, visible }: DiaryCollageModalProps) {
  if (!entry || !visible) return null;

  return <DiaryCollageContent entry={entry} onClose={onClose} />;
}

function DiaryCollageContent({ entry, onClose }: Pick<DiaryCollageModalProps, 'entry' | 'onClose'> & { entry: DiaryEntry }) {
  const styles = useDiaryCollageStyles();
  const { format, language, t } = useAppLanguage();
  const viewShotRef = useRef<ViewShotRef>(null);
  const imageLoadStates = useRef(new Map<string, 'failed' | 'loaded'>());
  const [loadedImageCount, setLoadedImageCount] = useState(0);
  const [failedImageCount, setFailedImageCount] = useState(0);
  const [action, setAction] = useState<CollageAction>('idle');
  const [notice, setNotice] = useState<CollageNotice | null>(null);
  const exportablePhotos = useMemo(() => entry.photos.filter(hasSignedUrl), [entry.photos]);
  const rowCounts = useMemo(() => exportablePhotos.length > 0 ? getDiaryCollageRowCounts(exportablePhotos.length) : [], [exportablePhotos.length]);
  const imagesAreReady = exportablePhotos.length > 0 && exportablePhotos.length === entry.photos.length && loadedImageCount === exportablePhotos.length;
  const isWorking = action !== 'idle';

  const markImageSettled = useCallback((photoId: string, state: 'failed' | 'loaded'): void => {
    if (imageLoadStates.current.has(photoId)) return;
    imageLoadStates.current.set(photoId, state);
    if (state === 'loaded') setLoadedImageCount((count) => count + 1);
    else setFailedImageCount((count) => count + 1);
  }, []);

  const captureCollage = async (): Promise<string> => {
    if (!imagesAreReady || !viewShotRef.current) throw new Error('diary_collage_not_ready');
    return viewShotRef.current.capture();
  };

  const saveToLibrary = async (): Promise<void> => {
    try {
      setAction('saving');
      await saveDiaryCollageToLibrary(await captureCollage());
      setNotice({
        description: format('{date}의 {colorName} 기록을 기기에 남겼어요.', {
          colorName: language === 'ko' ? entry.color.nameKo : entry.color.nameEn,
          date: formatDateKey(entry.dateKey, language, 'monthDay'),
        }),
        title: t('갤러리에 저장했어요'),
      });
    } catch (error) {
      setNotice({ description: getCollageErrorMessage(error, 'save', t), title: t('저장하지 못했어요') });
    } finally {
      setAction('idle');
    }
  };

  const share = async (): Promise<void> => {
    try {
      setAction('sharing');
      await shareDiaryCollage(await captureCollage());
    } catch (error) {
      setNotice({ description: getCollageErrorMessage(error, 'share', t), title: t('공유하지 못했어요') });
    } finally {
      setAction('idle');
    }
  };

  const close = (): void => {
    if (!isWorking) onClose();
  };

  return (
    <>
      <AppModal accessibilityLabel={t('콜라주 내보내기 닫기')} contentStyle={styles.card} isBusy={isWorking} onClose={close} visible>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <AppText style={styles.eyebrow}>MY COLOR LOG</AppText>
            <AppText style={styles.title}>오늘의 기록 내보내기</AppText>
            <AppText style={styles.description}>내 사진만 한 장의 콜라주로 만들어요.</AppText>
          </View>
          <Pressable accessibilityLabel={t('콜라주 내보내기 닫기')} accessibilityRole="button" accessibilityState={{ disabled: isWorking }} disabled={isWorking} onPress={close} style={[styles.closeButton, isWorking && styles.disabledButton]}>
            <AppText style={styles.closeButtonText}>×</AppText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.previewScroll} showsVerticalScrollIndicator={false}>
          <ViewShot
            options={{
              fileName: getDiaryCollageFilename(entry.dateKey, entry.color.slug),
              format: 'jpg',
              height: 1350,
              quality: 0.96,
              width: 1080,
            }}
            ref={viewShotRef}
            style={styles.viewShot}>
            <View style={[styles.collage, { backgroundColor: entry.color.accentTint }]}>
              <View style={styles.collageHeader}>
                <View style={styles.collageTitleWrap}>
                  <AppText localize={false} style={styles.collageEyebrow}>{formatDateKey(entry.dateKey, language, 'numeric')}</AppText>
                  <AppText localize={false} numberOfLines={1} style={styles.collageColorName}>{language === 'ko' ? entry.color.nameKo : entry.color.nameEn}</AppText>
                  {language === 'ko' ? <AppText localize={false} style={styles.collageColorEnglish}>{entry.color.nameEn.toUpperCase()}</AppText> : null}
                </View>
                <View accessible accessibilityLabel={format('{colorName} 색', { colorName: language === 'ko' ? entry.color.nameKo : entry.color.nameEn })} accessibilityRole="image" style={[styles.colorMark, { backgroundColor: entry.color.accent }]} />
              </View>
              <CollagePhotoGrid onImageSettled={markImageSettled} photos={exportablePhotos} rowCounts={rowCounts} />
              <View style={styles.collageFooter}>
                <AppText localize={false} style={styles.collageFooterText}>{language === 'ko' ? `COLOR LOG · 사진 ${exportablePhotos.length}장` : `COLOR LOG · ${exportablePhotos.length} PHOTO${exportablePhotos.length === 1 ? '' : 'S'}`}</AppText>
                <View style={styles.footerLine} />
              </View>
            </View>
          </ViewShot>

          <View accessibilityLiveRegion="polite" style={styles.readyNotice}>
            <AppText style={styles.readyNoticeText}>{imagesAreReady ? '콜라주가 준비됐어요.' : failedImageCount > 0 ? '사진을 불러오지 못했어요. 다이어리를 다시 열어 주세요.' : entry.photos.length === 0 ? '내보낼 사진을 기다리고 있어요.' : '사진을 콜라주로 준비하고 있어요.'}</AppText>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable accessibilityLabel={t('콜라주를 갤러리에 저장')} accessibilityRole="button" accessibilityState={{ disabled: !imagesAreReady || isWorking }} disabled={!imagesAreReady || isWorking} onPress={() => void saveToLibrary()} style={[styles.saveButton, (!imagesAreReady || isWorking) && styles.disabledButton]}>
            <AppText style={styles.saveButtonText}>{action === 'saving' ? '저장하는 중...' : '갤러리에 저장'}</AppText>
          </Pressable>
          <Pressable accessibilityLabel={t('콜라주 공유하기')} accessibilityRole="button" accessibilityState={{ disabled: !imagesAreReady || isWorking }} disabled={!imagesAreReady || isWorking} onPress={() => void share()} style={[styles.shareButton, (!imagesAreReady || isWorking) && styles.disabledButton]}>
            <AppText style={styles.shareButtonText}>{action === 'sharing' ? '공유 여는 중...' : '공유하기'}</AppText>
          </Pressable>
        </View>
      </AppModal>
      <AppConfirmationDialog
        confirmLabel="확인"
        description={notice?.description ?? ''}
        onClose={() => setNotice(null)}
        onConfirm={() => setNotice(null)}
        title={notice?.title ?? ''}
        visible={notice !== null}
      />
    </>
  );
}

function CollagePhotoGrid({ onImageSettled, photos, rowCounts }: { onImageSettled: (photoId: string, state: 'failed' | 'loaded') => void; photos: DiaryPhoto[]; rowCounts: readonly number[] }) {
  const styles = useDiaryCollageStyles();
  const photoSlots = Array.from({ length: DIARY_COLLAGE_MAX_PHOTOS }, (_, index) => photos[index] ?? null);

  return (
    <View style={styles.collageGrid}>
      {rowCounts.map((rowCount, rowIndex) => {
        const rowStart = rowCounts.slice(0, rowIndex).reduce((total, previousRowCount) => total + previousRowCount, 0);
        const rowPhotos = photoSlots.slice(rowStart, rowStart + rowCount);
        return (
          <View key={`collage-row-${rowIndex}`} style={styles.collageRow}>
            {rowPhotos.map((photo, columnIndex) => (
              <View key={photo?.id ?? `empty-collage-slot-${rowIndex}-${columnIndex}`} style={[styles.collageTile, !photo && styles.collageEmptyTile]}>
                {photo ? <Image cachePolicy="memory-disk" contentFit="cover" onError={() => onImageSettled(photo.id, 'failed')} onLoad={() => onImageSettled(photo.id, 'loaded')} source={{ uri: photo.signedUrl ?? undefined }} style={styles.collageImage} /> : null}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function hasSignedUrl(photo: DiaryPhoto): photo is DiaryPhoto & { signedUrl: string } {
  return typeof photo.signedUrl === 'string' && photo.signedUrl.length > 0;
}

function getCollageErrorMessage(error: unknown, action: 'save' | 'share', t: (text: string) => string): string {
  if (error instanceof Error && error.message === 'diary_collage_save_permission_denied') return t('갤러리에 저장하려면 사진 추가 권한을 허용해 주세요.');
  if (error instanceof Error && error.message === 'diary_collage_sharing_unavailable') return t('이 기기에서는 공유 기능을 사용할 수 없어요.');
  if (error instanceof Error && error.message === 'diary_collage_not_ready') return t('사진을 모두 불러온 뒤 다시 시도해 주세요.');
  return action === 'save' ? t('잠시 뒤 다시 저장해 주세요.') : t('잠시 뒤 다시 공유해 주세요.');
}

function useDiaryCollageStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: { maxHeight: '90%' },
  header: { alignItems: 'flex-start', borderBottomColor: colors.ink, borderBottomWidth: 1.5, flexDirection: 'row', justifyContent: 'space-between', padding: spacing[4] },
  headerCopy: { flex: 1, paddingRight: spacing[3] },
  eyebrow: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.9 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.7, lineHeight: 28, marginTop: 2 },
  description: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  closeButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, height: 44, justifyContent: 'center', width: 44 },
  closeButtonText: { color: colors.ink, fontSize: 27, fontWeight: '300', lineHeight: 30 },
  previewScroll: { gap: spacing[3], padding: spacing[4] },
  viewShot: { alignSelf: 'center', aspectRatio: 4 / 5, maxWidth: 330, width: '100%' },
  collage: { borderColor: colors.ink, borderWidth: 1.5, flex: 1, gap: 10, padding: 12 },
  collageHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  collageTitleWrap: { flex: 1, paddingRight: 8 },
  collageEyebrow: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.7 },
  collageColorName: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.75, lineHeight: 27, marginTop: 1 },
  collageColorEnglish: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.65 },
  colorMark: { borderColor: colors.ink, borderRadius: 16, borderWidth: 1.5, height: 32, width: 32 },
  collageGrid: { aspectRatio: 1, gap: 4, width: '100%' },
  collageRow: { flex: 1, flexDirection: 'row', gap: 4 },
  collageTile: { backgroundColor: colors.surfaceMuted, flex: 1, overflow: 'hidden' },
  collageEmptyTile: { backgroundColor: colors.canvas, borderColor: colors.border, borderStyle: 'dashed', borderWidth: 1 },
  collageImage: { height: '100%', width: '100%' },
  collageFooter: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  collageFooterText: { color: colors.ink, fontFamily: 'monospace', fontSize: 7, fontWeight: '700', letterSpacing: 0.5 },
  footerLine: { backgroundColor: colors.borderStrong, flex: 1, height: 1 },
  readyNotice: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  readyNoticeText: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  actions: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: spacing[2], padding: spacing[4] },
  saveButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 8 },
  saveButtonText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  shareButton: { alignItems: 'center', backgroundColor: colors.ink, boxShadow: `3px 3px 0px ${colors.black}`, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 8 },
  shareButtonText: { color: colors.surface, fontSize: 13, fontWeight: '800' },
  disabledButton: { opacity: 0.38 },
  });
}
