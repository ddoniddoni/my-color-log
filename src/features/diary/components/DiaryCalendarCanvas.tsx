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
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { LoadingSkeleton } from '@/src/components/feedback/LoadingSkeleton';
import { AppConfirmationDialog } from '@/src/components/ui/AppConfirmationDialog';
import { AppText } from '@/src/components/ui/AppText';
import { NinePhotoMosaic, type NinePhotoMosaicPhoto } from '@/src/components/ui/NinePhotoMosaic';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing, type ThemeColors } from '@/src/design/tokens';
import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { DiaryCollageModal } from '@/src/features/diary/components/DiaryCollageModal';
import { DiaryEditModal, type DiaryEditTarget } from '@/src/features/diary/components/DiaryEditModal';
import { DiaryPhotoViewer } from '@/src/features/diary/components/DiaryPhotoViewer';
import { useDiaryEdits } from '@/src/features/diary/hooks/useDiaryEdits';
import { useDiaryMonth } from '@/src/features/diary/hooks/useDiaryMonth';
import { getDiaryEntryMemo, type DiaryEntry, type DiaryPhoto, type DiarySharedRoom } from '@/src/features/diary/model/diaryMonth';
import { getCalendarCells, getSelectedDiaryDateKey, moveMonth, type MonthCursor } from '@/src/features/diary/model/calendar';
import { useTimeZoneDateKey } from '@/src/features/missions/hooks/useTimeZoneDateKey';
import { useDeviceTimeZone } from '@/src/lib/localization/deviceTimeZone';
import { getTimeZoneDisplayName, isFutureDateInTimeZone } from '@/src/utils/dates/timezone';
import { getPhotoAccessibilityLabel } from '@/src/utils/accessibility/photoAccessibility';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

type DiaryNotice = {
  description: string;
  title: string;
};

type DiaryPhotoDeleteTarget = {
  dateKey: string;
  entryId: string;
  photo: DiaryPhoto;
};

type DiaryOverlay =
  | { kind: 'none' }
  | { kind: 'photo'; photoId: string }
  | { kind: 'edit'; target: DiaryEditTarget }
  | { kind: 'delete'; target: DiaryPhotoDeleteTarget }
  | { kind: 'notice'; notice: DiaryNotice };

