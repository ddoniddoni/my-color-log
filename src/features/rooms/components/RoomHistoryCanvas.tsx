import {
  ActivityIndicator,
  FlatList,
  type ListRenderItemInfo,
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
import { memo, useCallback, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { NinePhotoMosaic, type NinePhotoMosaicPhoto } from '@/src/components/ui/NinePhotoMosaic';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing, type ThemeColors } from '@/src/design/tokens';
import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { RoomMemberPhotoViewer } from '@/src/features/rooms/components/RoomMemberPhotoViewer';
import { useRoomDayBoard } from '@/src/features/rooms/hooks/useActiveRoomDayBoard';
import { useRoomHistory } from '@/src/features/rooms/hooks/useActiveRoomHistory';
import { useRoom } from '@/src/features/rooms/hooks/useRoom';
import { type RoomHistoryDay } from '@/src/features/rooms/model/roomHistory';
import { type RoomBoardMember, type RoomBoardMission, type RoomBoardPhoto } from '@/src/features/rooms/model/roomTodayBoard';
import { getPhotoAccessibilityLabel } from '@/src/utils/accessibility/photoAccessibility';
import { DEFAULT_TIME_ZONE } from '@/src/utils/dates/timezone';
import { formatDateKey } from '@/src/lib/localization/dateFormat';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

type RoomBoardPhotoSelection = {
  memberId: string;
  photoId: string;
};

export function RoomHistoryCanvas({ initialDateKey, initialPhotoId, roomId }: { initialDateKey?: string; initialPhotoId?: string; roomId: string }) {
  const styles = useRoomHistoryStyles();
  const { language } = useAppLanguage();
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sessionState = useSessionBootstrap();
  const userId = sessionState.status === 'ready' ? sessionState.session?.user.id ?? null : null;
  const roomQuery = useRoom(userId, roomId);
  const roomTimeZone = roomQuery.data?.timeZone ?? DEFAULT_TIME_ZONE;
  const historyQuery = useRoomHistory(userId, roomId);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(initialDateKey ?? null);
  const effectiveDateKey = selectedDateKey ?? historyQuery.data?.[0]?.dateKey ?? null;
  const boardQuery = useRoomDayBoard(userId, roomId, effectiveDateKey);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [photoSelection, setPhotoSelection] = useState<RoomBoardPhotoSelection | null>(null);
  const [dismissedInitialPhotoId, setDismissedInitialPhotoId] = useState<string | null>(null);
  const bodyFont = fontsLoaded ? 'BricolageGrotesque_400Regular' : undefined;
  const boldFont = fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined;
  const heavyFont = fontsLoaded ? 'BricolageGrotesque_800ExtraBold' : undefined;

  const board = boardQuery.data ?? null;
  const initialPhotoMember = initialPhotoId && dismissedInitialPhotoId !== initialPhotoId
    ? board?.members.find((candidate) => candidate.photos.some((photo) => photo.id === initialPhotoId)) ?? null
    : null;
  const effectivePhotoSelection = photoSelection ?? (initialPhotoMember && initialPhotoId
    ? { memberId: initialPhotoMember.id, photoId: initialPhotoId }
    : null);
  const selectedMember = board?.members.find((member) => member.id === selectedMemberId)
    ?? initialPhotoMember
    ?? board?.members.find((member) => member.id === userId)
    ?? board?.members[0]
    ?? null;
  const selectedPhotoMember = board?.members.find((member) => member.id === effectivePhotoSelection?.memberId) ?? null;
  const handleSelectDate = useCallback((dateKey: string): void => {
    setSelectedDateKey(dateKey);
    setSelectedMemberId(null);
    setPhotoSelection(null);
  }, []);
  const handleSelectMember = useCallback((memberId: string): void => setSelectedMemberId(memberId), []);
  const renderHistoryDay = useCallback(({ item }: ListRenderItemInfo<RoomHistoryDay>) => (
    <HistoryDateItem
      boldFont={boldFont}
      day={item}
      isSelected={item.dateKey === effectiveDateKey}
      onSelect={handleSelectDate}
    />
  ), [boldFont, effectiveDateKey, handleSelectDate]);
  const renderMember = useCallback(({ item }: ListRenderItemInfo<RoomBoardMember>) => (
    <HistoryMemberItem
      boldFont={boldFont}
      dateKey={board?.dateKey ?? ''}
      isSelected={item.id === selectedMember?.id}
      member={item}
      onSelect={handleSelectMember}
    />
  ), [board?.dateKey, boldFont, handleSelectMember, selectedMember?.id]);

  return (
    <View style={styles.page}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, spacing[2]) }]}>
        <Pressable accessibilityLabel="친구방으로 돌아가기" accessibilityRole="button" hitSlop={10} onPress={() => router.back()} style={styles.backButton}>
          <BackIcon />
        </Pressable>
        <View style={styles.topCopy}>
          <AppText style={styles.eyebrow}>ROOM ARCHIVE</AppText>
          <AppText style={[styles.topTitle, { fontFamily: boldFont }]}>우리의 기록</AppText>
        </View>
      </View>

      {sessionState.status === 'loading' || historyQuery.isPending ? <HistoryState message="우리의 기록을 불러오고 있어요." /> : null}
      {sessionState.status === 'error' || !userId || historyQuery.isError ? <HistoryState message="기록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요." /> : null}
      {sessionState.status === 'ready' && userId && !historyQuery.isPending && !historyQuery.isError ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <AppText style={[styles.title, { fontFamily: heavyFont }]}>날짜를 골라{`\n`}그날의 색을 다시 봐요.</AppText>
            <AppText style={[styles.subtitle, { fontFamily: bodyFont }]}>입장한 날부터 함께 남긴 사진만 안전하게 보여요.</AppText>
          </View>

          {historyQuery.data && historyQuery.data.length > 0 ? (
            <>
              <FlatList
                accessibilityLabel="친구방 기록 날짜 선택"
                contentContainerStyle={styles.dateList}
                data={historyQuery.data}
                horizontal
                keyExtractor={(day) => day.dateKey}
                renderItem={renderHistoryDay}
                showsHorizontalScrollIndicator={false}
              />

              {boardQuery.isPending ? <HistoryState message="그날의 캔버스를 준비하고 있어요." /> : null}
              {boardQuery.isError ? <Pressable accessibilityLabel="친구방 기록 다시 불러오기" accessibilityRole="button" onPress={() => { void boardQuery.refetch(); }} style={styles.retry}><AppText style={[styles.retryTitle, { fontFamily: boldFont }]}>기록을 불러오지 못했어요.</AppText><AppText style={styles.retryText}>눌러서 다시 시도해 주세요.</AppText></Pressable> : null}
              {!boardQuery.isPending && !boardQuery.isError && board ? (
                <>
                  <View style={styles.missionCard}>
                    <View style={[styles.missionColor, { backgroundColor: board.mission.colorHex }]} />
                    <View style={styles.missionCopy}>
                      <AppText localize={false} style={styles.missionEyebrow}>{formatDateKey(board.dateKey, language, 'numeric')} · {language === 'ko' ? '오늘의 미션' : 'DAILY MISSION'}</AppText>
                      <AppText localize={false} style={[styles.missionTitle, { fontFamily: boldFont }]}>{language === 'ko' ? board.mission.colorNameKo : board.mission.colorNameEn}</AppText>
                      <AppText localize={false} style={[styles.missionPrompt, { fontFamily: bodyFont }]}>{getRoomMissionPrompt(board.mission, language)}</AppText>
                    </View>
                  </View>

                  <FlatList
                    accessibilityLabel="기록 멤버 선택"
                    contentContainerStyle={styles.memberTabs}
                    data={board.members}
                    horizontal
                    keyExtractor={(member) => member.id}
                    renderItem={renderMember}
                    showsHorizontalScrollIndicator={false}
                  />

                  <View style={styles.canvasHeader}>
                    <AppText style={styles.canvasLabel}>SHARED CANVAS</AppText>
                    <AppText style={styles.canvasCount}>{selectedMember?.photos.length ?? 0} / 9</AppText>
                  </View>
                  {selectedMember ? (
                    <View style={styles.mosaicWrap}>
                      <RoomHistoryMosaic member={selectedMember} onOpenPhoto={(photo) => setPhotoSelection({ memberId: selectedMember.id, photoId: photo.id })} />
                    </View>
                  ) : null}
                </>
              ) : null}
              {!boardQuery.isPending && !boardQuery.isError && board === null && effectiveDateKey ? <HistoryState message="이 날짜의 기록은 볼 수 없어요." /> : null}
            </>
          ) : <HistoryState message="아직 함께 남긴 기록이 없어요. 오늘의 사진부터 채워 볼까요?" />}
        </ScrollView>
      ) : null}

      <RoomMemberPhotoViewer
        currentUserId={userId}
        initialPhotoId={effectivePhotoSelection?.photoId ?? null}
        key={effectivePhotoSelection ? `${effectivePhotoSelection.memberId}:${effectivePhotoSelection.photoId}` : 'closed'}
        member={selectedPhotoMember}
        mission={board?.mission ?? null}
        onClose={() => {
          if (photoSelection === null && initialPhotoId) setDismissedInitialPhotoId(initialPhotoId);
          setPhotoSelection(null);
        }}
        roomId={roomId}
        timeZone={roomTimeZone}
      />
    </View>
  );
}

