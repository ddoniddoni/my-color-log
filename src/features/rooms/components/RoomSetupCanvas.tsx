import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { NinePhotoMosaic, type NinePhotoMosaicPhoto } from '@/src/components/ui/NinePhotoMosaic';
import { colors } from '@/src/design/tokens';
import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { createActiveRoomInvite, createRoom, endActiveRoom, getRoomInvitePreview, joinRoomByCode, leaveActiveRoom, revokeActiveRoomInvites, transferActiveRoomOwnership, updateActiveRoomSettings } from '@/src/features/rooms/api/roomRepository';
import { RoomManagementModal, type RoomManagementPendingAction } from '@/src/features/rooms/components/RoomManagementModal';
import { RoomMemberPhotoViewer } from '@/src/features/rooms/components/RoomMemberPhotoViewer';
import { useActiveRoom } from '@/src/features/rooms/hooks/useActiveRoom';
import { useActiveRoomTodayBoard } from '@/src/features/rooms/hooks/useActiveRoomTodayBoard';
import { type ActiveRoom, type RoomInvitePreview, validateInviteCode, validateRoomEmoji, validateRoomName } from '@/src/features/rooms/model/room';
import { getRoomPhotoMosaicSlots, type RoomBoardMember, type RoomBoardPhoto, type RoomTodayBoard } from '@/src/features/rooms/model/roomTodayBoard';
import { queryKeys } from '@/src/lib/query/queryKeys';
import { useKstDateKey } from '@/src/features/missions/hooks/useKstDateKey';

const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_DIGIT_IDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const;

