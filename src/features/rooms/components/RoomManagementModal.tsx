import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRef } from 'react';

import { AppText } from '@/src/components/ui/AppText';
import { colors } from '@/src/design/tokens';
import { type ActiveRoom, type RoomMember, validateRoomEmoji, validateRoomName } from '@/src/features/rooms/model/room';
import { getRoomManagementState } from '@/src/features/rooms/model/roomLifecycle';

export type RoomManagementPendingAction = 'ending' | 'leaving' | 'reissuing_invite' | 'revoking_invite' | 'transferring' | 'updating_settings';

type RoomManagementModalProps = {
  currentUserId: string;
  onClose: () => void;
  onEnd: () => void;
  onLeave: () => void;
  onReissueInvite: () => void;
  onRevokeInvite: () => void;
  onTransfer: (newOwnerId: string) => void;
  onUpdateSettings: (name: string, emoji: string | null) => void;
  pendingAction: RoomManagementPendingAction | null;
  room: ActiveRoom;
  visible: boolean;
};

export function RoomManagementModal({ currentUserId, onClose, onEnd, onLeave, onReissueInvite, onRevokeInvite, onTransfer, onUpdateSettings, pendingAction, room, visible }: RoomManagementModalProps) {
  const managementState = getRoomManagementState(room, currentUserId);
  const isPending = pendingAction !== null;

  const confirmLeave = (): void => {
    Alert.alert(
      '방에서 나갈까요?',
      '내 개인 다이어리와 사진은 그대로 남아요. 다른 멤버 기록 접근과 앞으로의 자동 공유만 중단돼요.',
      [
        { text: '취소', style: 'cancel' },
        { onPress: onLeave, style: 'destructive', text: '방 나가기' },
      ],
    );
  };

  const confirmTransfer = (member: RoomMember): void => {
    Alert.alert(
      '방장을 넘길까요?',
      `${member.nickname} 님이 이 방의 새 방장이 돼요. 방은 계속 유지되고, 나는 일반 멤버가 돼요.`,
      [
        { text: '취소', style: 'cancel' },
        { onPress: () => onTransfer(member.id), text: '방장 넘기기' },
      ],
    );
  };

  const confirmEnd = (): void => {
    Alert.alert(
      '이 친구방을 종료할까요?',
      '모든 멤버의 상호 사진 접근과 초대가 중단돼요. 각자의 개인 다이어리와 사진은 삭제되지 않아요.',
      [
        { text: '취소', style: 'cancel' },
        { onPress: onEnd, style: 'destructive', text: '방 종료' },
      ],
    );
  };

  return (
    <Modal animationType="fade" onRequestClose={() => !isPending && onClose()} transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="친구방 관리 닫기" disabled={isPending} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.card}>
          <View style={styles.header}>
            <View>
              <AppText style={styles.eyebrow}>PRIVATE ROOM SETTINGS</AppText>
              <AppText style={styles.title}>{room.emoji ? `${room.emoji} ${room.name}` : room.name}</AppText>
            </View>
            <Pressable accessibilityLabel="친구방 관리 닫기" accessibilityRole="button" disabled={isPending} onPress={onClose} style={styles.closeButton}><AppText style={styles.closeText}>×</AppText></Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {managementState.canLeaveRoom ? (
              <>
                <AppText style={styles.description}>방에서 나가도 내 개인 다이어리와 사진은 유지돼요.</AppText>
                <View style={styles.notice}><AppText style={styles.noticeTitle}>나가면 바뀌는 점</AppText><AppText style={styles.noticeText}>다른 멤버의 과거·새 기록을 더 이상 볼 수 없고, 새 사진도 이 방에 자동 공유되지 않아요.</AppText></View>
                <DangerButton accessibilityLabel="친구방 나가기" disabled={isPending} label={pendingAction === 'leaving' ? '나가는 중' : '방 나가기'} onPress={confirmLeave} />
              </>
            ) : (
              <>
                <AppText style={styles.description}>방 이름과 초대 코드는 방장만 바꿀 수 있어요.</AppText>
                <RoomOwnerSettings
                  key={`${room.id}:${room.name}:${room.emoji ?? ''}:${visible ? 'open' : 'closed'}`}
                  onReissueInvite={onReissueInvite}
                  onRevokeInvite={onRevokeInvite}
                  onUpdateSettings={onUpdateSettings}
                  pendingAction={pendingAction}
                  room={room}
                />
                {managementState.successors.length > 0 ? (
                  <View style={styles.section}>
                    <AppText style={styles.sectionLabel}>새 방장 선택</AppText>
                    <View style={styles.memberList}>
                      {managementState.successors.map((member) => (
                        <Pressable
                          accessibilityLabel={`${member.nickname} 님에게 방장 넘기기`}
                          accessibilityRole="button"
                          disabled={isPending}
                          key={member.id}
                          onPress={() => confirmTransfer(member)}
                          style={styles.memberButton}>
                          <View style={styles.memberAvatar}><AppText style={styles.memberInitial}>{member.nickname.slice(0, 1)}</AppText></View>
                          <View style={styles.memberCopy}><AppText style={styles.memberName}>{member.nickname}</AppText><AppText style={styles.memberMeta}>방장으로 넘기기</AppText></View>
                          <AppText style={styles.memberArrow}>→</AppText>
                        </Pressable>
                      ))}
                    </View>
                    {pendingAction === 'transferring' ? <AppText accessibilityLiveRegion="polite" style={styles.pendingText}>방장 권한을 넘기고 있어요.</AppText> : null}
                  </View>
                ) : <View style={styles.notice}><AppText style={styles.noticeTitle}>넘길 멤버가 없어요</AppText><AppText style={styles.noticeText}>다른 멤버가 참여한 뒤 방장을 넘길 수 있어요. 지금은 방을 종료할 수 있어요.</AppText></View>}
                <DangerButton accessibilityLabel="친구방 종료" disabled={isPending} label={pendingAction === 'ending' ? '종료하는 중' : '방 종료'} onPress={confirmEnd} />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function RoomOwnerSettings({ onReissueInvite, onRevokeInvite, onUpdateSettings, pendingAction, room }: Pick<RoomManagementModalProps, 'onReissueInvite' | 'onRevokeInvite' | 'onUpdateSettings' | 'pendingAction' | 'room'>) {
  const nameRef = useRef(room.name);
  const emojiRef = useRef(room.emoji ?? '');
  const isPending = pendingAction !== null;
  const hasActiveInvite = room.inviteCode !== null;

  const saveSettings = (): void => {
    const nameValidation = validateRoomName(nameRef.current);
    if (!nameValidation.isValid) {
      Alert.alert('방 이름을 확인해 주세요', nameValidation.message);
      return;
    }

    const emojiValidation = validateRoomEmoji(emojiRef.current);
    if (!emojiValidation.isValid) {
      Alert.alert('방 이모지를 확인해 주세요', emojiValidation.message);
      return;
    }

    onUpdateSettings(nameValidation.value, emojiValidation.value);
  };

  const confirmReissue = (): void => {
    Alert.alert(
      hasActiveInvite ? '새 초대 코드를 만들까요?' : '새 초대 코드를 만들까요?',
      hasActiveInvite ? '기존 초대 코드는 바로 사용할 수 없게 되고, 새 코드는 24시간 동안 유효해요.' : '새 코드는 24시간 동안 유효해요.',
      [
        { text: '취소', style: 'cancel' },
        { onPress: onReissueInvite, text: '새 코드 만들기' },
      ],
    );
  };

  const confirmRevoke = (): void => {
    Alert.alert(
      '초대 코드를 취소할까요?',
      '지금 공유한 코드로는 더 이상 참여할 수 없어요. 원할 때 새 코드를 다시 만들 수 있어요.',
      [
        { text: '취소', style: 'cancel' },
        { onPress: onRevokeInvite, style: 'destructive', text: '코드 취소' },
      ],
    );
  };

  return (
    <>
      <View style={styles.section}>
        <AppText style={styles.sectionLabel}>ROOM IDENTITY</AppText>
        <View style={styles.fieldGroup}>
          <AppText style={styles.fieldLabel}>방 이름</AppText>
          <TextInput accessibilityLabel="방 이름" defaultValue={room.name} editable={!isPending} maxLength={20} onChangeText={(value) => { nameRef.current = value; }} placeholder="방 이름" placeholderTextColor="rgba(0, 0, 0, 0.38)" style={styles.textInput} />
        </View>
        <View style={styles.fieldGroup}>
          <AppText style={styles.fieldLabel}>방 이모지 · 선택</AppText>
          <TextInput accessibilityLabel="방 이모지" defaultValue={room.emoji ?? ''} editable={!isPending} maxLength={8} onChangeText={(value) => { emojiRef.current = value; }} placeholder="🎨" placeholderTextColor="rgba(0, 0, 0, 0.38)" style={[styles.textInput, styles.emojiInput]} />
        </View>
        <PrimaryButton accessibilityLabel="방 정보 저장" disabled={isPending} label={pendingAction === 'updating_settings' ? '저장 중' : '방 정보 저장'} onPress={saveSettings} />
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionLabel}>INVITE CODE</AppText>
        <View style={styles.inviteCard}>
          <AppText style={styles.inviteCode}>{room.inviteCode ?? 'NO ACTIVE CODE'}</AppText>
          <AppText style={styles.inviteMeta}>{hasActiveInvite ? '현재 초대 코드는 24시간 동안만 사용할 수 있어요.' : '현재 사용할 수 있는 초대 코드가 없어요.'}</AppText>
        </View>
        <SecondaryButton accessibilityLabel="새 초대 코드 만들기" disabled={isPending} label={pendingAction === 'reissuing_invite' ? '새 코드 만드는 중' : hasActiveInvite ? '새 초대 코드 만들기' : '초대 코드 만들기'} onPress={confirmReissue} />
        {hasActiveInvite ? <DangerButton accessibilityLabel="초대 코드 취소" disabled={isPending} label={pendingAction === 'revoking_invite' ? '코드 취소 중' : '현재 초대 코드 취소'} onPress={confirmRevoke} /> : null}
      </View>
    </>
  );
}

function PrimaryButton({ accessibilityLabel, disabled, label, onPress }: { accessibilityLabel: string; disabled: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && styles.buttonDisabled]}><AppText style={styles.primaryButtonText}>{label}</AppText></Pressable>;
}

function SecondaryButton({ accessibilityLabel, disabled, label, onPress }: { accessibilityLabel: string; disabled: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.secondaryButton, disabled && styles.buttonDisabled]}><AppText style={styles.secondaryButtonText}>{label}</AppText></Pressable>;
}