const HistoryDateItem = memo(function HistoryDateItem({ boldFont, day, isSelected, onSelect }: {
  boldFont: string | undefined;
  day: RoomHistoryDay;
  isSelected: boolean;
  onSelect: (dateKey: string) => void;
}) {
  const styles = useRoomHistoryStyles();
  const { format, language } = useAppLanguage();
  const handlePress = useCallback(() => onSelect(day.dateKey), [day.dateKey, onSelect]);

  return (
    <Pressable
      accessibilityLabel={format('{date} 기록 보기', { date: formatDateKey(day.dateKey, language, 'full') })}
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      onPress={handlePress}
      style={[styles.dateCard, isSelected && styles.dateCardSelected]}>
      <View style={[styles.dateColor, { backgroundColor: day.mission.colorHex }]} />
      <AppText localize={false} style={[styles.dateText, { fontFamily: boldFont }, isSelected && styles.dateTextSelected]}>{formatDateKey(day.dateKey, language, 'shortWithWeekday')}</AppText>
      <AppText localize={false} style={[styles.dateCount, isSelected && styles.dateCountSelected]}>{format('{count}명 참여', { count: day.participantCount })}</AppText>
    </Pressable>
  );
});

const HistoryMemberItem = memo(function HistoryMemberItem({ boldFont, dateKey, isSelected, member, onSelect }: {
  boldFont: string | undefined;
  dateKey: string;
  isSelected: boolean;
  member: RoomBoardMember;
  onSelect: (memberId: string) => void;
}) {
  const styles = useRoomHistoryStyles();
  const { format, language } = useAppLanguage();
  const handlePress = useCallback(() => onSelect(member.id), [member.id, onSelect]);

  return (
    <Pressable
      accessibilityLabel={format('{name}의 {date} 사진 보드', { date: formatDateKey(dateKey, language, 'full'), name: member.nickname })}
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      onPress={handlePress}
      style={[styles.memberTab, isSelected && styles.memberTabSelected]}>
      <View style={[styles.memberAvatar, isSelected && styles.memberAvatarSelected]}><AppText style={[styles.memberInitial, { fontFamily: boldFont }, isSelected && styles.memberInitialSelected]}>{member.nickname.slice(0, 1)}</AppText></View>
      <View>
        <AppText style={[styles.memberName, { fontFamily: boldFont }, isSelected && styles.memberNameSelected]}>{member.nickname}</AppText>
        <AppText localize={false} style={[styles.memberStatus, isSelected && styles.memberStatusSelected]}>{language === 'ko' ? `사진 ${member.photos.length}장` : `${member.photos.length} PHOTOS`}</AppText>
      </View>
    </Pressable>
  );
});