export function RoomSetupCanvas() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const sessionState = useSessionBootstrap();
  const userId = sessionState.status === 'ready' ? sessionState.session?.user.id ?? null : null;
  const dateKey = useKstDateKey();
  const activeRoomQuery = useActiveRoom(userId);
  const roomTodayBoardQuery = useActiveRoomTodayBoard(userId, dateKey);
  const [inviteCode, setInviteCode] = useState<string[]>(() => Array.from({ length: INVITE_CODE_LENGTH }, () => ''));
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomEmoji, setRoomEmoji] = useState('');
  const [invitePreview, setInvitePreview] = useState<RoomInvitePreview | null>(null);
  const [isRoomManagementVisible, setIsRoomManagementVisible] = useState(false);
  const digitInputs = useRef<(TextInput | null)[]>([]);
  const bodyFont = fontsLoaded ? 'BricolageGrotesque_400Regular' : undefined;
  const boldFont = fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined;
  const heavyFont = fontsLoaded ? 'BricolageGrotesque_800ExtraBold' : undefined;

  const createRoomMutation = useMutation({
    mutationFn: () => {
      const nameValidation = validateRoomName(roomName);
      if (!nameValidation.isValid) throw new Error('room_name_invalid');
      const emojiValidation = validateRoomEmoji(roomEmoji);
      if (!emojiValidation.isValid) throw new Error('room_emoji_invalid');
      return createRoom(nameValidation.value, emojiValidation.value);
    },
    onSuccess: async () => {
      setIsCreateModalVisible(false);
      setRoomName('');
      setRoomEmoji('');
      if (userId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.activeRoom(userId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.activeRoomTodayBoard(userId, dateKey) }),
        ]);
      }
    },
  });

  const previewInviteMutation = useMutation({ mutationFn: (code: string) => getRoomInvitePreview(code) });
  const joinRoomMutation = useMutation({
    mutationFn: (code: string) => joinRoomByCode(code),
    onSuccess: async () => {
      setInvitePreview(null);
      setInviteCode(Array.from({ length: INVITE_CODE_LENGTH }, () => ''));
      if (userId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.activeRoom(userId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.activeRoomTodayBoard(userId, dateKey) }),
        ]);
      }
    },
  });
  const leaveRoomMutation = useMutation({
    mutationFn: leaveActiveRoom,
    onSuccess: async () => {
      setIsRoomManagementVisible(false);
      await invalidateActiveRoomData();
    },
  });
  const transferRoomOwnershipMutation = useMutation({
    mutationFn: transferActiveRoomOwnership,
    onSuccess: async () => {
      setIsRoomManagementVisible(false);
      await invalidateActiveRoomData();
    },
  });
  const endRoomMutation = useMutation({
    mutationFn: endActiveRoom,
    onSuccess: async () => {
      setIsRoomManagementVisible(false);
      await invalidateActiveRoomData();
    },
  });
  const updateRoomSettingsMutation = useMutation({
    mutationFn: ({ emoji, name }: { emoji: string | null; name: string }) => updateActiveRoomSettings(name, emoji),
    onSuccess: invalidateActiveRoomData,
  });
  const revokeRoomInvitesMutation = useMutation({
    mutationFn: revokeActiveRoomInvites,
    onSuccess: invalidateActiveRoomData,
  });
  const createRoomInviteMutation = useMutation({
    mutationFn: createActiveRoomInvite,
    onSuccess: invalidateActiveRoomData,
  });
  const pendingRoomAction: RoomManagementPendingAction | null = leaveRoomMutation.isPending
    ? 'leaving'
    : transferRoomOwnershipMutation.isPending
      ? 'transferring'
      : endRoomMutation.isPending
        ? 'ending'
        : updateRoomSettingsMutation.isPending
          ? 'updating_settings'
          : revokeRoomInvitesMutation.isPending
            ? 'revoking_invite'
            : createRoomInviteMutation.isPending
              ? 'reissuing_invite'
              : null;

  async function invalidateActiveRoomData(): Promise<void> {
    if (!userId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRoom(userId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRoomTodayBoard(userId, dateKey) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.activeRoomHistory(userId) }),
      queryClient.invalidateQueries({ queryKey: ['activeRoomHistoryBoard', userId] }),
    ]);
  }

  function handleDigitChange(index: number, value: string): void {
    const enteredDigits = value.replace(/\D/g, '').slice(0, INVITE_CODE_LENGTH - index);
    const nextCode = [...inviteCode];

    if (enteredDigits.length === 0) {
      nextCode[index] = '';
      setInviteCode(nextCode);
      return;
    }

    for (let offset = 0; offset < enteredDigits.length; offset += 1) {
      nextCode[index + offset] = enteredDigits[offset] ?? '';
    }

    setInviteCode(nextCode);
    const nextIndex = Math.min(index + enteredDigits.length, INVITE_CODE_LENGTH - 1);
    digitInputs.current[nextIndex]?.focus();
  }

  function handleDigitKeyPress(index: number, key: string): void {
    if (key === 'Backspace' && inviteCode[index] === '' && index > 0) {
      digitInputs.current[index - 1]?.focus();
    }
  }

  const handleCreateRoom = (): void => {
    const nameValidation = validateRoomName(roomName);
    if (!nameValidation.isValid) {
      Alert.alert('방 이름을 확인해 주세요', nameValidation.message);
      return;
    }
    const emojiValidation = validateRoomEmoji(roomEmoji);
    if (!emojiValidation.isValid) {
      Alert.alert('방 이모지를 확인해 주세요', emojiValidation.message);
      return;
    }
    createRoomMutation.mutate(undefined, { onError: (error) => Alert.alert('방을 만들지 못했어요', getRoomErrorMessage(error)) });
  };

  const handlePreviewInvite = (): void => {
    const code = inviteCode.join('');
    if (!validateInviteCode(code)) {
      Alert.alert('초대 코드를 확인해 주세요', '친구가 보낸 6자리 숫자를 모두 입력해 주세요.');
      return;
    }
    previewInviteMutation.mutate(code, {
      onError: (error) => Alert.alert('초대를 확인하지 못했어요', getRoomErrorMessage(error)),
      onSuccess: (preview) => {
        if (!preview) {
          Alert.alert('사용할 수 없는 초대예요', '코드가 만료됐거나 더 이상 입장할 수 없어요.');
          return;
        }
        setInvitePreview(preview);
      },
    });
  };

  const handleJoinRoom = (): void => {
    const code = inviteCode.join('');
    joinRoomMutation.mutate(code, { onError: (error) => Alert.alert('방에 참여하지 못했어요', getRoomErrorMessage(error)) });
  };

  if (sessionState.status === 'loading' || activeRoomQuery.isPending) {
    return <RoomStatusCanvas message="친구방을 확인하고 있어요." />;
  }

  if (sessionState.status === 'error' || !userId || activeRoomQuery.isError) {
    return <RoomStatusCanvas message="친구방을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요." />;
  }

  if (activeRoomQuery.data) {
    return (
      <>
        <ActiveRoomCanvas
          boldFont={boldFont}
          board={roomTodayBoardQuery.data ?? null}
          currentUserId={userId}
          dateKey={dateKey}
          heavyFont={heavyFont}
          isBoardError={roomTodayBoardQuery.isError}
          isBoardLoading={roomTodayBoardQuery.isPending}
          isBoardRefreshing={roomTodayBoardQuery.isFetching}
          onOpenManagement={() => setIsRoomManagementVisible(true)}
          onRefreshBoard={() => { void roomTodayBoardQuery.refetch(); }}
          room={activeRoomQuery.data}
          topInset={insets.top}
        />
        <RoomManagementModal
          currentUserId={userId}
          onClose={() => setIsRoomManagementVisible(false)}
          onEnd={() => endRoomMutation.mutate(undefined, { onError: (error) => Alert.alert('방을 종료하지 못했어요', getRoomErrorMessage(error)) })}
          onLeave={() => leaveRoomMutation.mutate(undefined, { onError: (error) => Alert.alert('방에서 나가지 못했어요', getRoomErrorMessage(error)) })}
          onReissueInvite={() => createRoomInviteMutation.mutate(undefined, { onError: (error) => Alert.alert('새 초대 코드를 만들지 못했어요', getRoomErrorMessage(error)) })}
          onRevokeInvite={() => revokeRoomInvitesMutation.mutate(undefined, { onError: (error) => Alert.alert('초대 코드를 취소하지 못했어요', getRoomErrorMessage(error)) })}
          onTransfer={(newOwnerId) => transferRoomOwnershipMutation.mutate(newOwnerId, { onError: (error) => Alert.alert('방장을 넘기지 못했어요', getRoomErrorMessage(error)) })}
          onUpdateSettings={(name, emoji) => updateRoomSettingsMutation.mutate({ emoji, name }, { onError: (error) => Alert.alert('방 정보를 저장하지 못했어요', getRoomErrorMessage(error)) })}
          pendingAction={pendingRoomAction}
          room={activeRoomQuery.data}
          visible={isRoomManagementVisible}
        />
      </>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.appBarShadow}>
        <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <View accessibilityLabel="기록 아이콘" accessibilityRole="image" style={styles.appBarIcon}>
            <PencilIcon />
          </View>
          <AppText style={[styles.brand, { fontFamily: heavyFont }]}>Oneul-Bit</AppText>
          <View accessibilityLabel="설정은 준비 중이에요" accessibilityRole="image" style={styles.appBarIcon}>
            <GearIcon />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <AppText style={[styles.title, { fontFamily: heavyFont }]}>함께 그려볼까요?</AppText>
          <AppText style={[styles.subtitle, { fontFamily: bodyFont }]}>새로운 비공개 캔버스를 만들거나, 친구가 보낸 초대 코드로 들어가 보세요.</AppText>
        </View>

        <View style={styles.cards}>
          <RoomActionCard
            bodyFont={bodyFont}
            boldFont={boldFont}
            caption="START FRESH"
            description="나만의 비공개 방을 열고, 친구들과 매일의 색을 함께 모아 보세요."
            icon={<KeyIcon />}
            onPress={() => setIsCreateModalVisible(true)}
            title="새 친구방 만들기"
            variant="light"
          />

          <JoinRoomCard
            bodyFont={bodyFont}
            boldFont={boldFont}
            code={inviteCode}
            digitInputs={digitInputs}
            onDigitChange={handleDigitChange}
            onDigitKeyPress={handleDigitKeyPress}
            onJoin={handlePreviewInvite}
            isJoining={previewInviteMutation.isPending}
          />
        </View>

        <View style={styles.recentSection}>
          <View style={styles.recentHeading}>
            <HistoryIcon />
            <AppText style={styles.recentLabel}>RECENTLY VISITED</AppText>
          </View>
          <View accessibilityLabel="최근에 방문한 친구방이 없어요" style={styles.recentEmpty}>
            <View style={styles.recentEmptyIcon}><PaletteIcon /></View>
            <View style={styles.recentEmptyCopy}>
              <AppText style={[styles.recentEmptyTitle, { fontFamily: boldFont }]}>최근에 방문한 방이 없어요</AppText>
              <AppText style={[styles.recentEmptyDescription, { fontFamily: bodyFont }]}>참여한 친구방은 이곳에서 다시 열 수 있어요.</AppText>
            </View>
          </View>
        </View>
      </ScrollView>

      <CreateRoomModal
        emoji={roomEmoji}
        isPending={createRoomMutation.isPending}
        onClose={() => !createRoomMutation.isPending && setIsCreateModalVisible(false)}
        onCreate={handleCreateRoom}
        onEmojiChange={setRoomEmoji}
        onNameChange={setRoomName}
        roomName={roomName}
        visible={isCreateModalVisible}
      />
      <JoinRoomModal
        isPending={joinRoomMutation.isPending}
        onClose={() => !joinRoomMutation.isPending && setInvitePreview(null)}
        onJoin={handleJoinRoom}
        preview={invitePreview}
      />
    </View>
  );
}

