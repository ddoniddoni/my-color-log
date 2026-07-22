import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppModal } from '@/src/components/ui/AppModal';
import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing, type ThemeColors } from '@/src/design/tokens';
import { type DiaryEntry, type DiaryPhoto } from '@/src/features/diary/model/diaryMonth';

type DiaryPhotoViewerProps = {
  entry: DiaryEntry | null;
  isDeleting: boolean;
  selectedPhotoId: string | null;
  onClose: () => void;
  onDeletePhoto: (photo: DiaryPhoto) => void;
  onEditPhoto: (photo: DiaryPhoto) => void;
  onSelectPhoto: (photoId: string) => void;
  timeZone: string;
};

export function DiaryPhotoViewer({ entry, isDeleting, selectedPhotoId, onClose, onDeletePhoto, onEditPhoto, onSelectPhoto, timeZone }: DiaryPhotoViewerProps) {
  const styles = useDiaryPhotoViewerStyles();
  const photoDateFormatter = useMemo(() => new Intl.DateTimeFormat('ko-KR', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }), [timeZone]);
  const selectedIndex = entry?.photos.findIndex((photo) => photo.id === selectedPhotoId) ?? -1;
  const photo = selectedIndex >= 0 && entry ? entry.photos[selectedIndex] : null;
  const previousPhoto = selectedIndex > 0 && entry ? entry.photos[selectedIndex - 1] : null;
  const nextPhoto = entry && selectedIndex >= 0 && selectedIndex < entry.photos.length - 1 ? entry.photos[selectedIndex + 1] : null;

  if (!photo || !entry) return null;

  return (
    <AppModal accessibilityLabel="사진 전체 보기 닫기" contentStyle={styles.card} onClose={onClose} visible>
      <ScrollView bounces={false} contentContainerStyle={styles.content} style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.photoSection}>
              <Image accessibilityLabel={`${entry.color.nameKo} 사진`} cachePolicy="memory-disk" contentFit="contain" source={photo.signedUrl ? { uri: photo.signedUrl } : null} style={styles.photo} />
              <Pressable accessibilityLabel="사진 전체 보기 닫기" accessibilityRole="button" accessibilityState={{ disabled: isDeleting }} disabled={isDeleting} hitSlop={10} onPress={onClose} style={[styles.closeButton, isDeleting && styles.disabledAction]}><CloseIcon /></Pressable>
              {previousPhoto ? <Pressable accessibilityLabel="이전 사진" accessibilityRole="button" accessibilityState={{ disabled: isDeleting }} disabled={isDeleting} onPress={() => onSelectPhoto(previousPhoto.id)} style={[styles.photoNav, styles.previousButton, isDeleting && styles.disabledAction]}><Chevron direction="left" /></Pressable> : null}
              {nextPhoto ? <Pressable accessibilityLabel="다음 사진" accessibilityRole="button" accessibilityState={{ disabled: isDeleting }} disabled={isDeleting} onPress={() => onSelectPhoto(nextPhoto.id)} style={[styles.photoNav, styles.nextButton, isDeleting && styles.disabledAction]}><Chevron direction="right" /></Pressable> : null}
            </View>

            <View style={styles.metaSection}>
              <View style={styles.metaHeader}>
                <View>
                  <AppText style={styles.metaLabel}>DATE & TIME</AppText>
                  <AppText style={styles.dateValue}>{formatPhotoDate(photo.capturedAt, photoDateFormatter)}</AppText>
                </View>
                <AppText style={styles.positionValue}>{selectedIndex + 1} / {entry.photos.length}</AppText>
              </View>
              <View style={styles.divider} />
              <AppText style={styles.memoLabel}>USER MEMO</AppText>
              <AppText style={styles.memoValue}>{photo.caption ?? '이 사진에 남긴 메모가 없어요.'}</AppText>
              <View style={styles.divider} />
              <View style={styles.colorRow}><View style={[styles.colorDot, { backgroundColor: entry.color.accent }]} /><AppText style={styles.colorText}>{entry.color.nameKo} · {entry.color.nameEn}</AppText></View>
              <View style={styles.actions}>
                <Pressable accessibilityLabel="사진 메모 수정" accessibilityRole="button" accessibilityState={{ disabled: isDeleting }} disabled={isDeleting} onPress={() => onEditPhoto(photo)} style={[styles.editAction, isDeleting && styles.disabledAction]}><AppText style={styles.editActionText}>메모 수정</AppText></Pressable>
                <Pressable accessibilityLabel="이 사진 삭제" accessibilityRole="button" accessibilityState={{ busy: isDeleting, disabled: isDeleting }} disabled={isDeleting} onPress={() => onDeletePhoto(photo)} style={[styles.deleteAction, isDeleting && styles.disabledAction]}><AppText style={styles.deleteActionText}>{isDeleting ? '삭제 중…' : '사진 삭제'}</AppText></Pressable>
              </View>
            </View>
      </ScrollView>
    </AppModal>
  );
}

function formatPhotoDate(value: string, formatter: Intl.DateTimeFormat): string {
  return formatter.format(new Date(value)).replace(/\.$/, '').replace(/\s/g, ' ');
}

function CloseIcon() {
  const { colors } = useAppTheme();
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Path d="m6 6 12 12M18 6 6 18" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth={1.7} /></Svg>;
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  const { colors } = useAppTheme();
  const path = direction === 'left' ? 'm14.5 5-6 7 6 7' : 'm9.5 5 6 7-6 7';
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Path d={path} fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

function useDiaryPhotoViewerStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: { maxHeight: '86%', maxWidth: 360, padding: 0 },
  scroll: { flexShrink: 1 },
  content: { flexGrow: 1 },
  photoSection: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderBottomColor: colors.ink, borderBottomWidth: 1.5, height: 224, justifyContent: 'center', padding: spacing[5], position: 'relative' },
  photo: { height: '100%', width: '100%' },
  closeButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 1, height: 44, justifyContent: 'center', position: 'absolute', right: 10, top: 10, width: 44 },
  photoNav: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 1.5, height: 44, justifyContent: 'center', position: 'absolute', top: '44%', width: 44 },
  previousButton: { left: 10 },
  nextButton: { right: 10 },
  metaSection: { padding: spacing[4] },
  metaHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.5 },
  dateValue: { color: colors.ink, fontSize: 16, fontWeight: '700', lineHeight: 24, marginTop: 2 },
  positionValue: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 10, marginTop: 13 },
  divider: { backgroundColor: colors.borderStrong, height: 1, marginVertical: spacing[3] },
  memoLabel: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.5 },
  memoValue: { color: colors.ink, fontSize: 13, fontStyle: 'italic', lineHeight: 19, marginTop: spacing[2] },
  colorRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  colorDot: { borderColor: colors.ink, borderRadius: 6, borderWidth: 1, height: 12, width: 12 },
  colorText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  editAction: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46 },
  editActionText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  deleteAction: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.danger, borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 46 },
  deleteActionText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  disabledAction: { opacity: 0.42 },
  });
}
