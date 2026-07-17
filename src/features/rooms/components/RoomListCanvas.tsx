import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

import { AppText } from '@/src/components/ui/AppText';
import { colors, spacing } from '@/src/design/tokens';
import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { createRoom, getRoomInvitePreview, joinRoomByCode } from '@/src/features/rooms/api/roomRepository';
import { CreateRoomModal, JoinRoomModal } from '@/src/features/rooms/components/RoomSetupCanvas';
import { useMyRooms } from '@/src/features/rooms/hooks/useActiveRoom';
import { type ActiveRoom, type RoomInvitePreview, validateInviteCode, validateRoomEmoji, validateRoomName } from '@/src/features/rooms/model/room';
import { getRoomErrorMessage } from '@/src/features/rooms/model/roomErrors';
import { queryKeys } from '@/src/lib/query/queryKeys';

const MAX_ACTIVE_ROOMS = 3;

export function RoomListCanvas() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessionState = useSessionBootstrap();
  const userId = sessionState.status === 'ready' ? sessionState.session?.user.id ?? null : null;
  const roomsQuery = useMyRooms(userId);
  const [isCreateVisible, setIsCreateVisible] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomEmoji, setRoomEmoji] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [invitePreview, setInvitePreview] = useState<RoomInvitePreview | null>(null);

  const openRoom = (roomId: string): void => {
    router.push({ pathname: '/room/[roomId]', params: { roomId } });
  };

  const createRoomMutation = useMutation({
    mutationFn: () => {
      const nameValidation = validateRoomName(roomName);
      if (!nameValidation.isValid) throw new Error('room_name_invalid');
      const emojiValidation = validateRoomEmoji(roomEmoji);
      if (!emojiValidation.isValid) throw new Error('room_emoji_invalid');
      return createRoom(nameValidation.value, emojiValidation.value);
    },
    onSuccess: async (room) => {
      setIsCreateVisible(false);
      setRoomName('');
      setRoomEmoji('');
      if (userId) await queryClient.invalidateQueries({ queryKey: queryKeys.rooms(userId) });
      openRoom(room.roomId);
    },
  });

  const previewInviteMutation = useMutation({ mutationFn: getRoomInvitePreview });
  const joinRoomMutation = useMutation({
    mutationFn: joinRoomByCode,
    onSuccess: async (roomId) => {
      setInviteCode('');
      setInvitePreview(null);
      if (userId) await queryClient.invalidateQueries({ queryKey: queryKeys.rooms(userId) });
      openRoom(roomId);
    },
  });

  const rooms = roomsQuery.data ?? [];
  const isAtRoomLimit = rooms.length >= MAX_ACTIVE_ROOMS;

  const requestCreate = (): void => {
    if (isAtRoomLimit) {
      Alert.alert('친구방은 3개까지예요', '새 방을 만들려면 참여 중인 방 하나를 먼저 나가거나 종료해 주세요.');
      return;
    }
    setIsCreateVisible(true);
  };

  const previewInvite = (): void => {
    if (isAtRoomLimit) {
      Alert.alert('친구방은 3개까지예요', '새 방에 참여하려면 참여 중인 방 하나를 먼저 나가거나 종료해 주세요.');
      return;
    }
    if (!validateInviteCode(inviteCode)) {
      Alert.alert('초대 코드를 확인해 주세요', '친구가 보낸 6자리 숫자를 모두 입력해 주세요.');
      return;
    }
    previewInviteMutation.mutate(inviteCode, {
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

  if (sessionState.status === 'loading' || roomsQuery.isPending) {
    return <RoomListState message="친구방을 확인하고 있어요." />;
  }

  if (sessionState.status === 'error' || !userId || roomsQuery.isError) {
    return <RoomListState message="친구방을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요." />;
  }

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing[2]) }]}>
        <View>
          <AppText style={styles.eyebrow}>PRIVATE COLOR ROOMS</AppText>
          <AppText style={styles.headerTitle}>친구방</AppText>
        </View>
        <View accessibilityLabel={`참여 중인 친구방 ${rooms.length}개, 최대 ${MAX_ACTIVE_ROOMS}개`} style={styles.countBadge}>
          <AppText style={styles.countText}>{rooms.length} / {MAX_ACTIVE_ROOMS}</AppText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {rooms.length === 0 ? (
          <View style={styles.emptyCard}>
            <AppText style={styles.emptyEyebrow}>YOUR FIRST ROOM</AppText>
            <AppText style={styles.emptyTitle}>방을 개설하세요</AppText>
            <AppText style={styles.emptyDescription}>가까운 친구들과 같은 오늘의 색을 모을 수 있는 비공개 공간이에요.</AppText>
            <Pressable accessibilityLabel="새 친구방 만들기" accessibilityRole="button" onPress={requestCreate} style={styles.primaryButton}>
              <AppText style={styles.primaryButtonText}>새 친구방 만들기</AppText>
              <AppText style={styles.primaryButtonArrow}>→</AppText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.listSection}>
            <View style={styles.sectionHeader}>
              <AppText style={styles.sectionTitle}>나의 방 목록</AppText>
              <AppText style={styles.sectionMeta}>ROOMS</AppText>
            </View>
            <View style={styles.roomList}>
              {rooms.map((room) => <RoomListItem key={room.id} onPress={() => openRoom(room.id)} room={room} userId={userId} />)}
            </View>
          </View>
        )}

        <View style={styles.joinSection}>
          <View style={styles.sectionHeader}>
            <AppText style={styles.sectionTitle}>{rooms.length > 0 ? '새 방 추가' : '초대 코드로 참여'}</AppText>
            <AppText style={styles.sectionMeta}>{isAtRoomLimit ? 'LIMIT REACHED' : 'UP TO 3 ROOMS'}</AppText>
          </View>
          <View style={styles.actionRow}>
            <Pressable accessibilityLabel="새 친구방 만들기" accessibilityRole="button" accessibilityState={{ disabled: isAtRoomLimit }} disabled={isAtRoomLimit} onPress={requestCreate} style={[styles.secondaryButton, isAtRoomLimit && styles.disabledButton]}>
              <AppText style={styles.secondaryButtonText}>방 만들기</AppText>
            </Pressable>
            <View style={styles.inviteInputWrap}>
              <TextInput
                accessibilityLabel="친구방 초대 코드"
                editable={!isAtRoomLimit && !previewInviteMutation.isPending}
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(value) => setInviteCode(value.replace(/\D/g, ''))}
                placeholder="6자리 코드"
                placeholderTextColor="rgba(0, 0, 0, 0.34)"
                style={styles.inviteInput}
                value={inviteCode}
              />
              <Pressable accessibilityLabel="초대 코드 확인" accessibilityRole="button" accessibilityState={{ disabled: isAtRoomLimit || previewInviteMutation.isPending }} disabled={isAtRoomLimit || previewInviteMutation.isPending} onPress={previewInvite} style={[styles.inviteButton, (isAtRoomLimit || previewInviteMutation.isPending) && styles.disabledButton]}>
                <AppText style={styles.inviteButtonText}>{previewInviteMutation.isPending ? '…' : '입장'}</AppText>
              </Pressable>
            </View>
          </View>
          {isAtRoomLimit ? <AppText style={styles.limitMessage}>친구방은 최대 3개까지 참여할 수 있어요.</AppText> : null}
        </View>
      </ScrollView>

      <CreateRoomModal
        emoji={roomEmoji}
        isPending={createRoomMutation.isPending}
        onClose={() => !createRoomMutation.isPending && setIsCreateVisible(false)}
        onCreate={() => createRoomMutation.mutate(undefined, { onError: (error) => Alert.alert('방을 만들지 못했어요', getRoomErrorMessage(error)) })}
        onEmojiChange={setRoomEmoji}
        onNameChange={setRoomName}
        roomName={roomName}
        visible={isCreateVisible}
      />
      <JoinRoomModal
        isPending={joinRoomMutation.isPending}
        onClose={() => !joinRoomMutation.isPending && setInvitePreview(null)}
        onJoin={() => joinRoomMutation.mutate(inviteCode, { onError: (error) => Alert.alert('방에 참여하지 못했어요', getRoomErrorMessage(error)) })}
        preview={invitePreview}
      />
    </View>
  );
}