type RoomActionCardProps = {
  bodyFont: string | undefined;
  boldFont: string | undefined;
  caption: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
  title: string;
  variant: 'light';
};

function RoomActionCard({ bodyFont, boldFont, caption, description, icon, onPress, title }: RoomActionCardProps) {
  return (
    <View style={styles.cardShadow}>
      <View style={styles.card}>
        <View style={styles.cardTopline}>
          <View accessibilityRole="image" style={[styles.actionIcon, styles.actionIconTiltLeft]}>{icon}</View>
          <AppText style={styles.cardCaption}>{caption}</AppText>
        </View>
        <AppText style={[styles.cardTitle, { fontFamily: boldFont }]}>{title}</AppText>
        <AppText style={[styles.cardDescription, { fontFamily: bodyFont }]}>{description}</AppText>
        <HardShadowButton accessibilityLabel="친구방 만들기, 준비 중" label="방 만들기" onPress={onPress} tone="light" />
        <View pointerEvents="none" style={styles.sparkle}><SparkleIcon /></View>
      </View>
    </View>
  );
}

type JoinRoomCardProps = {
  bodyFont: string | undefined;
  boldFont: string | undefined;
  code: string[];
  digitInputs: React.MutableRefObject<(TextInput | null)[]>;
  onDigitChange: (index: number, value: string) => void;
  onDigitKeyPress: (index: number, key: string) => void;
  onJoin: () => void;
  isJoining: boolean;
};

function JoinRoomCard({ bodyFont, boldFont, code, digitInputs, isJoining, onDigitChange, onDigitKeyPress, onJoin }: JoinRoomCardProps) {
  return (
    <View style={styles.cardShadow}>
      <View style={styles.card}>
        <View style={styles.cardTopline}>
          <View accessibilityRole="image" style={[styles.actionIcon, styles.actionIconTiltRight]}><DoorIcon /></View>
          <AppText style={[styles.cardCaption, styles.cardCaptionTilt]}>HAVE A CODE?</AppText>
        </View>
        <AppText style={[styles.cardTitle, { fontFamily: boldFont }]}>초대 코드로 참여하기</AppText>
        <AppText style={[styles.cardDescription, { fontFamily: bodyFont }]}>친구가 공유한 6자리 비밀 코드를 입력하면 같은 방에 들어갈 수 있어요.</AppText>
        <View style={styles.codeInputs}>
          {code.map((digit, index) => (
            <TextInput
              key={INVITE_CODE_DIGIT_IDS[index]}
              ref={(input) => { digitInputs.current[index] = input; }}
              accessibilityLabel={`초대 코드 ${index + 1}번째 숫자`}
              keyboardType="number-pad"
              maxLength={INVITE_CODE_LENGTH}
              onChangeText={(value) => onDigitChange(index, value)}
              onKeyPress={({ nativeEvent }) => onDigitKeyPress(index, nativeEvent.key)}
              placeholder="0"
              placeholderTextColor="rgba(0, 0, 0, 0.2)"
              style={styles.codeInput}
              value={digit}
            />
          ))}
        </View>
        <HardShadowButton accessibilityLabel="친구방 입장하기" disabled={isJoining} label={isJoining ? '초대 확인 중' : '방 입장하기'} onPress={onJoin} tone="dark" />
        <View pointerEvents="none" style={styles.wavyUnderline}><WavyLine /></View>
      </View>
    </View>
  );
}