export function DiaryCalendarCanvas() {
  const styles = useDiaryStyles();
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sessionState = useSessionBootstrap();
  const timeZone = useDeviceTimeZone();
  const todayKey = useTimeZoneDateKey(timeZone);
  const [todayYear, todayMonth, todayDay] = todayKey.split('-').map(Number);
  const [cursor, setCursor] = useState<MonthCursor>({ month: todayMonth, year: todayYear });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<DiaryOverlay>({ kind: 'none' });
  const scrollViewRef = useRef<ScrollView>(null);
  const diarySectionTop = useRef(0);
  const isMountedRef = useRef(true);
  const monthKey = `${cursor.year}-${String(cursor.month).padStart(2, '0')}`;
  const userId = sessionState.status === 'ready' ? sessionState.session?.user.id ?? null : null;
  const diaryQuery = useDiaryMonth(userId, monthKey);
  const diaryEdits = useDiaryEdits({ monthKey, userId });
  const entries = useMemo(() => diaryQuery.data ?? [], [diaryQuery.data]);
  const calendar = getCalendarCells(cursor.year, cursor.month);
  const isCurrentMonth = cursor.year === todayYear && cursor.month === todayMonth;
  const entriesByDate = useMemo(() => new Map(entries.map((entry) => [entry.dateKey, entry])), [entries]);
  const selectedCalendarDate = getSelectedDiaryDateKey({ entries, isCurrentMonth, selectedDateKey, todayKey });
  const selectedEntry = selectedCalendarDate ? entriesByDate.get(selectedCalendarDate) ?? null : null;
  const bodyFont = fontsLoaded ? 'BricolageGrotesque_400Regular' : undefined;
  const boldFont = fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined;
  const heavyFont = fontsLoaded ? 'BricolageGrotesque_800ExtraBold' : undefined;

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const moveDiaryMonth = (offset: number): void => {
    setCursor((current) => moveMonth(current, offset));
    setSelectedDateKey(null);
    setOverlay({ kind: 'none' });
  };

  const selectDiaryDate = (dateKey: string): void => {
    setSelectedDateKey(dateKey);
    setOverlay({ kind: 'none' });
    scrollViewRef.current?.scrollTo({ animated: true, y: Math.max(0, diarySectionTop.current - 12) });
  };

  const deleteDiaryPhoto = async (): Promise<void> => {
    if (overlay.kind !== 'delete') return;
    const deleteTarget = overlay.target;
    try {
      const result = await diaryEdits.deletePhoto(deleteTarget);
      if (!isMountedRef.current) return;
      if (result.storageCleanupPending) {
        setOverlay({
          kind: 'notice',
          notice: {
            description: result.willRetryStorageCleanup
              ? '다이어리와 친구방에서는 바로 사라졌어요. 비공개 파일 정리는 연결이 안정되면 자동으로 다시 시도해요.'
              : '다이어리와 친구방에서는 바로 사라졌지만 비공개 파일 정리를 완료하지 못했어요. 앱을 다시 연 뒤 상태를 확인해 주세요.',
            title: '사진을 삭제했어요',
          },
        });
      } else {
        setOverlay({ kind: 'none' });
      }
    } catch {
      if (!isMountedRef.current) return;
      setOverlay({
        kind: 'notice',
        notice: {
          description: '연결을 확인한 뒤 다시 시도해 주세요.',
          title: '사진을 삭제하지 못했어요',
        },
      });
    }
  };

  return (
    <View style={styles.page}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.dateGroup}>
          <View accessible accessibilityLabel="내 프로필 그림" accessibilityRole="image" style={styles.profileMark}><ProfileSketch /></View>
          <AppText style={[styles.headerDate, { fontFamily: boldFont }]}>{todayKey.replaceAll('-', '.')}</AppText>
        </View>
        <View accessible accessibilityLabel="설정은 준비 중이에요" accessibilityRole="image" style={styles.settingsMark}><SettingsSketch /></View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 48) }]} ref={scrollViewRef} showsVerticalScrollIndicator={false}>
        <View style={styles.monthHeader}>
          <View style={styles.monthTitleGroup}>
            <View style={styles.monthUnderline}><AppText style={[styles.monthTitle, { fontFamily: heavyFont }]}>{cursor.month}월</AppText></View>
            <AppText style={styles.yearLabel}>{cursor.year}</AppText>
          </View>
          <View style={styles.monthControls}>
            <MonthControl direction="previous" onPress={() => moveDiaryMonth(-1)} />
            <MonthControl direction="next" onPress={() => moveDiaryMonth(1)} />
          </View>
        </View>

        <View style={styles.calendarGrid}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((weekday, index) => <View key={weekday} style={[styles.weekdayCell, index === WEEKDAYS.length - 1 && styles.rightEdge]}><AppText style={styles.weekdayText}>{weekday}</AppText></View>)}
          </View>
          <View style={styles.dayGrid}>
            {calendar.map((cell, index) => {
              const dateKey = cell.day ? getDateKey(cursor, cell.day) : null;
              const entry = dateKey ? entriesByDate.get(dateKey) : undefined;
              const isToday = isCurrentMonth && cell.day === todayDay;
              const isSelected = dateKey !== null && dateKey === selectedCalendarDate;
              const isLastColumn = (index + 1) % WEEKDAYS.length === 0;
              const isLastRow = index >= calendar.length - WEEKDAYS.length;
              const label = cell.day
                ? `${cursor.month}월 ${cell.day}일${entry ? `, ${entry.color.nameKo} 사진 ${entry.photos.length}장` : ', 기록 없음'}${isToday ? ', 오늘' : ''}${isSelected ? ', 선택됨' : ''}`
                : '빈 날짜 칸';

              return (
                <Pressable
                  accessibilityLabel={label}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !cell.day, selected: isSelected }}
                  disabled={!cell.day}
                  key={cell.key}
                  onPress={() => dateKey && selectDiaryDate(dateKey)}
                  style={({ pressed }) => [
                    styles.dayCell,
                    isLastColumn && styles.rightEdge,
                    isLastRow && styles.bottomEdge,
                    entry && { backgroundColor: entry.color.accentTint },
                    isSelected && styles.selectedDayCell,
                    pressed && styles.dayCellPressed,
                  ]}>
                  {cell.day ? <AppText style={[styles.dayNumber, entry && { color: entry.color.accentShade }, isToday && styles.todayNumber, isSelected && styles.selectedDayNumber]}>{cell.day}</AppText> : null}
                  {entry ? <View pointerEvents="none" style={[styles.entryDot, { backgroundColor: entry.color.accent }, isSelected && styles.selectedEntryDot]} /> : null}
                  {isToday ? <View pointerEvents="none" style={[styles.todayUnderline, isSelected && styles.selectedTodayUnderline]} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <MonthSummary entries={entries} bodyFont={bodyFont} boldFont={boldFont} />

        <View onLayout={(event) => { diarySectionTop.current = event.nativeEvent.layout.y; }} style={styles.diarySection}>
          <AppText style={[styles.diaryHeading, { fontFamily: boldFont }]}>{selectedEntry ? `${formatEntryDate(selectedEntry.dateKey)}의 다이어리` : selectedCalendarDate ? `${formatEntryDate(selectedCalendarDate)}의 다이어리` : `${cursor.month}월의 다이어리`}</AppText>
          {sessionState.status === 'loading' || diaryQuery.isPending
            ? <DiaryLoadingCard />
            : sessionState.status === 'error' || diaryQuery.isError
              ? <DiaryErrorCard onRetry={() => void diaryQuery.refetch()} />
              : selectedEntry
                ? <DiaryEntryCard
                    bodyFont={bodyFont}
                    boldFont={boldFont}
                    entry={selectedEntry}
                    key={selectedEntry.id}
                    onEditNote={() => setOverlay({ kind: 'edit', target: { entry: selectedEntry, kind: 'note' } })}
                    onOpenSharedRoom={(room) => {
                      if (!room.canOpen) return;
                      router.push({ pathname: '/room-history', params: { dateKey: selectedEntry.dateKey, roomId: room.id } });
                    }}
                    onPhotoPress={(photoId) => setOverlay({ kind: 'photo', photoId })}
                    timeZone={timeZone}
                  />
                : <EmptyDiaryCard bodyFont={bodyFont} boldFont={boldFont} dateKey={selectedCalendarDate} isFuture={selectedCalendarDate ? isFutureDateInTimeZone(selectedCalendarDate, timeZone) : false} timeZone={timeZone} />}
        </View>
      </ScrollView>

      <DiaryPhotoViewer
        entry={selectedEntry}
        isDeleting={diaryEdits.isDeleting}
        onClose={() => setOverlay({ kind: 'none' })}
        onDeletePhoto={(photo) => {
          if (!selectedEntry) return;
          setOverlay({ kind: 'delete', target: { dateKey: selectedEntry.dateKey, entryId: selectedEntry.id, photo } });
        }}
        onEditPhoto={(photo) => {
          if (!selectedEntry) return;
          setOverlay({ kind: 'edit', target: { entry: selectedEntry, kind: 'caption', photo } });
        }}
        onSelectPhoto={(photoId) => setOverlay({ kind: 'photo', photoId })}
        selectedPhotoId={overlay.kind === 'photo' ? overlay.photoId : null}
        timeZone={timeZone}
      />
      <DiaryEditModal
        isSaving={diaryEdits.isSaving}
        onClose={() => setOverlay({ kind: 'none' })}
        onSave={async (value) => {
          if (overlay.kind !== 'edit') return;
          const editTarget = overlay.target;
          if (editTarget.kind === 'note') {
            await diaryEdits.updateNote({ dateKey: editTarget.entry.dateKey, entryId: editTarget.entry.id, value });
          } else {
            await diaryEdits.updateCaption({ dateKey: editTarget.entry.dateKey, entryId: editTarget.entry.id, photoId: editTarget.photo.id, value });
          }
        }}
        target={overlay.kind === 'edit' ? overlay.target : null}
      />
      <AppConfirmationDialog
        cancelLabel="취소"
        confirmLabel="사진 삭제"
        description="내 다이어리와 이 사진을 함께 본 친구방 기록에서 바로 사라져요. 이 작업은 되돌릴 수 없어요."
        isBusy={diaryEdits.isDeleting}
        onClose={() => setOverlay({ kind: 'none' })}
        onConfirm={() => { void deleteDiaryPhoto(); }}
        title="이 사진을 삭제할까요?"
        tone="destructive"
        visible={overlay.kind === 'delete'}
      />
      <AppConfirmationDialog
        confirmLabel="확인"
        description={overlay.kind === 'notice' ? overlay.notice.description : ''}
        onClose={() => setOverlay({ kind: 'none' })}
        onConfirm={() => setOverlay({ kind: 'none' })}
        title={overlay.kind === 'notice' ? overlay.notice.title : ''}
        visible={overlay.kind === 'notice'}
      />
    </View>
  );
}

function MonthSummary({ bodyFont, boldFont, entries }: { entries: DiaryEntry[]; bodyFont: string | undefined; boldFont: string | undefined }) {
  const styles = useDiaryStyles();
  const photoCount = entries.reduce((total, entry) => total + entry.photos.length, 0);
  return (
    <View accessible accessibilityLabel={`이번 달 ${entries.length}일 기록, 사진 ${photoCount}장`} style={styles.monthSummaryCard}>
      <View style={styles.summaryCopy}>
        <AppText style={[styles.summaryTitle, { fontFamily: boldFont }]}>{entries.length > 0 ? `${entries.length}일의 색을 모았어요` : '이번 달 첫 색을 기다리고 있어요'}</AppText>
        <AppText style={[styles.summaryDescription, { fontFamily: bodyFont }]}>{entries.length > 0 ? `${photoCount}장의 사진이 나만의 다이어리에 남아 있어요.` : '오늘 발견한 색을 기록하면 달력에 채워져요.'}</AppText>
      </View>
      <View style={styles.summaryMark}><PaletteMark /></View>
    </View>
  );
}

function DiaryEntryCard({ bodyFont, boldFont, entry, onEditNote, onOpenSharedRoom, onPhotoPress, timeZone }: { bodyFont: string | undefined; boldFont: string | undefined; entry: DiaryEntry; onEditNote: () => void; onOpenSharedRoom: (room: DiarySharedRoom) => void; onPhotoPress: (photoId: string) => void; timeZone: string }) {
  const styles = useDiaryStyles();
  const photoCount = entry.photos.length;
  const [isCollageVisible, setIsCollageVisible] = useState(false);
  const mosaicPhotos: NinePhotoMosaicPhoto[] = entry.photos.flatMap((photo) => (
    photo.signedUrl ? [{
      accessibilityLabel: getPhotoAccessibilityLabel({ caption: photo.caption, colorName: entry.color.nameKo, position: photo.position }),
      capturedAt: photo.capturedAt,
      id: photo.id,
      position: photo.position,
      uri: photo.signedUrl,
    }] : []
  ));
  const memo = getDiaryEntryMemo(entry);

  return (
    <View style={styles.diaryCard}>
      <View style={styles.diaryCardHeader}>
        <AppText style={styles.timestamp}>{entry.dateKey} · {getTimeZoneDisplayName(timeZone)}</AppText>
        <View accessible accessibilityLabel={`${entry.color.nameKo} 색`} accessibilityRole="image" style={[styles.colorBadge, { backgroundColor: entry.color.accent }]} />
      </View>
      <AppText style={[styles.entryTitle, { fontFamily: boldFont }]}>{entry.color.nameKo}</AppText>
      <AppText style={[styles.entryDescription, { fontFamily: bodyFont }]}>{memo}</AppText>
      {photoCount > 0 ? <Pressable accessibilityLabel="내 기록 콜라주 내보내기" accessibilityRole="button" onPress={() => setIsCollageVisible(true)} style={styles.collageExportAction}>
        <View><AppText style={styles.collageExportTitle}>내 기록 콜라주</AppText><AppText style={styles.collageExportDescription}>내 사진 {photoCount}장을 한 장으로 만들어요</AppText></View>
        <AppText style={styles.collageExportArrow}>↗</AppText>
      </Pressable> : null}
      {photoCount > 0 ? (
        <NinePhotoMosaic
          accessibilityLabel={`${entry.dateKey}의 ${entry.color.nameKo} 사진 ${photoCount}장, 9칸 기록판`}
          onPhotoPress={(photo) => onPhotoPress(photo.id)}
          photos={mosaicPhotos}
        />
      ) : <View style={styles.awaitingPhoto}><AppText style={styles.awaitingPhotoText}>사진을 안전하게 올리는 중이에요.</AppText></View>}
      <View style={styles.tags}>
        <View style={styles.tag}><AppText style={styles.tagLabel}>#{entry.color.nameEn.replaceAll(' ', '').toLowerCase()}</AppText></View>
        <View style={styles.tag}><AppText style={styles.tagLabel}>#{photoCount}photos</AppText></View>
      </View>
      {entry.sharedRooms.length > 0 ? (
        <View style={styles.sharedRoomsSection}>
          <AppText style={styles.sharedRoomsEyebrow}>SHARED ROOM</AppText>
          <AppText style={[styles.sharedRoomsTitle, { fontFamily: boldFont }]}>친구방에서 함께 본 이날</AppText>
          <View style={styles.sharedRoomsList}>
            {entry.sharedRooms.map((room) => (
              <Pressable
                accessibilityLabel={`${room.name}${room.canOpen ? '의 이날 기록 보기' : ', 지금은 열 수 없는 친구방'}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: !room.canOpen }}
                disabled={!room.canOpen}
                key={room.id}
                onPress={() => onOpenSharedRoom(room)}
                style={({ pressed }) => [styles.sharedRoomItem, !room.canOpen && styles.sharedRoomItemDisabled, pressed && styles.sharedRoomItemPressed]}>
                <View style={styles.sharedRoomCopy}>
                  <AppText style={styles.sharedRoomEmoji}>{room.emoji ?? '○'}</AppText>
                  <View style={styles.sharedRoomTextGroup}>
                    <AppText numberOfLines={1} style={styles.sharedRoomName}>{room.name}</AppText>
                    <AppText style={styles.sharedRoomStatus}>{room.canOpen ? '함께 기록한 사진 보기' : '공유가 종료된 방'}</AppText>
                  </View>
                </View>
                <AppText style={[styles.sharedRoomArrow, !room.canOpen && styles.sharedRoomArrowDisabled]}>{room.canOpen ? '→' : '—'}</AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <Pressable accessibilityLabel="오늘의 메모 수정" accessibilityRole="button" onPress={onEditNote} style={styles.noteEditAction}>
        <AppText style={styles.noteEditActionText}>{entry.note ? '오늘의 메모 수정' : '오늘의 메모 쓰기'}</AppText>
        <AppText style={styles.noteEditArrow}>→</AppText>
      </Pressable>
      <DiaryCollageModal entry={entry} onClose={() => setIsCollageVisible(false)} visible={isCollageVisible} />
    </View>
  );
}

function EmptyDiaryCard({ bodyFont, boldFont, dateKey, isFuture, timeZone }: { bodyFont: string | undefined; boldFont: string | undefined; dateKey: string | null; isFuture: boolean; timeZone: string }) {
  const styles = useDiaryStyles();
  const title = dateKey ? isFuture ? '아직 오지 않은 날이에요' : '아직 기록이 없어요' : '이번 달 첫 기록';
  const description = dateKey
    ? isFuture
      ? '이 날이 오면 새로운 색을 기록할 수 있어요.'
      : '이 날에는 사진을 남기지 않았어요.'
    : '오늘 발견한 색과 그때의 느낌을 한 장으로 남겨 보세요.';

  return (
    <View style={styles.diaryCard}>
      <View style={styles.diaryCardHeader}>
        <AppText style={styles.timestamp}>{dateKey ? `${dateKey} · ${getTimeZoneDisplayName(timeZone)}` : 'EMPTY PAGE'}</AppText>
        <View accessible accessibilityLabel="기록 별표" accessibilityRole="image"><StarIcon /></View>
      </View>
      <AppText style={[styles.entryTitle, { fontFamily: boldFont }]}>{title}</AppText>
      <AppText style={[styles.entryDescription, { fontFamily: bodyFont }]}>{description}</AppText>
      <View accessible accessibilityLabel="아직 사진이 없는 기록 자리" accessibilityRole="image" style={styles.photoPlaceholder}>
        <View style={styles.placeholderLines}><View style={styles.placeholderLine} /><View style={[styles.placeholderLine, styles.shortPlaceholderLine]} /></View>
        <CameraSketch />
      </View>
    </View>
  );
}

function DiaryLoadingCard() {
  const styles = useDiaryStyles();
  return <View style={styles.diaryCard}><LoadingSkeleton style={styles.loadingTitle} /><LoadingSkeleton style={styles.loadingPhoto} /></View>;
}

function DiaryErrorCard({ onRetry }: { onRetry: () => void }) {
  const styles = useDiaryStyles();
  return (
    <View style={styles.diaryCard}>
      <AppText style={styles.entryTitle}>다이어리를 불러오지 못했어요</AppText>
      <AppText style={styles.entryDescription}>연결되면 다시 불러올 수 있어요.</AppText>
      <Pressable accessibilityLabel="다이어리 다시 불러오기" accessibilityRole="button" onPress={onRetry} style={styles.retryButton}><AppText style={styles.retryText}>다시 시도</AppText></Pressable>
    </View>
  );
}

function MonthControl({ direction, onPress }: { direction: 'next' | 'previous'; onPress: () => void }) {
  const styles = useDiaryStyles();
  const label = direction === 'previous' ? '이전 달 보기' : '다음 달 보기';
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.monthControl, pressed && styles.monthControlPressed]}>
      <ChevronIcon direction={direction === 'previous' ? 'left' : 'right'} />
    </Pressable>
  );
}

function getDateKey(cursor: MonthCursor, day: number): string {
  return `${cursor.year}-${String(cursor.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatEntryDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

function ProfileSketch() {
  const { colors } = useAppTheme();
  return <Svg height={28} viewBox="0 0 28 28" width={28}><Circle cx={14} cy={14} fill={colors.canvas} r={13} stroke={colors.ink} strokeWidth={1.25} /><Circle cx={10} cy={12} fill={colors.ink} r={1.4} /><Circle cx={18} cy={12} fill={colors.ink} r={1.4} /><Path d="M9.5 17c1.4 1.7 3 2.5 4.5 2.5s3.1-.8 4.5-2.5M8.2 8.5c2.5-2.1 9.1-2.1 11.6 0" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth={1.25} /></Svg>;
}

function SettingsSketch() {
  const { colors } = useAppTheme();
  return <Svg height={23} viewBox="0 0 24 24" width={23}><Circle cx={12} cy={12} fill="none" r={3.1} stroke={colors.ink} strokeWidth={1.5} /><Path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2m14.5-6.5-1.4 1.4M7 17l-1.4 1.4m0-12.8L7 7m9.6 9.6 1.4 1.4" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth={1.5} /></Svg>;
}

function StarIcon() {
  const { colors } = useAppTheme();
  return <Svg height={18} viewBox="0 0 24 24" width={18}><Path d="m12 3 2.1 5.5 5.9.2-4.6 3.7 1.6 5.7-5-3.4-5 3.4 1.6-5.7L4 8.7l5.9-.2L12 3Z" fill={colors.ink} stroke={colors.ink} strokeLinejoin="round" strokeWidth={1.1} /></Svg>;
}

function PaletteMark() {
  const { colors } = useAppTheme();
  return <Svg height={27} viewBox="0 0 28 28" width={27}><Path d="M14 3.5a10.5 10.5 0 1 0 0 21h1.8c1.6 0 2.3-1.7 1.1-2.8-.6-.6-.1-1.6.8-1.6H20A6.5 6.5 0 0 0 20 7 10.5 10.5 0 0 0 14 3.5Z" fill="none" stroke={colors.ink} strokeWidth={1.5} /><Circle cx={9} cy={11} fill={colors.ink} r={1} /><Circle cx={14} cy={8.5} fill={colors.ink} r={1} /><Circle cx={19} cy={11.5} fill={colors.ink} r={1} /></Svg>;
}

function CameraSketch() {
  const { colors } = useAppTheme();
  return <Svg height={46} viewBox="0 0 56 48" width={54}><Path d="M7 16h12l3-5h12l3 5h12v24H7V16Zm21 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" fill="none" stroke={colors.textTertiary} strokeLinejoin="round" strokeWidth={1.6} /><Path d="M9 44c11-3 27-1 38-3" fill="none" stroke={colors.textTertiary} strokeLinecap="round" strokeWidth={1.2} /></Svg>;
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  const { colors } = useAppTheme();
  const path = direction === 'left' ? 'm14.5 5-6 7 6 7' : 'm9.5 5 6 7-6 7';
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d={path} fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

function useDiaryStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  page: { backgroundColor: colors.canvas, flex: 1 },
  appBar: { alignItems: 'center', backgroundColor: colors.canvas, flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, paddingBottom: 10, paddingHorizontal: 16 },
  dateGroup: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  profileMark: { height: 32, width: 32 },
  headerDate: { color: colors.ink, fontSize: 12, fontWeight: '700', letterSpacing: -0.1, lineHeight: 16 },
  settingsMark: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  content: { gap: 32, paddingHorizontal: 16, paddingTop: 16 },
  monthHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  monthTitleGroup: { alignItems: 'baseline', flexDirection: 'row', gap: 8 },
  monthUnderline: { borderBottomColor: colors.ink, borderBottomWidth: 2, paddingBottom: 1 },
  monthTitle: { color: colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, lineHeight: 36 },
  yearLabel: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 11, lineHeight: 14 },
  monthControls: { flexDirection: 'row', gap: 16 },
  monthControl: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, height: 44, justifyContent: 'center', width: 44 },
  monthControlPressed: { backgroundColor: colors.surfaceMuted, transform: [{ scale: 0.92 }] },
  calendarGrid: { backgroundColor: colors.surface, borderColor: colors.ink, borderRadius: 8, borderWidth: 1.5, overflow: 'hidden' },
  weekRow: { flexDirection: 'row' },
  weekdayCell: { alignItems: 'center', borderBottomColor: colors.ink, borderBottomWidth: 1, borderRightColor: colors.ink, borderRightWidth: 1, height: 29, justifyContent: 'center', width: `${100 / WEEKDAYS.length}%` },
  weekdayText: { color: colors.ink, fontFamily: 'monospace', fontSize: 10, lineHeight: 12 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { borderBottomColor: colors.ink, borderBottomWidth: 1, borderRightColor: colors.ink, borderRightWidth: 1, height: 47, paddingHorizontal: 7, paddingTop: 6, position: 'relative', width: `${100 / WEEKDAYS.length}%` },
  dayCellPressed: { opacity: 0.72 },
  selectedDayCell: { backgroundColor: colors.ink, borderColor: colors.ink, borderWidth: 2, paddingHorizontal: 6, paddingTop: 5 },
  rightEdge: { borderRightWidth: 0 },
  bottomEdge: { borderBottomWidth: 0 },
  dayNumber: { color: colors.ink, fontFamily: 'monospace', fontSize: 10, lineHeight: 12 },
  selectedDayNumber: { color: colors.surface, fontWeight: '700' },
  todayNumber: { fontWeight: '700' },
  todayUnderline: { backgroundColor: colors.ink, height: 2, left: 7, position: 'absolute', top: 23, width: 12 },
  selectedTodayUnderline: { backgroundColor: colors.surface },
  entryDot: { borderColor: colors.ink, borderRadius: 3, borderWidth: 0.5, bottom: 7, height: 6, position: 'absolute', right: 7, width: 6 },
  selectedEntryDot: { borderColor: colors.surface },
  monthSummaryCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 1.5, flexDirection: 'row', justifyContent: 'space-between', minHeight: 76, padding: 20 },
  summaryCopy: { flex: 1, gap: 3 },
  summaryTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  summaryDescription: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  summaryMark: { marginLeft: spacing[3] },
  diarySection: { gap: 14 },
  diaryHeading: { color: colors.ink, fontSize: 23, fontWeight: '700', letterSpacing: -0.55, lineHeight: 30 },
  diaryCard: { backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 2, padding: 20 },
  diaryCardHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  timestamp: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.35, lineHeight: 12 },
  colorBadge: { borderColor: colors.ink, borderRadius: 9, borderWidth: 1, height: 18, width: 18 },
  entryTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', lineHeight: 24, marginBottom: 5 },
  entryDescription: { color: colors.ink, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  awaitingPhoto: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.ink, borderStyle: 'dashed', borderWidth: 1.5, height: 112, justifyContent: 'center' },
  awaitingPhotoText: { color: colors.textSecondary, fontSize: 12 },
  photoPlaceholder: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.ink, borderWidth: 1.5, height: 150, justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  placeholderLines: { left: 18, opacity: 0.35, position: 'absolute', top: 18 },
  placeholderLine: { backgroundColor: colors.ink, height: 2, marginBottom: 7, transform: [{ rotate: '-2deg' }], width: 65 },
  shortPlaceholderLine: { marginLeft: 9, transform: [{ rotate: '2deg' }], width: 38 },
  tags: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tag: { borderColor: colors.ink, borderWidth: 1.5, paddingHorizontal: 11, paddingVertical: 5 },
  tagLabel: { color: colors.ink, fontFamily: 'monospace', fontSize: 10, lineHeight: 12 },
  sharedRoomsSection: { borderTopColor: colors.border, borderTopWidth: 1, gap: 8, marginTop: 16, paddingTop: 16 },
  sharedRoomsEyebrow: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.8, lineHeight: 12 },
  sharedRoomsTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  sharedRoomsList: { gap: 8 },
  sharedRoomItem: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.ink, borderWidth: 1.5, flexDirection: 'row', justifyContent: 'space-between', minHeight: 62, paddingHorizontal: 12, paddingVertical: 9 },
  sharedRoomItemDisabled: { backgroundColor: colors.canvas, borderColor: colors.borderStrong, borderStyle: 'dashed' },
  sharedRoomItemPressed: { opacity: 0.68 },
  sharedRoomCopy: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10 },
  sharedRoomEmoji: { color: colors.ink, fontSize: 20, lineHeight: 26, textAlign: 'center', width: 28 },
  sharedRoomTextGroup: { flex: 1 },
  sharedRoomName: { color: colors.ink, fontSize: 12, fontWeight: '800', lineHeight: 17 },
  sharedRoomStatus: { color: colors.textSecondary, fontSize: 10, lineHeight: 15 },
  sharedRoomArrow: { color: colors.ink, fontSize: 18, lineHeight: 22, marginLeft: 8 },
  sharedRoomArrowDisabled: { color: colors.textTertiary },
  collageExportAction: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.ink, borderWidth: 1.5, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, marginTop: 16, minHeight: 62, paddingHorizontal: 12 },
  collageExportTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  collageExportDescription: { color: colors.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 2 },
  collageExportArrow: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  noteEditAction: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, minHeight: 44, paddingTop: 8 },
  noteEditActionText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  noteEditArrow: { color: colors.ink, fontSize: 18, lineHeight: 22 },
  loadingTitle: { height: 22, marginBottom: spacing[4], width: '42%' },
  loadingPhoto: { height: 150, width: '100%' },
  retryButton: { alignItems: 'center', backgroundColor: colors.ink, justifyContent: 'center', minHeight: 44 },
  retryText: { color: colors.surface, fontSize: 13, fontWeight: '700' },
  });
}