function RoomListItem({ onPress, room, userId }: { onPress: () => void; room: ActiveRoom; userId: string }) {
  const myMembership = room.members.find((member) => member.id === userId) ?? null;
  return (
    <Pressable accessibilityLabel={`${room.name} 방 상세 보기`} accessibilityRole="button" onPress={onPress} style={styles.roomCard}>
      <View style={styles.roomSymbol}><AppText style={styles.roomSymbolText}>{room.emoji ?? room.name.slice(0, 1)}</AppText></View>
      <View style={styles.roomCopy}>
        <AppText numberOfLines={1} style={styles.roomName}>{room.name}</AppText>
        <AppText style={styles.roomMeta}>{room.members.length}명 참여 · {myMembership?.role === 'owner' ? '내가 방장' : '멤버'}</AppText>
      </View>
      <AppText style={styles.roomArrow}>→</AppText>
    </Pressable>
  );
}

function RoomListState({ message }: { message: string }) {
  return <View accessibilityLiveRegion="polite" style={styles.state}><ActivityIndicator color={colors.black} /><AppText style={styles.stateText}>{message}</AppText></View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.white, flex: 1 },
  header: { alignItems: 'flex-end', borderBottomColor: colors.black, borderBottomWidth: 2, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: spacing[3], paddingHorizontal: spacing[4] },
  eyebrow: { color: 'rgba(0, 0, 0, 0.54)', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
  headerTitle: { color: colors.black, fontSize: 30, fontWeight: '800', letterSpacing: -1.1, lineHeight: 38 },
  countBadge: { borderColor: colors.black, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 6 },
  countText: { color: colors.black, fontFamily: 'monospace', fontSize: 12, fontWeight: '700' },
  content: { gap: spacing[8], padding: spacing[4], paddingBottom: 130, paddingTop: spacing[8] },
  emptyCard: { backgroundColor: '#F8F7F4', borderColor: colors.black, borderWidth: 2, gap: spacing[3], padding: spacing[6] },
  emptyEyebrow: { color: 'rgba(0, 0, 0, 0.55)', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
  emptyTitle: { color: colors.black, fontSize: 31, fontWeight: '800', letterSpacing: -1.3, lineHeight: 39 },
  emptyDescription: { color: 'rgba(0, 0, 0, 0.66)', fontSize: 15, lineHeight: 23 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.black, flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[3], minHeight: 56, paddingHorizontal: spacing[4] },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  primaryButtonArrow: { color: colors.white, fontSize: 23, fontWeight: '700' },
  listSection: { gap: spacing[3] },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: colors.black, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  sectionMeta: { color: 'rgba(0, 0, 0, 0.52)', fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.7 },
  roomList: { gap: spacing[3] },
  roomCard: { alignItems: 'center', borderColor: colors.black, borderWidth: 1.5, flexDirection: 'row', gap: spacing[3], minHeight: 88, paddingHorizontal: spacing[3] },
  roomSymbol: { alignItems: 'center', backgroundColor: '#F1F1EF', borderColor: colors.black, borderRadius: 999, borderWidth: 1.5, height: 48, justifyContent: 'center', width: 48 },
  roomSymbolText: { color: colors.black, fontSize: 22, fontWeight: '700' },
  roomCopy: { flex: 1, gap: 3 },
  roomName: { color: colors.black, fontSize: 19, fontWeight: '800', letterSpacing: -0.55 },
  roomMeta: { color: 'rgba(0, 0, 0, 0.58)', fontFamily: 'monospace', fontSize: 10 },
  roomArrow: { color: colors.black, fontSize: 24, fontWeight: '700' },
  joinSection: { borderTopColor: 'rgba(0, 0, 0, 0.22)', borderTopWidth: 1, gap: spacing[3], paddingTop: spacing[5] },
  actionRow: { flexDirection: 'row', gap: spacing[2] },
  secondaryButton: { alignItems: 'center', borderColor: colors.black, borderWidth: 1.5, justifyContent: 'center', minHeight: 50, paddingHorizontal: spacing[3] },
  secondaryButtonText: { color: colors.black, fontSize: 14, fontWeight: '800' },
  inviteInputWrap: { borderColor: colors.black, borderWidth: 1.5, flex: 1, flexDirection: 'row', minHeight: 50 },
  inviteInput: { color: colors.black, flex: 1, fontFamily: 'monospace', fontSize: 15, paddingHorizontal: 10 },
  inviteButton: { alignItems: 'center', backgroundColor: colors.black, justifyContent: 'center', minWidth: 48 },
  inviteButtonText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  disabledButton: { opacity: 0.38 },
  limitMessage: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  state: { alignItems: 'center', backgroundColor: colors.white, flex: 1, gap: spacing[3], justifyContent: 'center', padding: spacing[6] },
  stateText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
});