function DangerButton({ accessibilityLabel, disabled, label, onPress }: { accessibilityLabel: string; disabled: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.dangerButton, disabled && styles.buttonDisabled]}><AppText style={styles.dangerButtonText}>{label}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.44)', flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FAFAF8', borderColor: colors.black, borderWidth: 2, gap: 16, maxHeight: '88%', maxWidth: 390, padding: 20, width: '100%' },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  content: { gap: 16 },
  eyebrow: { color: 'rgba(0, 0, 0, 0.58)', fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.9 },
  title: { color: colors.black, fontSize: 23, fontWeight: '800', letterSpacing: -0.65, lineHeight: 30, marginTop: 3 },
  closeButton: { alignItems: 'center', borderColor: colors.black, borderWidth: 1.5, height: 38, justifyContent: 'center', width: 38 },
  closeText: { color: colors.black, fontSize: 28, fontWeight: '300', lineHeight: 31 },
  description: { color: 'rgba(0, 0, 0, 0.7)', fontSize: 14, lineHeight: 21 },
  notice: { backgroundColor: '#F2F1ED', borderColor: 'rgba(0, 0, 0, 0.24)', borderWidth: 1, gap: 4, padding: 13 },
  noticeTitle: { color: colors.black, fontSize: 13, fontWeight: '700' },
  noticeText: { color: 'rgba(0, 0, 0, 0.65)', fontSize: 12, lineHeight: 18 },
  section: { gap: 8 },
  sectionLabel: { color: 'rgba(0, 0, 0, 0.6)', fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.8 },
  fieldGroup: { gap: 5 },
  fieldLabel: { color: colors.black, fontSize: 12, fontWeight: '700' },
  textInput: { backgroundColor: colors.white, borderColor: colors.black, borderWidth: 1.5, color: colors.black, fontSize: 15, minHeight: 46, paddingHorizontal: 11, paddingVertical: 9 },
  emojiInput: { fontSize: 20 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.black, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', borderColor: colors.black, borderWidth: 1.5, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
  secondaryButtonText: { color: colors.black, fontSize: 14, fontWeight: '800' },
  inviteCard: { backgroundColor: '#F2F1ED', borderColor: colors.black, borderWidth: 1.5, gap: 4, padding: 13 },
  inviteCode: { color: colors.black, fontFamily: 'monospace', fontSize: 23, fontWeight: '800', letterSpacing: 3 },
  inviteMeta: { color: 'rgba(0, 0, 0, 0.62)', fontSize: 11, lineHeight: 16 },
  memberList: { borderColor: colors.black, borderWidth: 1.5 },
  memberButton: { alignItems: 'center', borderBottomColor: 'rgba(0, 0, 0, 0.2)', borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 62, paddingHorizontal: 12 },
  memberAvatar: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.black, borderRadius: 18, borderWidth: 1.5, height: 36, justifyContent: 'center', width: 36 },
  memberInitial: { color: colors.black, fontSize: 15, fontWeight: '700' },
  memberCopy: { flex: 1, gap: 1 },
  memberName: { color: colors.black, fontSize: 15, fontWeight: '700' },
  memberMeta: { color: 'rgba(0, 0, 0, 0.56)', fontFamily: 'monospace', fontSize: 9 },
  memberArrow: { color: colors.black, fontSize: 19 },
  pendingText: { color: 'rgba(0, 0, 0, 0.62)', fontSize: 12 },
  dangerButton: { alignItems: 'center', borderColor: colors.danger, borderWidth: 1.5, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
  dangerButtonText: { color: colors.danger, fontSize: 15, fontWeight: '800' },
  buttonDisabled: { opacity: 0.5 },
});
