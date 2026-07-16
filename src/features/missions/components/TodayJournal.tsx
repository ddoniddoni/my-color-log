import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { colors, spacing } from '@/src/design/tokens';
import { type DailyMission } from '@/src/features/missions/model/dailyMission';
import { formatKstCountdown } from '@/src/features/missions/model/countdown';
import { getTodayPhotoSlots, type TodayPhoto } from '@/src/features/entries/model/todayPhotos';

type TodayJournalProps = {
  mission: DailyMission;
  millisecondsUntilMidnight: number;
  photos: TodayPhoto[];
  isSyncing: boolean;
  hasSyncFailure: boolean;
  onCapturePress: () => void;
  onRetrySync: () => void;
};

export function TodayJournal({ mission, millisecondsUntilMidnight, photos, isSyncing, hasSyncFailure, onCapturePress, onRetrySync }: TodayJournalProps) {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const insets = useSafeAreaInsets();
  const bodyFont = fontsLoaded ? 'BricolageGrotesque_400Regular' : undefined;
  const boldFont = fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined;
  const heavyFont = fontsLoaded ? 'BricolageGrotesque_800ExtraBold' : undefined;

  return (
    <View style={styles.page}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.dateGroup}>
          <View accessibilityLabel="내 프로필 그림" accessibilityRole="image" style={styles.profileMark}>
            <ProfileSketch />
          </View>
          <AppText style={[styles.headerDate, { fontFamily: boldFont }]}>{formatHeaderDate(mission.challengeDate)}</AppText>
        </View>
        <View accessibilityLabel="설정은 준비 중이에요" accessibilityRole="image" style={styles.settingsMark}>
          <SettingsSketch />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleGroup}>
          <AppText style={[styles.title, { fontFamily: heavyFont }]}>{photos.length === 9 ? '오늘의 색을 가득 채웠어요.' : `오늘의 ${mission.color.nameKo}을\n찾아봐요.`}</AppText>
          <AppText style={[styles.weekday, { fontFamily: bodyFont }]}>KST · {mission.challengeDate}</AppText>
        </View>

        {photos.length === 0
          ? <EmptyJournalCanvas mission={mission} bodyFont={bodyFont} boldFont={boldFont} />
          : <PhotoMosaic photos={photos} />}

        <View style={styles.noteSection}>
          <AppText style={[styles.note, { fontFamily: bodyFont }]}>{mission.promptKo}</AppText>
          <AppText style={[styles.countdown, { fontFamily: bodyFont }]}>자정까지 {formatKstCountdown(millisecondsUntilMidnight)}</AppText>
        </View>

        <View style={styles.tags}>
          <Tag label={`#${mission.color.nameEn.replaceAll(' ', '').toUpperCase()}`} />
          <Tag label="#DAILYLOG" />
        </View>

        <View style={styles.actionArea}>
          <Button disabled={photos.length >= 9} label={photos.length === 0 ? '첫 번째 색 발견하기' : photos.length >= 9 ? '오늘의 9장을 모두 채웠어요' : '한 장 더 발견하기'} onPress={onCapturePress} />
          {hasSyncFailure
            ? <Pressable accessibilityRole="button" onPress={onRetrySync} style={styles.retryButton}><AppText style={styles.retryText}>업로드 다시 시도</AppText></Pressable>
            : <AppText accessibilityLiveRegion="polite" style={[styles.actionHint, { fontFamily: bodyFont }]}>{isSyncing ? '사진은 보존됐어요. 지금 안전하게 올리는 중이에요.' : photos.length === 0 ? '발견한 색은 먼저 기기에 안전하게 보관해요.' : `${photos.length}/9장의 오늘을 모았어요.`}</AppText>}
        </View>
      </ScrollView>
    </View>
  );
}

