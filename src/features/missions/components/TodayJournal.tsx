import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { NinePhotoMosaic } from '@/src/components/ui/NinePhotoMosaic';
import { colors, spacing } from '@/src/design/tokens';
import { type DailyMission } from '@/src/features/missions/model/dailyMission';
import { formatCountdown } from '@/src/features/missions/model/countdown';
import { getTodayJournalLayout } from '@/src/features/missions/model/todayJournalLayout';
import { type TodayPhoto } from '@/src/features/entries/model/todayPhotos';
import { getPhotoAccessibilityLabel } from '@/src/utils/accessibility/photoAccessibility';
import { getTimeZoneDisplayName } from '@/src/utils/dates/timezone';

type TodayJournalProps = {
  mission: DailyMission;
  millisecondsUntilMidnight: number;
  photos: TodayPhoto[];
  isSyncing: boolean;
  hasSyncFailure: boolean;
  onAddPhotoPress: () => void;
  onPhotoLongPress: (photo: TodayPhoto) => void;
  onPhotoPress: (photo: TodayPhoto) => void;
  onRetrySync: () => void;
  timeZone: string;
};

export function TodayJournal({ mission, millisecondsUntilMidnight, photos, isSyncing, hasSyncFailure, onAddPhotoPress, onPhotoLongPress, onPhotoPress, onRetrySync, timeZone }: TodayJournalProps) {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const insets = useSafeAreaInsets();
  const bodyFont = fontsLoaded ? 'BricolageGrotesque_400Regular' : undefined;
  const boldFont = fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined;
  const heavyFont = fontsLoaded ? 'BricolageGrotesque_800ExtraBold' : undefined;
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [contentSize, setContentSize] = useState({ height: 0, width: 0 });
  const journalLayout = getTodayJournalLayout({
    contentHeight: contentSize.height || Math.max(0, windowHeight - 180),
    contentWidth: contentSize.width || windowWidth,
  });
  const isCompact = journalLayout.isCompact;
  const mosaicStyle = { height: journalLayout.mosaicSize, width: journalLayout.mosaicSize };

  return (
    <View style={styles.page}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.dateGroup}>
          <View accessible accessibilityLabel="내 프로필 그림" accessibilityRole="image" style={styles.profileMark}>
            <ProfileSketch />
          </View>
          <AppText style={[styles.headerDate, { fontFamily: boldFont }]}>{formatHeaderDate(mission.challengeDate)}</AppText>
        </View>
        <View accessible accessibilityLabel="설정은 준비 중이에요" accessibilityRole="image" style={styles.settingsMark}>
          <SettingsSketch />
        </View>
      </View>

      <View
        onLayout={({ nativeEvent }) => {
          const { height, width } = nativeEvent.layout;
          setContentSize((current) => current.height === height && current.width === width ? current : { height, width });
        }}
        style={[styles.content, { paddingHorizontal: journalLayout.horizontalPadding }, isCompact && styles.contentCompact]}>
        <View style={styles.titleGroup}>
          <AppText numberOfLines={2} style={[styles.title, { fontFamily: heavyFont }, isCompact && styles.titleCompact]}>{photos.length === 9 ? '오늘의 색을 가득 채웠어요.' : `오늘의 ${mission.color.nameKo}을\n찾아봐요.`}</AppText>
          <AppText numberOfLines={1} style={[styles.weekday, { fontFamily: bodyFont }, isCompact && styles.weekdayCompact]}>{getTimeZoneDisplayName(timeZone)} · {mission.challengeDate}</AppText>
        </View>

        {photos.length === 0
          ? <EmptyJournalCanvas bodyFont={bodyFont} boldFont={boldFont} mission={mission} size={journalLayout.mosaicSize} />
          : <View style={[styles.mosaicFrame, mosaicStyle]}>
              <NinePhotoMosaic
                accessibilityLabel={`오늘의 사진 ${photos.length}장, 9칸 기록판`}
                onPhotoLongPress={(photo) => {
                  const todayPhoto = photos.find((item) => item.id === photo.id);
                  if (todayPhoto) onPhotoLongPress(todayPhoto);
                }}
                onPhotoPress={(photo) => {
                  const todayPhoto = photos.find((item) => item.id === photo.id);
                  if (todayPhoto) onPhotoPress(todayPhoto);
                }}
                onEmptyPress={photos.length < 9 ? onAddPhotoPress : undefined}
                photos={photos.map((photo) => ({
                  ...photo,
                  accessibilityLabel: getPhotoAccessibilityLabel({
                    caption: photo.caption,
                    colorName: mission.color.nameKo,
                    position: photo.position,
                    status: photo.status,
                  }),
                }))}
              />
            </View>}

        <View style={[styles.noteSection, isCompact && styles.noteSectionCompact]}>
          <AppText numberOfLines={isCompact ? 1 : 2} style={[styles.note, { fontFamily: bodyFont }, isCompact && styles.noteCompact]}>{mission.promptKo}</AppText>
          <AppText style={[styles.countdown, { fontFamily: bodyFont }]}>자정까지 {formatCountdown(millisecondsUntilMidnight)}</AppText>
        </View>

        {!isCompact ? <View style={styles.tags}>
          <Tag label={`#${mission.color.nameEn.replaceAll(' ', '').toUpperCase()}`} />
          <Tag label="#DAILYLOG" />
        </View> : null}

        <View style={[styles.actionArea, isCompact && styles.actionAreaCompact]}>
          <Button disabled={photos.length >= 9} label={photos.length === 0 ? '첫 번째 색 발견하기' : photos.length >= 9 ? '오늘의 9장을 모두 채웠어요' : '한 장 더 발견하기'} onPress={onAddPhotoPress} style={isCompact ? styles.actionButtonCompact : undefined} />
          {hasSyncFailure
            ? <Pressable accessibilityLabel="실패한 사진 업로드 다시 시도" accessibilityRole="button" onPress={onRetrySync} style={styles.retryButton}><AppText style={styles.retryText}>업로드 다시 시도</AppText></Pressable>
            : <AppText accessibilityLiveRegion="polite" numberOfLines={isCompact ? 1 : 2} style={[styles.actionHint, { fontFamily: bodyFont }]}>{isSyncing ? '사진은 보존됐어요. 지금 안전하게 올리는 중이에요.' : photos.length === 0 ? '발견한 색은 먼저 기기에 안전하게 보관해요.' : `${photos.length}/9장의 오늘을 모았어요. 사진을 길게 눌러 순서를 바꿀 수 있어요.`}</AppText>}
        </View>
      </View>
    </View>
  );
}

