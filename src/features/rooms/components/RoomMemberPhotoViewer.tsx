import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { colors } from '@/src/design/tokens';
import { type RoomBoardMember, type RoomBoardMission } from '@/src/features/rooms/model/roomTodayBoard';

const photoDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Seoul',
});

type RoomMemberPhotoViewerProps = {
  initialPhotoId: string | null;
  member: RoomBoardMember | null;
  mission: RoomBoardMission | null;
  onClose: () => void;
};

export function RoomMemberPhotoViewer({ initialPhotoId, member, mission, onClose }: RoomMemberPhotoViewerProps) {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(() => (
    member?.photos.some((photo) => photo.id === initialPhotoId) ? initialPhotoId : member?.photos[0]?.id ?? null
  ));

  const selectedIndex = member?.photos.findIndex((photo) => photo.id === selectedPhotoId) ?? -1;
  const photo = selectedIndex >= 0 && member ? member.photos[selectedIndex] : null;
  const previousPhoto = selectedIndex > 0 && member ? member.photos[selectedIndex - 1] : null;
  const nextPhoto = member && selectedIndex >= 0 && selectedIndex < member.photos.length - 1 ? member.photos[selectedIndex + 1] : null;

  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={photo !== null && member !== null && mission !== null}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="멤버 사진 닫기" onPress={onClose} style={StyleSheet.absoluteFill} />
        {photo && member && mission ? (
          <View accessibilityViewIsModal style={styles.card}>
            <View style={styles.header}>
              <View>
                <AppText style={styles.eyebrow}>TODAY&apos;S SHARED PHOTO</AppText>
                <AppText style={styles.title}>{member.nickname}의 오늘</AppText>
              </View>
              <Pressable accessibilityLabel="멤버 사진 닫기" accessibilityRole="button" hitSlop={10} onPress={onClose} style={styles.closeButton}>
                <CloseIcon />
              </Pressable>
            </View>

            <View style={styles.photoArea}>
              <Image accessibilityLabel={`${member.nickname}의 ${selectedIndex + 1}번째 공유 사진`} cachePolicy="memory-disk" contentFit="contain" source={photo.signedUrl ? { uri: photo.signedUrl } : null} style={styles.photo} />
              {previousPhoto ? <Pressable accessibilityLabel="이전 사진" accessibilityRole="button" onPress={() => setSelectedPhotoId(previousPhoto.id)} style={[styles.navButton, styles.previousButton]}><Chevron direction="left" /></Pressable> : null}
              {nextPhoto ? <Pressable accessibilityLabel="다음 사진" accessibilityRole="button" onPress={() => setSelectedPhotoId(nextPhoto.id)} style={[styles.navButton, styles.nextButton]}><Chevron direction="right" /></Pressable> : null}
            </View>

            <View style={styles.meta}>
              <View style={styles.metaTopline}>
                <View style={styles.colorLine}><View style={[styles.colorDot, { backgroundColor: mission.colorHex }]} /><AppText style={styles.colorName}>{mission.colorNameKo} · {mission.colorNameEn}</AppText></View>
                <AppText style={styles.position}>{selectedIndex + 1} / {member.photos.length}</AppText>
              </View>
              <AppText style={styles.date}>{photoDateFormatter.format(new Date(photo.capturedAt)).replace(/\.$/, '')}</AppText>
              <View style={styles.divider} />
              <AppText style={styles.memoLabel}>MEMO</AppText>
              <AppText style={styles.memo}>{photo.caption ?? '남긴 메모가 없어요.'}</AppText>
              <AppText style={styles.readOnly}>이 사진은 멤버의 개인 기록을 참조해 읽기 전용으로 보여요.</AppText>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function CloseIcon() {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="m6 6 12 12M18 6 6 18" fill="none" stroke={colors.black} strokeLinecap="round" strokeWidth={1.8} /></Svg>;
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  const path = direction === 'left' ? 'm14.5 5-6 7 6 7' : 'm9.5 5 6 7-6 7';
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Path d={path} fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.44)', flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.white, borderColor: colors.black, borderWidth: 2, maxHeight: '88%', maxWidth: 390, width: '100%' },
  header: { alignItems: 'center', borderBottomColor: colors.black, borderBottomWidth: 1.5, flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  eyebrow: { color: 'rgba(0, 0, 0, 0.6)', fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.9 },
  title: { color: colors.black, fontSize: 21, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  closeButton: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.black, borderWidth: 1.5, height: 38, justifyContent: 'center', width: 38 },
  photoArea: { alignItems: 'center', aspectRatio: 1, backgroundColor: '#F1F1EF', justifyContent: 'center', position: 'relative' },
  photo: { height: '100%', width: '100%' },
  navButton: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.black, borderRadius: 999, borderWidth: 1.5, height: 38, justifyContent: 'center', position: 'absolute', top: '47%', width: 38 },
  previousButton: { left: 12 },
  nextButton: { right: 12 },
  meta: { gap: 8, padding: 16 },
  metaTopline: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  colorLine: { alignItems: 'center', flexDirection: 'row', flex: 1, gap: 6 },
  colorDot: { borderColor: colors.black, borderRadius: 7, borderWidth: 1, height: 14, width: 14 },
  colorName: { color: colors.black, fontSize: 12, fontWeight: '700' },
  position: { color: 'rgba(0, 0, 0, 0.6)', fontFamily: 'monospace', fontSize: 11 },
  date: { color: 'rgba(0, 0, 0, 0.6)', fontFamily: 'monospace', fontSize: 11 },
  divider: { backgroundColor: 'rgba(0, 0, 0, 0.18)', height: 1, marginVertical: 2 },
  memoLabel: { color: 'rgba(0, 0, 0, 0.6)', fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.8 },
  memo: { color: colors.black, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  readOnly: { color: 'rgba(0, 0, 0, 0.58)', fontSize: 11, lineHeight: 16, marginTop: 2 },
});