function PhotoMosaic({ photos }: { photos: TodayPhoto[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const slots = getTodayPhotoSlots(photos);
  const boardSize = screenWidth - spacing[4] * 2;
  const cellSize = (boardSize - spacing[2] * 2) / 3;
  return (
    <View accessibilityLabel={`오늘의 사진 ${photos.length}장, 9칸 기록판`} style={[styles.mosaic, { height: boardSize, width: boardSize }]}>
      {slots.map((photo, index) => (
        <View accessibilityLabel={photo ? `${photo.position}번째 오늘의 색 사진` : `${index + 1}번째 빈 사진 칸`} key={photo?.id ?? `empty-${index + 1}`} style={[styles.photoCard, { height: cellSize, width: cellSize }, photo ? styles.photoCardFilled : styles.photoCardEmpty]}>
          {photo ? <><Image cachePolicy="memory-disk" contentFit="cover" source={{ uri: photo.uri }} style={styles.photoImage} />
            <View style={styles.photoTime}><AppText style={styles.photoTimeText}>{formatPhotoTime(photo.capturedAt)}</AppText></View>
            {photo.status !== 'synced' ? <View style={[styles.photoStatus, photo.status === 'failed' ? styles.photoStatusFailed : styles.photoStatusSyncing]}><AppText style={styles.photoStatusText}>{photo.status === 'failed' ? '!' : '↥'}</AppText></View> : null}
          </> : null}
        </View>
      ))}
    </View>
  );
}

function EmptyJournalCanvas({ bodyFont, boldFont, mission }: { bodyFont: string | undefined; boldFont: string | undefined; mission: DailyMission }) {
  return (
    <View accessibilityLabel={`아직 ${mission.color.nameKo} 사진이 없는 기록 영역`} style={styles.canvas}>
      <View pointerEvents="none" style={styles.canvasGuide}>
        <View style={[styles.guideLine, { backgroundColor: mission.color.accent }]} />
        <View style={[styles.guideLine, styles.guideLineShort, { backgroundColor: mission.color.accent }]} />
      </View>
      <View style={[styles.colorDisc, { backgroundColor: mission.color.accent }]}>
        <View style={styles.colorDiscInner} />
      </View>
      <View style={styles.canvasCopy}>
        <AppText style={[styles.canvasTitle, { fontFamily: boldFont }]}>첫 번째 장면을{`\n`}남겨 보세요.</AppText>
        <AppText style={[styles.canvasDescription, { fontFamily: bodyFont }]}>{mission.color.nameKo}을 발견한{`\n`}오늘의 순간을 모아요.</AppText>
      </View>
      <View pointerEvents="none" style={styles.canvasDoodle}><PencilSketch color={mission.color.accent} /></View>
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return <View style={styles.tag}><AppText style={styles.tagText}>{label}</AppText></View>;
}

function ProfileSketch() {
  return <Svg height={28} viewBox="0 0 28 28" width={28}><Circle cx={14} cy={14} fill="#F9F9F9" r={13} stroke="#171714" strokeWidth={1.25} /><Circle cx={10} cy={12} fill="#171714" r={1.4} /><Circle cx={18} cy={12} fill="#171714" r={1.4} /><Path d="M9.5 17c1.4 1.7 3 2.5 4.5 2.5s3.1-.8 4.5-2.5M8.2 8.5c2.5-2.1 9.1-2.1 11.6 0" fill="none" stroke="#171714" strokeLinecap="round" strokeWidth={1.25} /></Svg>;
}

function SettingsSketch() {
  return <Svg height={23} viewBox="0 0 24 24" width={23}><Circle cx={12} cy={12} fill="none" r={3.1} stroke="#171714" strokeWidth={1.5} /><Path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2m14.5-6.5-1.4 1.4M7 17l-1.4 1.4m0-12.8L7 7m9.6 9.6 1.4 1.4" fill="none" stroke="#171714" strokeLinecap="round" strokeWidth={1.5} /></Svg>;
}

function PencilSketch({ color }: { color: string }) {
  return <Svg height={82} viewBox="0 0 82 82" width={82}><Path d="m18 61 8-2 34-34-6-6-34 34-2 8ZM54 19l4-4a3 3 0 0 1 4 4l-4 4" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} /><Path d="M14 67c11-1 22 4 30 1" fill="none" stroke={color} strokeLinecap="round" strokeWidth={1.5} /></Svg>;
}

function formatHeaderDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${year}.${month}.${day}`;
}

function formatPhotoTime(timestamp: string): string {
  const kstDate = new Date(new Date(timestamp).getTime() + 9 * 60 * 60 * 1_000);
  const hours = String(kstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F9F9F9', flex: 1 },
  appBar: { alignItems: 'center', backgroundColor: '#F9F9F9', flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, paddingBottom: 10, paddingHorizontal: spacing[4] },
  dateGroup: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  profileMark: { height: 32, width: 32 },
  headerDate: { color: colors.ink, fontSize: 13, fontWeight: '700', letterSpacing: -0.15, lineHeight: 17 },
  settingsMark: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  content: { gap: spacing[6], paddingBottom: 132, paddingHorizontal: spacing[4], paddingTop: 16 },
  titleGroup: { gap: 6 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -1.2, lineHeight: 37 },
  weekday: { color: '#5D5F5F', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.1, lineHeight: 14, textTransform: 'uppercase' },
  canvas: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 1.5, height: 230, justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  canvasGuide: { left: 16, position: 'absolute', top: 16 },
  guideLine: { height: 3, transform: [{ rotate: '-3deg' }], width: 78 },
  guideLineShort: { marginLeft: 6, marginTop: 7, opacity: 0.5, transform: [{ rotate: '2deg' }], width: 42 },
  colorDisc: { alignItems: 'center', borderColor: colors.ink, borderRadius: 44, borderWidth: 1.5, height: 88, justifyContent: 'center', width: 88 },
  colorDiscInner: { borderColor: colors.surface, borderRadius: 28, borderStyle: 'dashed', borderWidth: 1.5, height: 54, width: 54 },
  canvasCopy: { alignItems: 'center', marginTop: 12 },
  canvasTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', lineHeight: 23, textAlign: 'center' },
  canvasDescription: { color: '#5D5F5F', fontSize: 13, lineHeight: 18, marginTop: 6, textAlign: 'center' },
  canvasDoodle: { bottom: -18, opacity: 0.7, position: 'absolute', right: -6, transform: [{ rotate: '-14deg' }] },
  mosaic: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  photoCard: { borderColor: colors.ink, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  photoCardFilled: { backgroundColor: '#E4E4E4' },
  photoCardEmpty: { backgroundColor: '#F1F1EF', borderColor: '#B7B7B2', borderStyle: 'dashed' },
  photoImage: { height: '100%', width: '100%' },
  photoTime: { backgroundColor: 'rgba(255,255,255,0.88)', bottom: 4, paddingHorizontal: 4, paddingVertical: 2, position: 'absolute', right: 4 },
  photoTimeText: { color: colors.ink, fontFamily: 'monospace', fontSize: 7 },
  photoStatus: { alignItems: 'center', borderColor: colors.white, borderRadius: 9, borderWidth: 1, height: 18, justifyContent: 'center', left: 5, position: 'absolute', top: 5, width: 18 },
  photoStatusSyncing: { backgroundColor: colors.info },
  photoStatusFailed: { backgroundColor: colors.danger },
  photoStatusText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  noteSection: { borderBottomColor: colors.ink, borderBottomWidth: 1, gap: 8, paddingBottom: spacing[4] },
  note: { color: colors.ink, fontSize: 17, fontStyle: 'italic', lineHeight: 26 },
  countdown: { color: '#5D5F5F', fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.4, lineHeight: 14 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderColor: colors.ink, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { color: colors.ink, fontFamily: 'monospace', fontSize: 10, lineHeight: 12 },
  actionArea: { gap: 10, marginTop: 4 },
  actionHint: { color: '#5D5F5F', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  retryButton: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  retryText: { color: colors.danger, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});
