import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppModal } from '@/src/components/ui/AppModal';
import { AppText } from '@/src/components/ui/AppText';
import { colors, spacing } from '@/src/design/tokens';
import { type DiaryEntry, type DiaryPhoto } from '@/src/features/diary/model/diaryMonth';

const photoDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Seoul',
  year: 'numeric',
});

type DiaryPhotoViewerProps = {
  entry: DiaryEntry | null;
  selectedPhotoId: string | null;
  onClose: () => void;
  onEditPhoto: (photo: DiaryPhoto) => void;
  onSelectPhoto: (photoId: string) => void;
};

export function DiaryPhotoViewer({ entry, selectedPhotoId, onClose, onEditPhoto, onSelectPhoto }: DiaryPhotoViewerProps) {
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
              <Pressable accessibilityLabel="사진 전체 보기 닫기" accessibilityRole="button" hitSlop={10} onPress={onClose} style={styles.closeButton}><CloseIcon /></Pressable>
              {previousPhoto ? <Pressable accessibilityLabel="이전 사진" accessibilityRole="button" onPress={() => onSelectPhoto(previousPhoto.id)} style={[styles.photoNav, styles.previousButton]}><Chevron direction="left" /></Pressable> : null}
              {nextPhoto ? <Pressable accessibilityLabel="다음 사진" accessibilityRole="button" onPress={() => onSelectPhoto(nextPhoto.id)} style={[styles.photoNav, styles.nextButton]}><Chevron direction="right" /></Pressable> : null}
            </View>

            <View style={styles.metaSection}>
              <View style={styles.metaHeader}>
                <View>
                  <AppText style={styles.metaLabel}>DATE & TIME</AppText>
                  <AppText style={styles.dateValue}>{formatPhotoDate(photo.capturedAt)}</AppText>
                </View>
                <AppText style={styles.positionValue}>{selectedIndex + 1} / {entry.photos.length}</AppText>
              </View>
              <View style={styles.divider} />
              <AppText style={styles.memoLabel}>USER MEMO</AppText>
              <AppText style={styles.memoValue}>{photo.caption ?? '이 사진에 남긴 메모가 없어요.'}</AppText>
              <View style={styles.divider} />
              <View style={styles.colorRow}><View style={[styles.colorDot, { backgroundColor: entry.color.accent }]} /><AppText style={styles.colorText}>{entry.color.nameKo} · {entry.color.nameEn}</AppText></View>
              <View style={styles.actions}>
                <Pressable accessibilityLabel="사진 메모 수정" accessibilityRole="button" onPress={() => onEditPhoto(photo)} style={styles.editAction}><AppText style={styles.editActionText}>메모 수정</AppText></Pressable>
                <Pressable accessibilityLabel="사진 전체 보기 닫기" accessibilityRole="button" onPress={onClose} style={styles.closeAction}><AppText style={styles.closeActionText}>CLOSE</AppText></Pressable>
              </View>
            </View>
      </ScrollView>
    </AppModal>
  );
}

function formatPhotoDate(value: string): string {
  return photoDateFormatter.format(new Date(value)).replace(/\.$/, '').replace(/\s/g, ' ');
}

function CloseIcon() {
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Path d="m6 6 12 12M18 6 6 18" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth={1.7} /></Svg>;
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  const path = direction === 'left' ? 'm14.5 5-6 7 6 7' : 'm9.5 5 6 7-6 7';
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Path d={path} fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

const styles = StyleSheet.create({
  card: { maxHeight: '86%', maxWidth: 360, padding: 0 },
  scroll: { flexShrink: 1 },
  content: { flexGrow: 1 },
  photoSection: { alignItems: 'center', backgroundColor: '#F2F2EE', borderBottomColor: colors.ink, borderBottomWidth: 1.5, height: 224, justifyContent: 'center', padding: spacing[5], position: 'relative' },
  photo: { height: '100%', width: '100%' },
  closeButton: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.ink, borderWidth: 1, height: 44, justifyContent: 'center', position: 'absolute', right: 10, top: 10, width: 44 },
  photoNav: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.ink, borderWidth: 1.5, height: 44, justifyContent: 'center', position: 'absolute', top: '44%', width: 44 },
  previousButton: { left: 10 },
  nextButton: { right: 10 },
  metaSection: { padding: spacing[4] },
  metaHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { color: '#5D5F5F', fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.5 },
  dateValue: { color: colors.ink, fontSize: 16, fontWeight: '700', lineHeight: 24, marginTop: 2 },
  positionValue: { color: '#5D5F5F', fontFamily: 'monospace', fontSize: 10, marginTop: 13 },
  divider: { backgroundColor: '#B9B9B9', height: 1, marginVertical: spacing[3] },
  memoLabel: { color: '#5D5F5F', fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.5 },
  memoValue: { color: colors.ink, fontSize: 13, fontStyle: 'italic', lineHeight: 19, marginTop: spacing[2] },
  colorRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  colorDot: { borderColor: colors.ink, borderRadius: 6, borderWidth: 1, height: 12, width: 12 },
  colorText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  editAction: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46 },
  editActionText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  closeAction: { alignItems: 'center', backgroundColor: colors.black, boxShadow: '3px 3px 0px #000000', flex: 1, justifyContent: 'center', minHeight: 46 },
  closeActionText: { color: colors.white, fontSize: 13, fontWeight: '700', letterSpacing: 0.8 },
});
