import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { colors } from '@/src/design/tokens';
import { getCalendarCells, moveMonth, type MonthCursor } from '@/src/features/diary/model/calendar';
import { getKstDateKey } from '@/src/utils/dates/kst';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function DiaryCalendarCanvas() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const insets = useSafeAreaInsets();
  const todayKey = getKstDateKey();
  const [todayYear, todayMonth, todayDay] = todayKey.split('-').map(Number);
  const [cursor, setCursor] = useState<MonthCursor>({ month: todayMonth, year: todayYear });
  const calendar = getCalendarCells(cursor.year, cursor.month);
  const isCurrentMonth = cursor.year === todayYear && cursor.month === todayMonth;
  const bodyFont = fontsLoaded ? 'BricolageGrotesque_400Regular' : undefined;
  const boldFont = fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined;
  const heavyFont = fontsLoaded ? 'BricolageGrotesque_800ExtraBold' : undefined;

  return (
    <View style={styles.page}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.dateGroup}>
          <View accessibilityLabel="내 프로필 그림" accessibilityRole="image" style={styles.profileMark}><ProfileSketch /></View>
          <AppText style={[styles.headerDate, { fontFamily: boldFont }]}>{todayKey.replaceAll('-', '.')}</AppText>
        </View>
        <View accessibilityLabel="설정은 준비 중이에요" accessibilityRole="image" style={styles.settingsMark}><SettingsSketch /></View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.monthHeader}>
          <View style={styles.monthTitleGroup}>
            <View style={styles.monthUnderline}><AppText style={[styles.monthTitle, { fontFamily: heavyFont }]}>{cursor.month}월</AppText></View>
            <AppText style={styles.yearLabel}>{cursor.year}</AppText>
          </View>
          <View style={styles.monthControls}>
            <MonthControl direction="previous" onPress={() => setCursor((current) => moveMonth(current, -1))} />
            <MonthControl direction="next" onPress={() => setCursor((current) => moveMonth(current, 1))} />
          </View>
        </View>

        <View style={styles.calendarGrid}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((weekday, index) => <View key={weekday} style={[styles.weekdayCell, index === WEEKDAYS.length - 1 && styles.rightEdge]}><AppText style={styles.weekdayText}>{weekday}</AppText></View>)}
          </View>
          <View style={styles.dayGrid}>
            {calendar.map((cell, index) => {
              const isToday = isCurrentMonth && cell.day === todayDay;
              const isLastColumn = (index + 1) % WEEKDAYS.length === 0;
              const isLastRow = index >= calendar.length - WEEKDAYS.length;

              return (
                <View key={cell.key} style={[styles.dayCell, isLastColumn && styles.rightEdge, isLastRow && styles.bottomEdge]}>
                  {cell.day ? <AppText style={[styles.dayNumber, isToday && styles.todayNumber]}>{cell.day}</AppText> : null}
                  {isToday ? <View pointerEvents="none" style={styles.todayMarker}><TodayMarker /></View> : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.diarySection}>
          <AppText style={[styles.diaryHeading, { fontFamily: boldFont }]}>{isCurrentMonth ? '오늘의 다이어리' : `${cursor.month}월의 다이어리`}</AppText>
          <EmptyDiaryCard bodyFont={bodyFont} boldFont={boldFont} isCurrentMonth={isCurrentMonth} />
          <View accessibilityLabel="이번 달 기록이 없어요" style={styles.monthSummaryCard}>
            <View style={styles.summaryCopy}>
              <AppText style={[styles.summaryTitle, { fontFamily: boldFont }]}>이번 달 기록이 없어요</AppText>
              <AppText style={[styles.summaryDescription, { fontFamily: bodyFont }]}>오늘의 첫 색을 찾으면 이 달력에 표시돼요.</AppText>
            </View>
            <ArrowIcon />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function EmptyDiaryCard({ bodyFont, boldFont, isCurrentMonth }: { bodyFont: string | undefined; boldFont: string | undefined; isCurrentMonth: boolean }) {
  const title = isCurrentMonth ? '오늘의 첫 기록' : '아직 기록이 없어요';
  const description = isCurrentMonth
    ? '오늘 발견한 색과 그때의 느낌을 한 장으로 남겨 보세요.'
    : '이 달에 남긴 색 기록이 이곳에 차곡차곡 모여요.';

  return (
    <View style={styles.diaryCard}>
      <View style={styles.diaryCardHeader}>
        <AppText style={styles.timestamp}>{isCurrentMonth ? 'TODAY · KST' : 'EMPTY PAGE'}</AppText>
        <View accessibilityLabel="기록 별표" accessibilityRole="image"><StarIcon /></View>
      </View>
      <AppText style={[styles.entryTitle, { fontFamily: boldFont }]}>{title}</AppText>
      <AppText style={[styles.entryDescription, { fontFamily: bodyFont }]}>{description}</AppText>
      <View accessibilityLabel="아직 사진이 없는 기록 자리" style={styles.photoPlaceholder}>
        <View style={styles.placeholderLines}><View style={styles.placeholderLine} /><View style={[styles.placeholderLine, styles.shortPlaceholderLine]} /></View>
        <CameraSketch />
      </View>
      <View style={styles.tags}>
        <View style={styles.tag}><AppText style={styles.tagLabel}>#첫기록</AppText></View>
        <View style={styles.tag}><AppText style={styles.tagLabel}>#오늘의색</AppText></View>
      </View>
    </View>
  );
}

function MonthControl({ direction, onPress }: { direction: 'next' | 'previous'; onPress: () => void }) {
  const label = direction === 'previous' ? '이전 달 보기' : '다음 달 보기';
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.monthControl, pressed && styles.monthControlPressed]}>
      {direction === 'previous' ? <ChevronIcon direction="left" /> : <ChevronIcon direction="right" />}
    </Pressable>
  );
}

function ProfileSketch() {
  return <Svg height={28} viewBox="0 0 28 28" width={28}><Circle cx={14} cy={14} fill="#F9F9F9" r={13} stroke={colors.black} strokeWidth={1.25} /><Circle cx={10} cy={12} fill={colors.black} r={1.4} /><Circle cx={18} cy={12} fill={colors.black} r={1.4} /><Path d="M9.5 17c1.4 1.7 3 2.5 4.5 2.5s3.1-.8 4.5-2.5M8.2 8.5c2.5-2.1 9.1-2.1 11.6 0" fill="none" stroke={colors.black} strokeLinecap="round" strokeWidth={1.25} /></Svg>;
}

function SettingsSketch() {
  return <Svg height={23} viewBox="0 0 24 24" width={23}><Circle cx={12} cy={12} fill="none" r={3.1} stroke={colors.black} strokeWidth={1.5} /><Path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2m14.5-6.5-1.4 1.4M7 17l-1.4 1.4m0-12.8L7 7m9.6 9.6 1.4 1.4" fill="none" stroke={colors.black} strokeLinecap="round" strokeWidth={1.5} /></Svg>;
}

function TodayMarker() {
  return <Svg height={31} viewBox="0 0 32 32" width={31}><Path d="M16 3.4c7.9 0 12.8 4.4 12.4 12.4-.3 7.2-4.9 12.8-12.6 12.6C8.4 28.3 3.4 23.8 3.6 16 3.8 8.4 8 3.4 16 3.4Z" fill="none" stroke={colors.black} strokeWidth={1.7} /></Svg>;
}

function StarIcon() {
  return <Svg height={18} viewBox="0 0 24 24" width={18}><Path d="m12 3 2.1 5.5 5.9.2-4.6 3.7 1.6 5.7-5-3.4-5 3.4 1.6-5.7L4 8.7l5.9-.2L12 3Z" fill={colors.black} stroke={colors.black} strokeLinejoin="round" strokeWidth={1.1} /></Svg>;
}

function CameraSketch() {
  return <Svg height={46} viewBox="0 0 56 48" width={54}><Path d="M7 16h12l3-5h12l3 5h12v24H7V16Zm21 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" fill="none" stroke="rgba(0, 0, 0, 0.28)" strokeLinejoin="round" strokeWidth={1.6} /><Path d="M9 44c11-3 27-1 38-3" fill="none" stroke="rgba(0, 0, 0, 0.2)" strokeLinecap="round" strokeWidth={1.2} /></Svg>;
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  const path = direction === 'left' ? 'm14.5 5-6 7 6 7' : 'm9.5 5 6 7-6 7';
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d={path} fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

function ArrowIcon() {
  return <Svg height={22} viewBox="0 0 24 24" width={22}><Path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.1} /></Svg>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F9F9F9', flex: 1 },
  appBar: { alignItems: 'center', backgroundColor: '#F9F9F9', flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, paddingBottom: 10, paddingHorizontal: 16 },
  dateGroup: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  profileMark: { height: 32, width: 32 },
  headerDate: { color: colors.black, fontSize: 12, fontWeight: '700', letterSpacing: -0.1, lineHeight: 16 },
  settingsMark: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  content: { gap: 48, paddingBottom: 138, paddingHorizontal: 16, paddingTop: 16 },
  monthHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  monthTitleGroup: { alignItems: 'baseline', flexDirection: 'row', gap: 8 },
  monthUnderline: { borderBottomColor: colors.black, borderBottomWidth: 2, paddingBottom: 1 },
  monthTitle: { color: colors.black, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, lineHeight: 36 },
  yearLabel: { color: 'rgba(0, 0, 0, 0.6)', fontFamily: 'monospace', fontSize: 11, lineHeight: 14 },
  monthControls: { flexDirection: 'row', gap: 16 },
  monthControl: { alignItems: 'center', borderColor: colors.black, borderWidth: 1.5, height: 40, justifyContent: 'center', width: 40 },
  monthControlPressed: { backgroundColor: '#EEEEEE', transform: [{ scale: 0.92 }] },
  calendarGrid: { backgroundColor: colors.white, borderColor: colors.black, borderRadius: 8, borderWidth: 1.5, overflow: 'hidden' },
  weekRow: { flexDirection: 'row' },
  weekdayCell: { alignItems: 'center', borderBottomColor: colors.black, borderBottomWidth: 1, borderRightColor: colors.black, borderRightWidth: 1, height: 29, justifyContent: 'center', width: `${100 / WEEKDAYS.length}%` },
  weekdayText: { color: colors.black, fontFamily: 'monospace', fontSize: 10, lineHeight: 12 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { borderBottomColor: colors.black, borderBottomWidth: 1, borderRightColor: colors.black, borderRightWidth: 1, height: 42, paddingHorizontal: 7, paddingTop: 6, position: 'relative', width: `${100 / WEEKDAYS.length}%` },
  rightEdge: { borderRightWidth: 0 },
  bottomEdge: { borderBottomWidth: 0 },
  dayNumber: { color: colors.black, fontFamily: 'monospace', fontSize: 10, lineHeight: 12 },
  todayNumber: { fontWeight: '700' },
  todayMarker: { left: 2, position: 'absolute', top: 0 },
  diarySection: { gap: 24 },
  diaryHeading: { color: colors.black, fontSize: 23, fontWeight: '700', letterSpacing: -0.55, lineHeight: 30 },
  diaryCard: { backgroundColor: colors.white, borderColor: colors.black, borderWidth: 3, padding: 24 },
  diaryCardHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  timestamp: { color: '#5D5F5F', fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.35, lineHeight: 12 },
  entryTitle: { color: colors.black, fontSize: 17, fontWeight: '700', lineHeight: 23, marginBottom: 5 },
  entryDescription: { color: colors.black, fontSize: 15, lineHeight: 23, marginBottom: 20 },
  photoPlaceholder: { alignItems: 'center', backgroundColor: '#F1F1F1', borderColor: colors.black, borderWidth: 1.5, height: 150, justifyContent: 'center', marginBottom: 16, overflow: 'hidden', position: 'relative' },
  placeholderLines: { left: 18, opacity: 0.35, position: 'absolute', top: 18 },
  placeholderLine: { backgroundColor: colors.black, height: 2, marginBottom: 7, transform: [{ rotate: '-2deg' }], width: 65 },
  shortPlaceholderLine: { marginLeft: 9, transform: [{ rotate: '2deg' }], width: 38 },
  tags: { flexDirection: 'row', gap: 8 },
  tag: { borderColor: colors.black, borderWidth: 1.5, paddingHorizontal: 11, paddingVertical: 5 },
  tagLabel: { color: colors.black, fontFamily: 'monospace', fontSize: 10, lineHeight: 12 },
  monthSummaryCard: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.black, borderWidth: 1.5, flexDirection: 'row', justifyContent: 'space-between', minHeight: 76, padding: 20 },
  summaryCopy: { flex: 1, gap: 3 },
  summaryTitle: { color: colors.black, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  summaryDescription: { color: 'rgba(0, 0, 0, 0.6)', fontSize: 10, lineHeight: 14 },
});
