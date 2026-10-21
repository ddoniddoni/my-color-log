import { BricolageGrotesque_400Regular } from '@expo-google-fonts/bricolage-grotesque/400Regular';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppHeader } from '@/src/components/layout/AppHeader';
import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { NinePhotoMosaic } from '@/src/components/ui/NinePhotoMosaic';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing, type ThemeColors } from '@/src/design/tokens';
import { type DailyMission } from '@/src/features/missions/model/dailyMission';
import { NextColorCountdown } from '@/src/features/missions/components/NextColorCountdown';
import { getTodayJournalLayout } from '@/src/features/missions/model/todayJournalLayout';
import { type TodayPhoto } from '@/src/features/entries/model/todayPhotos';
import { getPhotoSyncFeedback } from '@/src/features/sync/model/photoSyncFeedback';
import { type NetworkStatus } from '@/src/features/sync/model/networkStatus';
import { getPhotoAccessibilityLabel } from '@/src/utils/accessibility/photoAccessibility';
import { getTimeZoneDisplayName } from '@/src/utils/dates/timezone';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';
import { formatDateKey } from '@/src/lib/localization/dateFormat';

type TodayJournalProps = {
  mission: DailyMission;
  millisecondsUntilMidnight: number;
  photos: TodayPhoto[];
  isSyncing: boolean;
  networkStatus: NetworkStatus;
  pendingPhotoCount: number;
  hasSyncFailure: boolean;
  onAddPhotoPress: () => void;
  onPhotoLongPress: (photo: TodayPhoto) => void;
  onPhotoPress: (photo: TodayPhoto) => void;
  onRetrySync: () => void;
  onSettingsPress: () => void;
  timeZone: string;
};

export function TodayJournal({ mission, millisecondsUntilMidnight, photos, isSyncing, networkStatus, pendingPhotoCount, hasSyncFailure, onAddPhotoPress, onPhotoLongPress, onPhotoPress, onRetrySync, onSettingsPress, timeZone }: TodayJournalProps) {
  const theme = useAppTheme();
  const { format, language, t } = useAppLanguage();
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
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
  const colorName = language === 'ko' ? mission.color.nameKo : mission.color.nameEn;
  const missionPrompt = getLocalizedMissionPrompt(mission, language);

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.canvas }]}>
      <AppHeader title="오늘" trailingAction={{ icon: 'settings', accessibilityLabel: '설정 열기', onPress: onSettingsPress }} />

      <View
        onLayout={({ nativeEvent }) => {
          const { height, width } = nativeEvent.layout;
          setContentSize((current) => current.height === height && current.width === width ? current : { height, width });
        }}
        style={[styles.content, { paddingHorizontal: journalLayout.horizontalPadding }, isCompact && styles.contentCompact]}>
        <View style={styles.titleGroup}>
          <AppText localize={false} numberOfLines={2} style={[styles.title, { color: theme.colors.ink, fontFamily: heavyFont }, isCompact && styles.titleCompact]}>{photos.length === 9 ? t('오늘의 색을 가득 채웠어요.') : format('오늘의 {colorName}을\n찾아봐요.', { colorName })}</AppText>
          <AppText numberOfLines={1} style={[styles.weekday, { color: theme.colors.textSecondary, fontFamily: bodyFont }, isCompact && styles.weekdayCompact]}>{getTimeZoneDisplayName(timeZone)} · {formatDateKey(mission.challengeDate, language, 'numeric')}</AppText>
        </View>

        {photos.length === 0
          ? <EmptyJournalCanvas bodyFont={bodyFont} boldFont={boldFont} colorName={colorName} colors={theme.colors} language={language} mission={mission} size={journalLayout.mosaicSize} />
          : <View style={[styles.mosaicFrame, mosaicStyle]}>
              <NinePhotoMosaic
                accessibilityLabel={format('오늘의 사진 {count}장, 9칸 기록판', { count: photos.length })}
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
                    colorName,
                    language,
                    position: photo.position,
                    status: photo.status,
                  }),
                }))}
              />
            </View>}

        <View style={[styles.noteSection, { borderBottomColor: theme.colors.ink }, isCompact && styles.noteSectionCompact]}>
          <AppText numberOfLines={isCompact ? 1 : 2} style={[styles.note, { color: theme.colors.ink, fontFamily: bodyFont }, isCompact && styles.noteCompact]}>{missionPrompt}</AppText>
          <NextColorCountdown milliseconds={millisecondsUntilMidnight} />
        </View>

        {!isCompact ? <View style={styles.tags}>
          <Tag colors={theme.colors} label={`#${mission.color.nameEn.replaceAll(' ', '').toUpperCase()}`} />
          <Tag colors={theme.colors} label="#DAILYLOG" />
        </View> : null}

        <View style={[styles.actionArea, isCompact && styles.actionAreaCompact]}>
          {photos.some((photo) => photo.position > 9) ? <Pressable accessibilityRole="button" onPress={() => {
            const overflow = photos.find((photo) => photo.position > 9);
            if (overflow) onPhotoPress(overflow);
          }} style={styles.retryButton}><AppText color="secondary">9장을 넘어 이 기기에 보관 중인 사진 확인</AppText></Pressable> : null}
          <Button disabled={photos.length >= 9} label={photos.length === 0 ? '첫 번째 색 발견하기' : photos.length >= 9 ? '오늘의 9장을 모두 채웠어요' : '한 장 더 발견하기'} onPress={onAddPhotoPress} style={isCompact ? styles.actionButtonCompact : undefined} />
          {hasSyncFailure
            ? <Pressable accessibilityLabel="실패한 사진 업로드 다시 시도" accessibilityRole="button" onPress={onRetrySync} style={styles.retryButton}><AppText style={[styles.retryText, { color: theme.colors.danger }]}>업로드 다시 시도</AppText></Pressable>
            : <AppText accessibilityLiveRegion="polite" numberOfLines={isCompact ? 1 : 2} style={[styles.actionHint, { color: theme.colors.textSecondary, fontFamily: bodyFont }]}>{getPhotoSyncFeedback({
              isSyncing,
              networkStatus,
              pendingPhotoCount,
              totalPhotoCount: photos.length,
              language,
            })}</AppText>}
        </View>
      </View>
    </View>
  );
}

