import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppModal } from '@/src/components/ui/AppModal';
import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { type ThemeColors } from '@/src/design/tokens';
import { RoomPhotoReactionBar } from '@/src/features/reactions/components/RoomPhotoReactionBar';
import { type RoomBoardMember, type RoomBoardMission } from '@/src/features/rooms/model/roomTodayBoard';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

type RoomMemberPhotoViewerProps = {
  currentUserId: string | null;
  initialPhotoId: string | null;
  member: RoomBoardMember | null;
  mission: RoomBoardMission | null;
  onClose: () => void;
  roomId: string | null;
  timeZone: string;
};

export function RoomMemberPhotoViewer({ currentUserId, initialPhotoId, member, mission, onClose, roomId, timeZone }: RoomMemberPhotoViewerProps) {
  const styles = useRoomMemberPhotoViewerStyles();
  const { format, language, t } = useAppLanguage();
  const photoDateFormatter = useMemo(() => new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone,
  }), [language, timeZone]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(() => (
    member?.photos.some((photo) => photo.id === initialPhotoId) ? initialPhotoId : member?.photos[0]?.id ?? null
  ));

  const selectedIndex = member?.photos.findIndex((photo) => photo.id === selectedPhotoId) ?? -1;
  const photo = selectedIndex >= 0 && member ? member.photos[selectedIndex] : null;
  const previousPhoto = selectedIndex > 0 && member ? member.photos[selectedIndex - 1] : null;
  const nextPhoto = member && selectedIndex >= 0 && selectedIndex < member.photos.length - 1 ? member.photos[selectedIndex + 1] : null;

  if (!photo || !member || !mission) return null;

  return (
    <AppModal accessibilityLabel={t('멤버 사진 닫기')} contentStyle={styles.card} onClose={onClose} visible>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <AppText style={styles.eyebrow}>TODAY&apos;S SHARED PHOTO</AppText>
                <AppText localize={false} accessibilityRole="header" numberOfLines={2} style={styles.title}>{format('{name}의 오늘', { name: member.nickname })}</AppText>
              </View>
              <Pressable accessibilityLabel={t('멤버 사진 닫기')} accessibilityRole="button" hitSlop={10} onPress={onClose} style={styles.closeButton}>
                <CloseIcon />
              </Pressable>
            </View>

      <ScrollView bounces={false} contentContainerStyle={styles.scrollContent} style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.photoArea}>
          <Image accessibilityLabel={format('{name}의 {position}번째 공유 사진', { name: member.nickname, position: selectedIndex + 1 })} cachePolicy="memory-disk" contentFit="contain" source={photo.signedUrl ? { uri: photo.signedUrl } : null} style={styles.photo} />
          {previousPhoto ? <Pressable accessibilityLabel={t('이전 사진')} accessibilityRole="button" onPress={() => setSelectedPhotoId(previousPhoto.id)} style={[styles.navButton, styles.previousButton]}><Chevron direction="left" /></Pressable> : null}
          {nextPhoto ? <Pressable accessibilityLabel={t('다음 사진')} accessibilityRole="button" onPress={() => setSelectedPhotoId(nextPhoto.id)} style={[styles.navButton, styles.nextButton]}><Chevron direction="right" /></Pressable> : null}
        </View>

        <View style={styles.meta}>
          <View style={styles.metaTopline}>
            <View style={styles.colorLine}><View style={[styles.colorDot, { backgroundColor: mission.colorHex }]} /><AppText localize={false} numberOfLines={2} style={styles.colorName}>{language === 'ko' ? `${mission.colorNameKo} · ${mission.colorNameEn}` : mission.colorNameEn}</AppText></View>
            <AppText style={styles.position}>{selectedIndex + 1} / {member.photos.length}</AppText>
          </View>
          <AppText style={styles.date}>{formatPhotoDate(photo.capturedAt, photoDateFormatter)}</AppText>
          <View style={styles.divider} />
          <AppText style={styles.memoLabel}>MEMO</AppText>
          <AppText localize={false} style={styles.memo}>{photo.caption ?? t('남긴 메모가 없어요.')}</AppText>
          {currentUserId && roomId ? <RoomPhotoReactionBar isOwnPhoto={member.id === currentUserId} photoId={photo.id} roomId={roomId} userId={currentUserId} /> : null}
          <AppText style={styles.readOnly}>이 사진은 멤버의 개인 기록을 참조해 읽기 전용으로 보여요.</AppText>
        </View>
      </ScrollView>
    </AppModal>
  );
}

function formatPhotoDate(value: string, formatter: Intl.DateTimeFormat): string {
  return formatter.format(new Date(value)).replace(/\.$/, '');
}

function CloseIcon() {
  const { colors } = useAppTheme();
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="m6 6 12 12M18 6 6 18" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth={1.8} /></Svg>;
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  const { colors } = useAppTheme();
  const path = direction === 'left' ? 'm14.5 5-6 7 6 7' : 'm9.5 5 6 7-6 7';
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Path d={path} fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

function useRoomMemberPhotoViewerStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: { maxHeight: '88%', padding: 0 },
  header: { alignItems: 'center', borderBottomColor: colors.ink, borderBottomWidth: 1.5, flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  headerCopy: { flex: 1, paddingRight: 12 },
  eyebrow: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.9 },
  title: { color: colors.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  closeButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 1.5, height: 44, justifyContent: 'center', width: 44 },
  scroll: { flexShrink: 1 },
  scrollContent: { flexGrow: 1 },
  photoArea: { alignItems: 'center', aspectRatio: 1, backgroundColor: colors.surfaceMuted, justifyContent: 'center', position: 'relative' },
  photo: { height: '100%', width: '100%' },
  navButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 1.5, height: 44, justifyContent: 'center', position: 'absolute', top: '44%', width: 44 },
  previousButton: { left: 10 },
  nextButton: { right: 10 },
  meta: { gap: 8, padding: 16 },
  metaTopline: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  colorLine: { alignItems: 'center', flexDirection: 'row', flex: 1, gap: 6 },
  colorDot: { borderColor: colors.ink, borderRadius: 7, borderWidth: 1, height: 14, width: 14 },
  colorName: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  position: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 11 },
  date: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 11 },
  divider: { backgroundColor: colors.border, height: 1, marginVertical: 2 },
  memoLabel: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.8 },
  memo: { color: colors.ink, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  readOnly: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  });
}