function RoomHistoryMosaic({ member, onOpenPhoto }: { member: RoomBoardMember; onOpenPhoto: (photo: RoomBoardPhoto) => void }) {
  const { format } = useAppLanguage();
  const photos: NinePhotoMosaicPhoto[] = member.photos.flatMap((photo) => (
    photo.signedUrl ? [{
      accessibilityLabel: getPhotoAccessibilityLabel({ caption: photo.caption, ownerName: member.nickname, position: photo.position }),
      capturedAt: photo.capturedAt,
      id: photo.id,
      position: photo.position,
      uri: photo.signedUrl,
    }] : []
  ));

  return (
    <NinePhotoMosaic
      accessibilityLabel={format('{name}의 기록 사진 {count}장, 9칸 기록판', { count: photos.length, name: member.nickname })}
      onPhotoPress={(photo) => {
        const roomPhoto = member.photos.find((candidate) => candidate.id === photo.id);
        if (roomPhoto) onOpenPhoto(roomPhoto);
      }}
      photos={photos}
    />
  );
}

function HistoryState({ message }: { message: string }) {
  const { colors } = useAppTheme();
  const styles = useRoomHistoryStyles();
  return <View accessibilityLiveRegion="polite" style={styles.state}><ActivityIndicator color={colors.ink} /><AppText style={styles.stateText}>{message}</AppText></View>;
}