function EmptyJournalCanvas({ bodyFont, boldFont, colorName, colors, language, mission, size }: { bodyFont: string | undefined; boldFont: string | undefined; colorName: string; colors: ThemeColors; language: 'en' | 'ko'; mission: DailyMission; size: number }) {
  const { format, t } = useAppLanguage();
  return (
    <View accessible accessibilityLabel={format('아직 {colorName} 사진이 없는 기록 영역', { colorName })} style={[styles.canvas, { backgroundColor: colors.surface, borderColor: colors.ink, height: size, width: size }]}>
      <View pointerEvents="none" style={styles.canvasGuide}>
        <View style={[styles.guideLine, { backgroundColor: mission.color.accent }]} />
        <View style={[styles.guideLine, styles.guideLineShort, { backgroundColor: mission.color.accent }]} />
      </View>
      <View style={[styles.colorDisc, { backgroundColor: mission.color.accent, borderColor: colors.ink }]}>
        <View style={[styles.colorDiscInner, { borderColor: colors.surface }]} />
      </View>
      <View style={styles.canvasCopy}>
        <AppText localize={false} style={[styles.canvasTitle, { color: colors.ink, fontFamily: boldFont }]}>{t('첫 번째 장면을\n남겨 보세요.')}</AppText>
        <AppText localize={false} style={[styles.canvasDescription, { color: colors.textSecondary, fontFamily: bodyFont }]}>{format('{colorName}을 발견한\n오늘의 순간을 모아요.', { colorName })}</AppText>
      </View>
      <View pointerEvents="none" style={styles.canvasDoodle}><PencilSketch color={mission.color.accent} /></View>
    </View>
  );
}

function getLocalizedMissionPrompt(mission: DailyMission, language: 'en' | 'ko'): string {
  if (language === 'ko') return mission.promptKo;
  return `Find a scene touched by ${mission.color.nameEn}.`;
}

function Tag({ colors, label }: { colors: ThemeColors; label: string }) {
  return <View style={[styles.tag, { borderColor: colors.ink }]}><AppText style={[styles.tagText, { color: colors.ink }]}>{label}</AppText></View>;
}

function PencilSketch({ color }: { color: string }) {
  return <Svg height={82} viewBox="0 0 82 82" width={82}><Path d="m18 61 8-2 34-34-6-6-34 34-2 8ZM54 19l4-4a3 3 0 0 1 4 4l-4 4" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} /><Path d="M14 67c11-1 22 4 30 1" fill="none" stroke={color} strokeLinecap="round" strokeWidth={1.5} /></Svg>;
}


const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flex: 1, justifyContent: 'space-between', paddingBottom: 12, paddingTop: 12 },
  contentCompact: { paddingBottom: 8, paddingTop: 8 },
  titleGroup: { gap: 6 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -1.2, lineHeight: 37 },
  titleCompact: { fontSize: 27, lineHeight: 32 },
  weekday: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1.1, lineHeight: 14, textTransform: 'uppercase' },
  weekdayCompact: { fontSize: 9, lineHeight: 12 },
  mosaicFrame: { alignSelf: 'center' },
  canvas: { alignItems: 'center', alignSelf: 'center', borderWidth: 1.5, justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  canvasGuide: { left: 16, position: 'absolute', top: 16 },
  guideLine: { height: 3, transform: [{ rotate: '-3deg' }], width: 78 },
  guideLineShort: { marginLeft: 6, marginTop: 7, opacity: 0.5, transform: [{ rotate: '2deg' }], width: 42 },
  colorDisc: { alignItems: 'center', borderRadius: 44, borderWidth: 1.5, height: 88, justifyContent: 'center', width: 88 },
  colorDiscInner: { borderRadius: 28, borderStyle: 'dashed', borderWidth: 1.5, height: 54, width: 54 },
  canvasCopy: { alignItems: 'center', marginTop: 12 },
  canvasTitle: { fontSize: 18, fontWeight: '700', lineHeight: 23, textAlign: 'center' },
  canvasDescription: { fontSize: 13, lineHeight: 18, marginTop: 6, textAlign: 'center' },
  canvasDoodle: { bottom: -18, opacity: 0.7, position: 'absolute', right: -6, transform: [{ rotate: '-14deg' }] },
  noteSection: { borderBottomWidth: 1, gap: 8, paddingBottom: spacing[4] },
  noteSectionCompact: { gap: 2, paddingBottom: spacing[2] },
  note: { fontSize: 17, fontStyle: 'italic', lineHeight: 26 },
  noteCompact: { fontSize: 14, lineHeight: 19 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { fontFamily: 'monospace', fontSize: 10, lineHeight: 12 },
  actionArea: { gap: 10, marginTop: 4 },
  actionAreaCompact: { gap: 5, marginTop: 0 },
  actionButtonCompact: { minHeight: 48 },
  actionHint: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  retryButton: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  retryText: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});