function EmptyJournalCanvas({ bodyFont, boldFont, mission, size }: { bodyFont: string | undefined; boldFont: string | undefined; mission: DailyMission; size: number }) {
  return (
    <View accessible accessibilityLabel={`아직 ${mission.color.nameKo} 사진이 없는 기록 영역`} style={[styles.canvas, { height: size, width: size }]}>
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

const styles = StyleSheet.create({
  page: { backgroundColor: '#F9F9F9', flex: 1 },
  appBar: { alignItems: 'center', backgroundColor: '#F9F9F9', flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, paddingBottom: 10, paddingHorizontal: spacing[4] },
  dateGroup: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  profileMark: { height: 32, width: 32 },
  headerDate: { color: colors.ink, fontSize: 13, fontWeight: '700', letterSpacing: -0.15, lineHeight: 17 },
  settingsMark: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  content: { flex: 1, justifyContent: 'space-between', paddingBottom: 12, paddingTop: 12 },
  contentCompact: { paddingBottom: 8, paddingTop: 8 },
  titleGroup: { gap: 6 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -1.2, lineHeight: 37 },
  titleCompact: { fontSize: 27, lineHeight: 32 },
  weekday: { color: '#5D5F5F', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.1, lineHeight: 14, textTransform: 'uppercase' },
  weekdayCompact: { fontSize: 9, lineHeight: 12 },
  mosaicFrame: { alignSelf: 'center' },
  canvas: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 1.5, justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  canvasGuide: { left: 16, position: 'absolute', top: 16 },
  guideLine: { height: 3, transform: [{ rotate: '-3deg' }], width: 78 },
  guideLineShort: { marginLeft: 6, marginTop: 7, opacity: 0.5, transform: [{ rotate: '2deg' }], width: 42 },
  colorDisc: { alignItems: 'center', borderColor: colors.ink, borderRadius: 44, borderWidth: 1.5, height: 88, justifyContent: 'center', width: 88 },
  colorDiscInner: { borderColor: colors.surface, borderRadius: 28, borderStyle: 'dashed', borderWidth: 1.5, height: 54, width: 54 },
  canvasCopy: { alignItems: 'center', marginTop: 12 },
  canvasTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', lineHeight: 23, textAlign: 'center' },
  canvasDescription: { color: '#5D5F5F', fontSize: 13, lineHeight: 18, marginTop: 6, textAlign: 'center' },
  canvasDoodle: { bottom: -18, opacity: 0.7, position: 'absolute', right: -6, transform: [{ rotate: '-14deg' }] },
  noteSection: { borderBottomColor: colors.ink, borderBottomWidth: 1, gap: 8, paddingBottom: spacing[4] },
  noteSectionCompact: { gap: 2, paddingBottom: spacing[2] },
  note: { color: colors.ink, fontSize: 17, fontStyle: 'italic', lineHeight: 26 },
  noteCompact: { fontSize: 14, lineHeight: 19 },
  countdown: { color: '#5D5F5F', fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.4, lineHeight: 14 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderColor: colors.ink, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { color: colors.ink, fontFamily: 'monospace', fontSize: 10, lineHeight: 12 },
  actionArea: { gap: 10, marginTop: 4 },
  actionAreaCompact: { gap: 5, marginTop: 0 },
  actionButtonCompact: { minHeight: 48 },
  actionHint: { color: '#5D5F5F', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  retryButton: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  retryText: { color: colors.danger, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});