function getRoomMissionPrompt(mission: RoomBoardMission, language: 'en' | 'ko'): string {
  return language === 'ko' ? mission.promptKo : `Find a scene touched by ${mission.colorNameEn}.`;
}

function BackIcon() {
  const { colors } = useAppTheme();
  return <Svg height={22} viewBox="0 0 24 24" width={22}><Path d="m14.5 5-6 7 6 7" fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

function useRoomHistoryStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  page: { backgroundColor: colors.canvas, flex: 1 },
  topBar: { alignItems: 'center', borderBottomColor: colors.ink, borderBottomWidth: 2, flexDirection: 'row', gap: 10, paddingBottom: 12, paddingHorizontal: 16 },
  backButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  topCopy: { gap: 1 },
  eyebrow: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
  topTitle: { color: colors.ink, fontSize: 20, letterSpacing: -0.5 },
  content: { gap: 22, paddingBottom: 48 },
  intro: { gap: 8, paddingHorizontal: 20, paddingTop: 28 },
  title: { color: colors.ink, fontSize: 33, letterSpacing: -1.4, lineHeight: 40 },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  dateList: { gap: 10, paddingHorizontal: 20 },
  dateCard: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1.5, gap: 6, minWidth: 105, padding: 10 },
  dateCardSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  dateColor: { borderColor: colors.surface, borderRadius: 99, borderWidth: 1, height: 12, width: 12 },
  dateText: { color: colors.ink, fontSize: 14 },
  dateTextSelected: { color: colors.surface },
  dateCount: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 10 },
  dateCountSelected: { color: colors.surfaceMuted },
  missionCard: { alignItems: 'stretch', borderColor: colors.ink, borderWidth: 1.5, flexDirection: 'row', marginHorizontal: 20, minHeight: 98 },
  missionColor: { borderRightColor: colors.ink, borderRightWidth: 1.5, width: 14 },
  missionCopy: { flex: 1, gap: 3, padding: 13 },
  missionEyebrow: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.45 },
  missionTitle: { color: colors.ink, fontSize: 21, letterSpacing: -0.6 },
  missionPrompt: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  memberTabs: { gap: 8, paddingHorizontal: 20 },
  memberTab: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1, flexDirection: 'row', gap: 8, minWidth: 128, padding: 9 },
  memberTabSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  memberAvatar: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.ink, borderRadius: 999, borderWidth: 1, height: 29, justifyContent: 'center', width: 29 },
  memberAvatarSelected: { backgroundColor: colors.surface },
  memberInitial: { color: colors.ink, fontSize: 13 },
  memberInitialSelected: { color: colors.ink },
  memberName: { color: colors.ink, fontSize: 13 },
  memberNameSelected: { color: colors.surface },
  memberStatus: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 8, marginTop: 1 },
  memberStatusSelected: { color: colors.surfaceMuted },
  canvasHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  canvasLabel: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
  canvasCount: { color: colors.ink, fontFamily: 'monospace', fontSize: 12 },
  mosaicWrap: { paddingHorizontal: spacing[4] },
  state: { alignItems: 'center', gap: 10, justifyContent: 'center', minHeight: 180, paddingHorizontal: 28 },
  stateText: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  retry: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, gap: 4, marginHorizontal: 20, padding: 22 },
  retryTitle: { color: colors.ink, fontSize: 16 },
  retryText: { color: colors.textSecondary, fontSize: 13 },
  });
}