function HardShadowButton({ accessibilityLabel, disabled = false, label, onPress, tone }: { accessibilityLabel: string; disabled?: boolean; label: string; onPress: () => void; tone: 'light' | 'dark' }) {
  return (
    <View style={styles.buttonShadow}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.button, tone === 'dark' ? styles.darkButton : styles.lightButton, disabled && styles.buttonDisabled, pressed && styles.buttonPressed]}>
        <AppText style={[styles.buttonLabel, tone === 'dark' && styles.darkButtonLabel]}>{label}</AppText>
        {tone === 'dark' ? <LoginIcon color={colors.white} /> : <ArrowIcon />}
      </Pressable>
    </View>
  );
}

function RoomStatusCanvas({ message }: { message: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.statusPage}>
      <ActivityIndicator color={colors.black} />
      <AppText style={styles.statusText}>{message}</AppText>
    </View>
  );
}

type ActiveRoomCanvasProps = {
  boldFont: string | undefined;
  board: RoomTodayBoard | null;
  currentUserId: string;
  dateKey: string;
  heavyFont: string | undefined;
  isBoardError: boolean;
  isBoardLoading: boolean;
  isBoardRefreshing: boolean;
  onOpenManagement: () => void;
  onRefreshBoard: () => void;
  room: ActiveRoom;
  topInset: number;
};

function ActiveRoomCanvas({ boldFont, board, currentUserId, dateKey, heavyFont, isBoardError, isBoardLoading, isBoardRefreshing, onOpenManagement, onRefreshBoard, room, topInset }: ActiveRoomCanvasProps) {
  const remainingSeats = room.maxMembers - room.members.length;
  const formattedDate = dateKey.replaceAll('-', '.');

  const showInviteCode = (): void => {
    if (!room.inviteCode) {
      Alert.alert('초대 준비 중', '새 초대 코드를 준비하지 못했어요. 잠시 뒤 다시 열어 주세요.');
      return;
    }

    Alert.alert(
      '우리 방 초대 코드',
      `${room.inviteCode}\n\n이 코드는 24시간 동안 사용할 수 있어요. 남은 ${remainingSeats}자리까지 함께할 수 있어요.`,
    );
  };

  return (
    <View style={styles.page}>
      <View style={[styles.roomTopBar, { paddingTop: Math.max(topInset, 8) }]}>
        <View style={styles.roomDateGroup}>
          <View accessibilityLabel="우리 방 아이콘" accessibilityRole="image" style={styles.roomMark}>
            <AppText style={[styles.roomMarkText, { fontFamily: boldFont }]}>{room.emoji ?? room.name.slice(0, 1)}</AppText>
          </View>
          <AppText style={[styles.roomDate, { fontFamily: boldFont }]}>{formattedDate}</AppText>
        </View>
        <Pressable accessibilityLabel="친구방 관리 열기" accessibilityRole="button" onPress={onOpenManagement} style={styles.roomSettingsMark}><GearIcon /></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.activeRoomContent} showsVerticalScrollIndicator={false}>
        <View style={styles.roomBannerWrap}>
          <View style={styles.roomBanner}>
            <AppText numberOfLines={1} style={[styles.roomBannerTitle, { fontFamily: heavyFont }]}>{room.emoji ? `${room.emoji} ${room.name}` : room.name}</AppText>
          </View>
        </View>

        <RoomTodayBoardSection
          board={board}
          boldFont={boldFont}
          currentUserId={currentUserId}
          isError={isBoardError}
          isLoading={isBoardLoading}
          isRefreshing={isBoardRefreshing}
          onInvite={showInviteCode}
          onRetry={onRefreshBoard}
        />
      </ScrollView>
    </View>
  );
}

type RoomTodayBoardSectionProps = {
  board: RoomTodayBoard | null;
  boldFont: string | undefined;
  currentUserId: string;
  isError: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  onInvite: () => void;
  onRetry: () => void;
};

type RoomBoardPhotoSelection = {
  memberId: string;
  photoId: string;
};

function RoomTodayBoardSection({ board, boldFont, currentUserId, isError, isLoading, isRefreshing, onInvite, onRetry }: RoomTodayBoardSectionProps) {
  const router = useRouter();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [photoSelection, setPhotoSelection] = useState<RoomBoardPhotoSelection | null>(null);
  const selectedMember = board?.members.find((member) => member.id === selectedMemberId)
    ?? board?.members.find((member) => member.id === currentUserId)
    ?? board?.members[0]
    ?? null;
  const selectedPhotoMember = board?.members.find((member) => member.id === photoSelection?.memberId) ?? null;
  const captureSlot = selectedMember?.id === currentUserId
    ? getRoomPhotoMosaicSlots(selectedMember).find((slot) => slot.photo === null) ?? null
    : null;

  const openCamera = (): void => {
    if (!board || !captureSlot) return;
    router.push({
      pathname: '/camera',
      params: {
        colorNameEn: board.mission.colorNameEn,
        dateKey: board.dateKey,
        missionId: board.mission.id,
        position: String(captureSlot.position),
      },
    });
  };

  const showRules = (): void => {
    if (!board) return;
    Alert.alert(
      `오늘의 ${board.mission.colorNameKo}`,
      `${board.mission.promptKo}\n\n사진은 내 다이어리에 먼저 저장되고, 우리 방에서는 함께 볼 수 있어요.`,
    );
  };

  return (
    <>
      <View style={styles.boardSection}>
        {isLoading ? <View accessibilityLiveRegion="polite" style={styles.boardState}><ActivityIndicator color={colors.black} /><AppText style={styles.boardStateText}>오늘의 캔버스를 준비하고 있어요.</AppText></View> : null}
        {isError ? <Pressable accessibilityLabel="친구방 사진 보드 다시 불러오기" accessibilityRole="button" onPress={onRetry} style={styles.boardRetry}><AppText style={styles.boardRetryTitle}>캔버스를 불러오지 못했어요.</AppText><AppText style={styles.boardRetryText}>눌러서 다시 시도해 주세요.</AppText></Pressable> : null}
        {!isLoading && !isError && board ? (
          <>
            <View accessibilityLabel="친구방 멤버 탭" style={styles.boardTabs}>
              {board.members.map((member) => {
                const isSelected = member.id === selectedMember?.id;
                return (
                  <Pressable
                    accessibilityLabel={`${member.nickname} 사진 보드 탭`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    key={member.id}
                    onPress={() => setSelectedMemberId(member.id)}
                    style={[styles.boardTab, isSelected && styles.boardTabSelected]}>
                    <View style={[styles.boardTabAvatar, isSelected && styles.boardTabAvatarSelected]}><AppText style={[styles.boardTabInitial, { fontFamily: boldFont }, isSelected && styles.boardTabInitialSelected]}>{member.nickname.slice(0, 1)}</AppText></View>
                    <View style={styles.boardTabCopy}>
                      <AppText numberOfLines={1} style={[styles.boardTabName, { fontFamily: boldFont }, isSelected && styles.boardTabNameSelected]}>{member.nickname}</AppText>
                      <AppText style={[styles.boardTabStatus, isSelected && styles.boardTabStatusSelected]}>{isSelected ? 'ACTIVE NOW' : member.photos.length === 0 ? 'FINDING COLOR' : `${member.photos.length} PHOTOS`}</AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.canvasToolbar}>
              <AppText style={styles.canvasLabel}>SHARED CANVAS</AppText>
              <View style={styles.canvasActions}>
                <Pressable accessibilityLabel="우리 방 초대 코드 보기" accessibilityRole="button" onPress={onInvite} style={styles.canvasActionButton}>
                  <PersonAddIcon />
                  <AppText style={styles.canvasActionLabel}>Invite</AppText>
                </Pressable>
                <Pressable accessibilityLabel="오늘의 미션 규칙 보기" accessibilityRole="button" onPress={showRules} style={styles.canvasActionButton}>
                  <TuneIcon />
                  <AppText style={styles.canvasActionLabel}>Rules</AppText>
                </Pressable>
                <Pressable accessibilityLabel="친구방 지난 기록 보기" accessibilityRole="button" onPress={() => router.push('/room-history')} style={styles.canvasActionButton}>
                  <HistoryIcon />
                  <AppText style={styles.canvasActionLabel}>History</AppText>
                </Pressable>
              </View>
            </View>
            {selectedMember ? <RoomMemberMosaic member={selectedMember} onCapture={captureSlot ? openCamera : null} onOpenPhoto={(photo) => setPhotoSelection({ memberId: selectedMember.id, photoId: photo.id })} /> : null}
          </>
        ) : null}
        {!isLoading && !isError && board === null ? <View style={styles.boardState}><PaletteIcon /><AppText style={styles.boardStateText}>방에 참여하면 오늘의 사진 보드가 여기에 보여요.</AppText></View> : null}
      </View>
      <RoomMemberPhotoViewer
        initialPhotoId={photoSelection?.photoId ?? null}
        key={photoSelection ? `${photoSelection.memberId}:${photoSelection.photoId}` : 'closed'}
        member={selectedPhotoMember}
        mission={board?.mission ?? null}
        onClose={() => setPhotoSelection(null)}
      />
    </>
  );
}

function RoomMemberMosaic({ member, onCapture, onOpenPhoto }: { member: RoomBoardMember; onCapture: (() => void) | null; onOpenPhoto: (photo: RoomBoardPhoto) => void }) {
  const photos: NinePhotoMosaicPhoto[] = member.photos.flatMap((photo) => (
    photo.signedUrl ? [{ capturedAt: photo.capturedAt, id: photo.id, position: photo.position, uri: photo.signedUrl }] : []
  ));
  return (
    <NinePhotoMosaic
      accessibilityLabel={`${member.nickname}의 오늘 사진 ${photos.length}장, 9칸 기록판`}
      onEmptyPress={onCapture ?? undefined}
      onPhotoPress={(photo) => {
        const roomPhoto = member.photos.find((candidate) => candidate.id === photo.id);
        if (roomPhoto) onOpenPhoto(roomPhoto);
      }}
      photos={photos}
    />
  );
}

function CreateRoomModal({ emoji, isPending, onClose, onCreate, onEmojiChange, onNameChange, roomName, visible }: {
  emoji: string;
  isPending: boolean;
  onClose: () => void;
  onCreate: () => void;
  onEmojiChange: (value: string) => void;
  onNameChange: (value: string) => void;
  roomName: string;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalOverlay}>
        <Pressable accessibilityLabel="방 만들기 닫기" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.modalCard}>
          <AppText style={styles.modalEyebrow}>NEW PRIVATE ROOM</AppText>
          <AppText style={styles.modalTitle}>친구방 만들기</AppText>
          <AppText style={styles.modalDescription}>2~6명이 함께하는 비공개 방이에요. 사진 원본은 언제나 내 다이어리에 남아요.</AppText>
          <AppText style={styles.inputLabel}>방 이름</AppText>
          <TextInput accessibilityLabel="방 이름" autoFocus maxLength={20} onChangeText={onNameChange} placeholder="예: 퇴근길 색수집단" placeholderTextColor="rgba(0, 0, 0, 0.32)" style={styles.modalInput} value={roomName} />
          <AppText style={styles.inputLabel}>표시 이모지 (선택)</AppText>
          <TextInput accessibilityLabel="방 표시 이모지" maxLength={8} onChangeText={onEmojiChange} placeholder="🎨" placeholderTextColor="rgba(0, 0, 0, 0.32)" style={styles.modalInput} value={emoji} />
          <View style={styles.modalActions}>
            <Pressable accessibilityRole="button" disabled={isPending} onPress={onClose} style={styles.modalSecondaryButton}><AppText style={styles.modalSecondaryText}>취소</AppText></Pressable>
            <Pressable accessibilityRole="button" disabled={isPending} onPress={onCreate} style={[styles.modalPrimaryButton, isPending && styles.modalButtonDisabled]}><AppText style={styles.modalPrimaryText}>{isPending ? '만드는 중' : '방 만들기'}</AppText></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function JoinRoomModal({ isPending, onClose, onJoin, preview }: { isPending: boolean; onClose: () => void; onJoin: () => void; preview: RoomInvitePreview | null }) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={preview !== null}>
      <View style={styles.modalOverlay}>
        <Pressable accessibilityLabel="친구방 참여 닫기" onPress={onClose} style={StyleSheet.absoluteFill} />
        {preview ? <View accessibilityViewIsModal style={styles.modalCard}>
          <AppText style={styles.modalEyebrow}>PRIVATE INVITATION</AppText>
          <AppText style={styles.modalTitle}>{preview.roomEmoji ? `${preview.roomEmoji} ${preview.roomName}` : preview.roomName}</AppText>
          <AppText style={styles.modalDescription}>{preview.ownerNickname} 님의 방 · 현재 {preview.memberCount}/{preview.maxMembers}명</AppText>
          <View style={styles.privacyNotice}><AppText style={styles.privacyNoticeTitle}>참여 전에 확인해 주세요</AppText><AppText style={styles.privacyNoticeText}>참여하면 이 방의 멤버에게 내 오늘 기록이 함께 보여요. 내 다이어리 원본은 그대로 유지돼요.</AppText></View>
          <View style={styles.modalActions}>
            <Pressable accessibilityRole="button" disabled={isPending} onPress={onClose} style={styles.modalSecondaryButton}><AppText style={styles.modalSecondaryText}>다음에</AppText></Pressable>
            <Pressable accessibilityRole="button" disabled={isPending} onPress={onJoin} style={[styles.modalPrimaryButton, isPending && styles.modalButtonDisabled]}><AppText style={styles.modalPrimaryText}>{isPending ? '참여 중' : '이 방에 참여'}</AppText></Pressable>
          </View>
        </View> : null}
      </View>
    </Modal>
  );
}

function getRoomErrorMessage(error: Error): string {
  if (error.message === 'room_name_invalid') return '방 이름은 2~20자로 입력해 주세요.';
  if (error.message === 'room_request_signature_failed') return '방 만들기 요청을 새로고침하는 중이에요. 앱을 다시 열고 한 번 더 시도해 주세요.';
  if (error.message === 'authentication_required') return '로그인 정보를 확인하지 못했어요. 다시 로그인한 뒤 시도해 주세요.';
  if (error.message === 'room_name_invalid') return '방 이름은 2~20자로 입력해 주세요.';
  if (error.message === 'room_emoji_invalid') return '방 이모지는 8자 이하로 입력해 주세요.';
  if (error.message === 'active_room_already_exists') return '이미 참여 중인 친구방이 있어요. MVP에서는 한 개의 활성 친구방만 참여할 수 있어요.';
  if (error.message === 'room_invite_not_available') return '초대가 만료됐거나 사용 가능 횟수가 끝났어요.';
  if (error.message === 'room_invite_cannot_join_self') return '내가 만든 초대 코드로는 참여할 수 없어요.';
  if (error.message === 'room_member_limit_reached') return '이 방은 이미 6명으로 가득 찼어요.';
  return '연결을 확인한 뒤 다시 시도해 주세요.';
}


function PencilIcon() {
  return <Svg height={22} viewBox="0 0 24 24" width={22}><Path d="m5 19 3.3-.7L19 7.6 16.4 5 5.7 15.7 5 19Z" fill="none" stroke={colors.black} strokeLinejoin="round" strokeWidth={1.8} /><Path d="m15.7 5.7 2.6 2.6" fill="none" stroke={colors.black} strokeLinecap="round" strokeWidth={1.8} /></Svg>;
}

function GearIcon() {
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Circle cx={12} cy={12} fill="none" r={3} stroke={colors.black} strokeWidth={1.7} /><Path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2m14.5-6.5-1.4 1.4M7 17l-1.4 1.4m0-12.8L7 7m9.6 9.6 1.4 1.4" fill="none" stroke={colors.black} strokeLinecap="round" strokeWidth={1.7} /></Svg>;
}

function KeyIcon() {
  return <Svg height={48} viewBox="0 0 48 48" width={48}><Circle cx={17} cy={19} fill="none" r={8} stroke={colors.black} strokeWidth={2} /><Path d="m23 25 14 14m-5-5 3-3m-7-2 3-3" fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

function DoorIcon() {
  return <Svg height={48} viewBox="0 0 48 48" width={48}><Path d="M12 39V10l21-3v32M12 39h24M17 14v25m0-20 11-1v21" fill="none" stroke={colors.black} strokeLinejoin="round" strokeWidth={2} /><Circle cx={25.5} cy={28} fill={colors.black} r={1.5} /></Svg>;
}

function SparkleIcon() {
  return <Svg height={42} viewBox="0 0 48 48" width={42}><Path d="M24 4c1.7 11 8.6 17.8 20 20-11.4 2.1-18.3 9-20 20-2-11-8.7-17.9-20-20C15.3 21.8 22 15 24 4Z" fill="none" stroke={colors.black} strokeLinejoin="round" strokeWidth={2.2} /></Svg>;
}

function ArrowIcon() {
  return <Svg height={22} viewBox="0 0 24 24" width={22}><Path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} /></Svg>;
}

function LoginIcon({ color }: { color: string }) {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="M11 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H11m2-4 4-3-4-3m4 3H9" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

function HistoryIcon() {
  return <Svg height={18} viewBox="0 0 24 24" width={18}><Path d="M4.8 7.5V4.8m0 2.7h2.7m-2.7 0a8 8 0 1 1-1 7.6M12 8v4.2l2.9 1.8" fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} /></Svg>;
}

function PaletteIcon() {
  return <Svg height={23} viewBox="0 0 24 24" width={23}><Path d="M12 3.8a8.6 8.6 0 0 0 0 17.2h1.7a1.7 1.7 0 0 0 0-3.4h-.3a1.2 1.2 0 0 1 0-2.4h1.1A5.7 5.7 0 0 0 12 3.8Z" fill="none" stroke={colors.black} strokeLinejoin="round" strokeWidth={1.5} /><Circle cx={8.2} cy={10.2} fill={colors.black} r={1} /><Circle cx={12} cy={7.6} fill={colors.black} r={1} /><Circle cx={15.7} cy={10.2} fill={colors.black} r={1} /></Svg>;
}

function PersonAddIcon() {
  return <Svg height={16} viewBox="0 0 24 24" width={16}><Circle cx={9} cy={8} fill="none" r={3} stroke={colors.black} strokeWidth={1.7} /><Path d="M3.8 19c.4-3 2.1-4.7 5.2-4.7s4.8 1.7 5.2 4.7m1.5-10.5h5m-2.5-2.5v5" fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} /></Svg>;
}

function TuneIcon() {
  return <Svg height={16} viewBox="0 0 24 24" width={16}><Path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke={colors.black} strokeLinecap="round" strokeWidth={1.7} /><Circle cx={9} cy={7} fill={colors.white} r={2} stroke={colors.black} strokeWidth={1.5} /><Circle cx={15} cy={12} fill={colors.white} r={2} stroke={colors.black} strokeWidth={1.5} /><Circle cx={11} cy={17} fill={colors.white} r={2} stroke={colors.black} strokeWidth={1.5} /></Svg>;
}

function WavyLine() {
  return <Svg height={26} preserveAspectRatio="none" viewBox="0 0 200 20" width="100%"><Path d="M0 10Q50 0 100 10T200 10" fill="none" stroke={colors.black} strokeLinecap="round" strokeWidth={4} /></Svg>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.white, flex: 1 },
  statusPage: { alignItems: 'center', backgroundColor: colors.white, flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  statusText: { color: 'rgba(0, 0, 0, 0.62)', fontSize: 14, textAlign: 'center' },
  appBarShadow: { backgroundColor: colors.black, paddingBottom: 4 },
  appBar: { alignItems: 'center', backgroundColor: colors.white, borderBottomColor: colors.black, borderBottomWidth: 3, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingBottom: 8, paddingHorizontal: 16 },
  appBarIcon: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  brand: { color: colors.black, fontSize: 25, fontWeight: '800', letterSpacing: -1.1, lineHeight: 30, transform: [{ rotate: '-2deg' }] },
  content: { gap: 40, paddingBottom: 138, paddingHorizontal: 16, paddingTop: 40 },
  intro: { gap: 8 },
  title: { color: colors.black, fontSize: 32, fontWeight: '800', letterSpacing: -1.2, lineHeight: 38 },
  subtitle: { color: 'rgba(0, 0, 0, 0.6)', fontSize: 17, lineHeight: 27 },
  cards: { gap: 24 },
  cardShadow: { backgroundColor: colors.black, paddingBottom: 8, paddingRight: 8 },
  card: { backgroundColor: colors.white, borderColor: colors.black, borderWidth: 3, minHeight: 284, overflow: 'visible', padding: 24, position: 'relative' },
  cardTopline: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  actionIcon: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.black, borderRadius: 999, borderWidth: 2, height: 66, justifyContent: 'center', width: 66 },
  actionIconTiltLeft: { transform: [{ rotate: '-6deg' }] },
  actionIconTiltRight: { transform: [{ rotate: '6deg' }] },
  cardCaption: { borderColor: colors.black, borderWidth: 1, color: colors.black, fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.25, lineHeight: 13, paddingHorizontal: 8, paddingVertical: 2, transform: [{ rotate: '3deg' }] },
  cardCaptionTilt: { transform: [{ rotate: '-2deg' }] },
  cardTitle: { color: colors.black, fontSize: 23, fontWeight: '700', letterSpacing: -0.65, lineHeight: 30, marginBottom: 8 },
  cardDescription: { color: colors.black, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  buttonShadow: { backgroundColor: colors.black, paddingBottom: 4, paddingRight: 4 },
  button: { alignItems: 'center', borderColor: colors.black, borderWidth: 3, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 55, paddingHorizontal: 24, paddingVertical: 12 },
  lightButton: { backgroundColor: colors.white },
  darkButton: { backgroundColor: colors.black },
  buttonPressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  buttonDisabled: { opacity: 0.55 },
  buttonLabel: { color: colors.black, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 21, fontWeight: '700', letterSpacing: -0.5, lineHeight: 26 },
  darkButtonLabel: { color: colors.white },
  sparkle: { bottom: -26, opacity: 0.3, position: 'absolute', right: -25, transform: [{ rotate: '12deg' }] },
  codeInputs: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  codeInput: { borderBottomColor: colors.black, borderBottomWidth: 3, color: colors.black, flex: 1, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 22, fontWeight: '700', height: 42, lineHeight: 26, paddingHorizontal: 0, paddingVertical: 0, textAlign: 'center', textAlignVertical: 'center' },
  wavyUnderline: { bottom: -33, height: 28, left: '12%', opacity: 0.1, position: 'absolute', width: '76%' },
  recentSection: { gap: 16 },
  recentHeading: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  recentLabel: { color: colors.black, fontFamily: 'monospace', fontSize: 11, fontWeight: '500', letterSpacing: 1.5, lineHeight: 14 },
  recentEmpty: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.black, borderWidth: 2, flexDirection: 'row', gap: 16, minHeight: 78, padding: 16 },
  recentEmptyIcon: { alignItems: 'center', borderColor: colors.black, borderRadius: 999, borderWidth: 2, height: 40, justifyContent: 'center', transform: [{ rotate: '-3deg' }], width: 40 },
  recentEmptyCopy: { flex: 1, gap: 2 },
  recentEmptyTitle: { color: colors.black, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  recentEmptyDescription: { color: 'rgba(0, 0, 0, 0.6)', fontSize: 10, lineHeight: 14 },
  roomTopBar: { alignItems: 'center', backgroundColor: '#F9F9F9', flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, paddingBottom: 8, paddingHorizontal: 16 },
  roomDateGroup: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  roomMark: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.black, borderRadius: 20, borderWidth: 2, height: 40, justifyContent: 'center', overflow: 'hidden', width: 40 },
  roomMarkText: { color: colors.black, fontSize: 18, fontWeight: '700' },
  roomDate: { color: colors.black, fontSize: 19, fontWeight: '700', letterSpacing: -0.35, lineHeight: 24 },
  roomSettingsMark: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  activeRoomContent: { gap: 40, paddingBottom: 40, paddingHorizontal: 16, paddingTop: 24 },
  roomBannerWrap: { alignItems: 'center' },
  roomBanner: { backgroundColor: colors.white, borderColor: colors.black, borderWidth: 2.5, maxWidth: '100%', paddingHorizontal: 26, paddingVertical: 13, transform: [{ rotate: '-1deg' }] },
  roomBannerTitle: { color: colors.black, fontSize: 28, fontWeight: '800', letterSpacing: -0.9, lineHeight: 33, maxWidth: 300, textAlign: 'center' },
  boardSection: { gap: 24 },
  boardState: { alignItems: 'center', backgroundColor: '#F7F7F5', borderColor: colors.black, borderStyle: 'dashed', borderWidth: 1.5, flexDirection: 'row', gap: 10, minHeight: 82, padding: 16 },
  boardStateText: { color: 'rgba(0, 0, 0, 0.64)', flex: 1, fontSize: 12, lineHeight: 18 },
  boardRetry: { backgroundColor: '#FFF4D7', borderColor: colors.black, borderWidth: 1.5, gap: 4, padding: 16 },
  boardRetryTitle: { color: colors.black, fontSize: 14, fontWeight: '700' },
  boardRetryText: { color: 'rgba(0, 0, 0, 0.64)', fontSize: 12 },
  boardTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'center', marginBottom: 16 },
  boardTab: { alignItems: 'center', flexDirection: 'row', gap: 9, minHeight: 48, minWidth: 108, paddingHorizontal: 2, paddingVertical: 2 },
  boardTabSelected: { transform: [{ translateY: -1 }] },
  boardTabAvatar: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.black, borderRadius: 24, borderWidth: 2, height: 48, justifyContent: 'center', width: 48 },
  boardTabAvatarSelected: { backgroundColor: colors.black, borderWidth: 3 },
  boardTabInitial: { color: colors.black, fontSize: 17, fontWeight: '700' },
  boardTabInitialSelected: { color: colors.white },
  boardTabCopy: { flexShrink: 1, gap: 1 },
  boardTabName: { color: colors.black, fontSize: 16, fontWeight: '700', lineHeight: 20 },
  boardTabNameSelected: { textDecorationLine: 'underline', textDecorationStyle: 'solid' },
  boardTabStatus: { color: 'rgba(0, 0, 0, 0.58)', fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.3, lineHeight: 11 },
  boardTabStatusSelected: { color: colors.black },
  canvasToolbar: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  canvasLabel: { borderBottomColor: colors.black, borderBottomWidth: 2, color: colors.black, fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.8, paddingBottom: 4 },
  canvasActions: { flexDirection: 'row', gap: 8 },
  canvasActionButton: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.black, borderWidth: 1.5, flexDirection: 'row', gap: 5, minHeight: 40, paddingHorizontal: 10, paddingVertical: 7 },
  canvasActionLabel: { color: colors.black, fontFamily: 'monospace', fontSize: 10, lineHeight: 13 },
  modalOverlay: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.42)', flex: 1, justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#F9F9F9', borderColor: colors.black, borderWidth: 2, gap: 10, maxWidth: 380, padding: 22, width: '100%' },
  modalEyebrow: { color: 'rgba(0, 0, 0, 0.62)', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
  modalTitle: { color: colors.black, fontSize: 25, fontWeight: '800', letterSpacing: -0.7, lineHeight: 32 },
  modalDescription: { color: 'rgba(0, 0, 0, 0.68)', fontSize: 14, lineHeight: 21, marginBottom: 6 },
  inputLabel: { color: colors.black, fontFamily: 'monospace', fontSize: 11, marginTop: 5 },
  modalInput: { backgroundColor: colors.white, borderColor: colors.black, borderWidth: 1.5, color: colors.black, fontSize: 16, minHeight: 48, paddingHorizontal: 12 },
  modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 12 },
  modalSecondaryButton: { alignItems: 'center', borderColor: colors.black, borderWidth: 1.5, justifyContent: 'center', minHeight: 46, paddingHorizontal: 15 },
  modalSecondaryText: { color: colors.black, fontSize: 14, fontWeight: '700' },
  modalPrimaryButton: { alignItems: 'center', backgroundColor: colors.black, justifyContent: 'center', minHeight: 46, paddingHorizontal: 15 },
  modalPrimaryText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  modalButtonDisabled: { opacity: 0.54 },
  privacyNotice: { backgroundColor: '#FFF4D7', borderColor: '#B7892C', borderWidth: 1, gap: 5, marginTop: 4, padding: 12 },
  privacyNoticeTitle: { color: colors.black, fontSize: 13, fontWeight: '700' },
  privacyNoticeText: { color: colors.black, fontSize: 12, lineHeight: 18 },
});
