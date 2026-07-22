import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useMemo, useRef, useState } from 'react';

import { AppConfirmationDialog } from '@/src/components/ui/AppConfirmationDialog';
import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { type ThemeColors } from '@/src/design/tokens';
import { getInviteExpiryLabel, type ActiveRoom, type RoomMember, validateRoomEmoji, validateRoomName } from '@/src/features/rooms/model/room';
import { getRoomManagementState } from '@/src/features/rooms/model/roomLifecycle';

export type RoomManagementPendingAction = 'ending' | 'leaving' | 'removing_member' | 'reissuing_invite' | 'revoking_invite' | 'transferring' | 'updating_settings';

type RoomManagementModalProps = {
  currentUserId: string;
  onClose: () => void;
  onEnd: () => void;
  onLeave: () => void;
  onNotice: (title: string, description: string) => void;
  onRemoveMember: (memberUserId: string) => void;
  onReissueInvite: () => void;
  onRevokeInvite: () => void;
  onTransfer: (newOwnerId: string) => void;
  onUpdateSettings: (name: string, emoji: string | null) => void;
  pendingAction: RoomManagementPendingAction | null;
  room: ActiveRoom;
  visible: boolean;
};

type RoomManagementConfirmation =
  | { kind: 'end' }
  | { kind: 'leave' }
  | { hasActiveInvite: boolean; kind: 'reissue_invite' }
  | { kind: 'remove_member'; member: RoomMember }
  | { kind: 'revoke_invite' }
  | { kind: 'transfer'; member: RoomMember };

export function RoomManagementModal({ currentUserId, onClose, onEnd, onLeave, onNotice, onRemoveMember, onReissueInvite, onRevokeInvite, onTransfer, onUpdateSettings, pendingAction, room, visible }: RoomManagementModalProps) {
  const styles = useRoomManagementStyles();
  const managementState = getRoomManagementState(room, currentUserId);
  const isPending = pendingAction !== null;
  const [confirmation, setConfirmation] = useState<RoomManagementConfirmation | null>(null);

  const confirm = (): void => {
    if (!confirmation || isPending) return;
    const target = confirmation;
    setConfirmation(null);

    switch (target.kind) {
      case 'end': onEnd(); break;
      case 'leave': onLeave(); break;
      case 'reissue_invite': onReissueInvite(); break;
      case 'remove_member': onRemoveMember(target.member.id); break;
      case 'revoke_invite': onRevokeInvite(); break;
      case 'transfer': onTransfer(target.member.id); break;
    }
  };

  return (
    <>
      <Modal animationType="fade" onRequestClose={() => !isPending && onClose()} statusBarTranslucent transparent visible={visible}>
        <View style={styles.overlay}>
          <Pressable accessibilityLabel="친구방 관리 닫기" accessibilityRole="button" accessibilityState={{ disabled: isPending }} disabled={isPending} onPress={onClose} style={StyleSheet.absoluteFill} />
          <View accessibilityViewIsModal style={styles.card}>
          <View style={styles.header}>
            <View>
              <AppText style={styles.eyebrow}>PRIVATE ROOM SETTINGS</AppText>
              <AppText style={styles.title}>{room.emoji ? `${room.emoji} ${room.name}` : room.name}</AppText>
            </View>
            <Pressable accessibilityLabel="친구방 관리 닫기" accessibilityRole="button" accessibilityState={{ disabled: isPending }} disabled={isPending} hitSlop={3} onPress={onClose} style={styles.closeButton}><AppText style={styles.closeText}>×</AppText></Pressable>
          </View>

          <View style={styles.body}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              {managementState.canLeaveRoom ? (
                <>
                  <AppText style={styles.description}>방에서 나가도 내 개인 다이어리와 사진은 유지돼요.</AppText>
                  <View style={styles.notice}><AppText style={styles.noticeTitle}>나가면 바뀌는 점</AppText><AppText style={styles.noticeText}>다른 멤버의 과거·새 기록을 더 이상 볼 수 없고, 새 사진도 이 방에 자동 공유되지 않아요.</AppText></View>
                  <DangerButton accessibilityLabel="친구방 나가기" disabled={isPending} label={pendingAction === 'leaving' ? '나가는 중' : '방 나가기'} onPress={() => setConfirmation({ kind: 'leave' })} />
                </>
              ) : (
                <>
                  <AppText style={styles.description}>방 이름과 초대 코드는 방장만 바꿀 수 있어요.</AppText>
                  <RoomOwnerSettings
                    key={`${room.id}:${room.name}:${room.emoji ?? ''}:${visible ? 'open' : 'closed'}`}
                    onNotice={onNotice}
                    onRequestConfirmation={setConfirmation}
                    onUpdateSettings={onUpdateSettings}
                    pendingAction={pendingAction}
                    room={room}
                  />
                  {managementState.removableMembers.length > 0 ? (
                    <View style={styles.section}>
                      <AppText style={styles.sectionLabel}>MEMBER CONTROL</AppText>
                      <AppText style={styles.memberControlHint}>멤버를 내보내면 이 방의 사진 접근과 자동 공유가 중단돼요.</AppText>
                      <View style={styles.memberList}>
                        {managementState.removableMembers.map((member) => (
                          <View key={member.id} style={styles.memberControlRow}>
                            <View style={styles.memberAvatar}><AppText style={styles.memberInitial}>{member.nickname.slice(0, 1)}</AppText></View>
                            <View style={styles.memberCopy}><AppText style={styles.memberName}>{member.nickname}</AppText><AppText style={styles.memberMeta}>일반 멤버</AppText></View>
                            <Pressable
                              accessibilityLabel={`${member.nickname} 님 내보내기`}
                              accessibilityRole="button"
                              accessibilityState={{ disabled: isPending }}
                              disabled={isPending}
                              onPress={() => setConfirmation({ kind: 'remove_member', member })}
                              style={[styles.removeMemberButton, isPending && styles.buttonDisabled]}>
                              <AppText style={styles.removeMemberText}>내보내기</AppText>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                      {pendingAction === 'removing_member' ? <AppText accessibilityLiveRegion="polite" style={styles.pendingText}>멤버를 내보내고 있어요.</AppText> : null}
                    </View>
                  ) : null}
                  {managementState.successors.length > 0 ? (
                    <View style={styles.section}>
                      <AppText style={styles.sectionLabel}>새 방장 선택</AppText>
                      <View style={styles.memberList}>
                        {managementState.successors.map((member) => (
                          <Pressable
                            accessibilityLabel={`${member.nickname} 님에게 방장 넘기기`}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: isPending }}
                            disabled={isPending}
                            key={member.id}
                            onPress={() => setConfirmation({ kind: 'transfer', member })}
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
                </>
              )}
            </ScrollView>
            {managementState.canEndRoom ? (
              <View style={styles.ownerDangerFooter}>
                <AppText style={styles.ownerDangerHint}>방을 닫으면 모든 멤버의 공유 접근과 초대가 중단돼요.</AppText>
                <DangerButton accessibilityLabel="친구방 종료" disabled={isPending} label={pendingAction === 'ending' ? '종료하는 중' : '방 종료'} onPress={() => setConfirmation({ kind: 'end' })} />
              </View>
            ) : null}
          </View>
          </View>
        </View>
      </Modal>
      <RoomManagementConfirmationDialog confirmation={confirmation} isPending={isPending} onClose={() => setConfirmation(null)} onConfirm={confirm} />
    </>
  );
}

function RoomOwnerSettings({ onNotice, onRequestConfirmation, onUpdateSettings, pendingAction, room }: Pick<RoomManagementModalProps, 'onNotice' | 'onUpdateSettings' | 'pendingAction' | 'room'> & { onRequestConfirmation: (confirmation: RoomManagementConfirmation) => void }) {
  const { colors } = useAppTheme();
  const styles = useRoomManagementStyles();
  const nameRef = useRef(room.name);
  const emojiRef = useRef(room.emoji ?? '');
  const isPending = pendingAction !== null;
  const hasActiveInvite = room.inviteCode !== null;

  const saveSettings = (): void => {
    const nameValidation = validateRoomName(nameRef.current);
    if (!nameValidation.isValid) {
      onNotice('방 이름을 확인해 주세요', nameValidation.message);
      return;
    }

    const emojiValidation = validateRoomEmoji(emojiRef.current);
    if (!emojiValidation.isValid) {
      onNotice('방 이모지를 확인해 주세요', emojiValidation.message);
      return;
    }

    onUpdateSettings(nameValidation.value, emojiValidation.value);
  };

  const confirmReissue = (): void => {
    onRequestConfirmation({ hasActiveInvite, kind: 'reissue_invite' });
  };

  const confirmRevoke = (): void => {
    onRequestConfirmation({ kind: 'revoke_invite' });
  };

  return (
    <>
      <View style={styles.section}>
        <AppText style={styles.sectionLabel}>ROOM IDENTITY</AppText>
        <View style={styles.fieldGroup}>
          <AppText style={styles.fieldLabel}>방 이름</AppText>
          <TextInput accessibilityLabel="방 이름" defaultValue={room.name} editable={!isPending} maxLength={20} onChangeText={(value) => { nameRef.current = value; }} placeholder="방 이름" placeholderTextColor={colors.textTertiary} style={styles.textInput} />
        </View>
        <View style={styles.fieldGroup}>
          <AppText style={styles.fieldLabel}>방 이모지 · 선택</AppText>
          <TextInput accessibilityLabel="방 이모지" defaultValue={room.emoji ?? ''} editable={!isPending} maxLength={8} onChangeText={(value) => { emojiRef.current = value; }} placeholder="🎨" placeholderTextColor={colors.textTertiary} style={[styles.textInput, styles.emojiInput]} />
        </View>
        <PrimaryButton accessibilityLabel="방 정보 저장" disabled={isPending} label={pendingAction === 'updating_settings' ? '저장 중' : '방 정보 저장'} onPress={saveSettings} />
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionLabel}>INVITE CODE</AppText>
        <View style={styles.inviteCard}>
          <AppText style={styles.inviteCode}>{room.inviteCode ?? 'NO ACTIVE CODE'}</AppText>
          <AppText style={styles.inviteMeta}>{getInviteExpiryLabel(room.inviteExpiresAt)}</AppText>
        </View>
        <SecondaryButton accessibilityLabel="새 초대 코드 만들기" disabled={isPending} label={pendingAction === 'reissuing_invite' ? '새 코드 만드는 중' : hasActiveInvite ? '새 코드로 24시간 연장' : '초대 코드 만들기'} onPress={confirmReissue} />
        {hasActiveInvite ? <DangerButton accessibilityLabel="초대 코드 취소" disabled={isPending} label={pendingAction === 'revoking_invite' ? '코드 취소 중' : '현재 초대 코드 취소'} onPress={confirmRevoke} /> : null}
      </View>
    </>
  );
}

function RoomManagementConfirmationDialog({ confirmation, isPending, onClose, onConfirm }: { confirmation: RoomManagementConfirmation | null; isPending: boolean; onClose: () => void; onConfirm: () => void }) {
  if (!confirmation) return null;
  const copy = getConfirmationCopy(confirmation);

  return (
    <AppConfirmationDialog
      cancelLabel="취소"
      confirmLabel={copy.confirmLabel}
      description={copy.description}
      isBusy={isPending}
      onClose={onClose}
      onConfirm={onConfirm}
      title={copy.title}
      tone={copy.tone}
      visible
    />
  );
}

function getConfirmationCopy(confirmation: RoomManagementConfirmation): { confirmLabel: string; description: string; title: string; tone: 'default' | 'destructive' } {
  switch (confirmation.kind) {
    case 'end':
      return { confirmLabel: '방 종료', description: '모든 멤버의 상호 사진 접근과 초대가 중단돼요. 각자의 개인 다이어리와 사진은 삭제되지 않아요.', title: '이 친구방을 종료할까요?', tone: 'destructive' };
    case 'leave':
      return { confirmLabel: '방 나가기', description: '내 개인 다이어리와 사진은 그대로 남아요. 다른 멤버 기록 접근과 앞으로의 자동 공유만 중단돼요.', title: '방에서 나갈까요?', tone: 'destructive' };
    case 'reissue_invite':
      return { confirmLabel: '새 코드 만들기', description: confirmation.hasActiveInvite ? '기존 초대 코드는 바로 사용할 수 없게 되고, 새 코드는 24시간 동안 유효해요.' : '새 코드는 24시간 동안 유효해요.', title: '새 초대 코드를 만들까요?', tone: 'default' };
    case 'remove_member':
      return { confirmLabel: '내보내기', description: '내보낸 멤버는 이 방의 사진을 더 이상 볼 수 없고, 현재 초대 코드도 함께 취소돼요. 각자의 개인 다이어리와 사진은 유지돼요.', title: `${confirmation.member.nickname} 님을 내보낼까요?`, tone: 'destructive' };
    case 'revoke_invite':
      return { confirmLabel: '코드 취소', description: '지금 공유한 코드로는 더 이상 참여할 수 없어요. 원할 때 새 코드를 다시 만들 수 있어요.', title: '초대 코드를 취소할까요?', tone: 'destructive' };
    case 'transfer':
      return { confirmLabel: '방장 넘기기', description: `${confirmation.member.nickname} 님이 이 방의 새 방장이 돼요. 방은 계속 유지되고, 나는 일반 멤버가 돼요.`, title: '방장을 넘길까요?', tone: 'default' };
  }
}

function PrimaryButton({ accessibilityLabel, disabled, label, onPress }: { accessibilityLabel: string; disabled: boolean; label: string; onPress: () => void }) {
  const styles = useRoomManagementStyles();
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && styles.buttonDisabled]}><AppText style={styles.primaryButtonText}>{label}</AppText></Pressable>;
}

function SecondaryButton({ accessibilityLabel, disabled, label, onPress }: { accessibilityLabel: string; disabled: boolean; label: string; onPress: () => void }) {
  const styles = useRoomManagementStyles();
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.secondaryButton, disabled && styles.buttonDisabled]}><AppText style={styles.secondaryButtonText}>{label}</AppText></Pressable>;
}

function DangerButton({ accessibilityLabel, disabled, label, onPress }: { accessibilityLabel: string; disabled: boolean; label: string; onPress: () => void }) {
  const styles = useRoomManagementStyles();
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.dangerButton, disabled && styles.buttonDisabled]}><AppText style={styles.dangerButtonText}>{label}</AppText></Pressable>;
}

function useRoomManagementStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: colors.overlay, flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 2, boxShadow: `7px 7px 0px ${colors.black}`, gap: 16, maxHeight: '88%', maxWidth: 390, padding: 20, width: '100%' },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  body: { flexShrink: 1, gap: 14 },
  content: { gap: 16 },
  eyebrow: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.9 },
  title: { color: colors.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.65, lineHeight: 30, marginTop: 3 },
  closeButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, height: 38, justifyContent: 'center', width: 38 },
  closeText: { color: colors.ink, fontSize: 28, fontWeight: '300', lineHeight: 31 },
  description: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  notice: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: 1, gap: 4, padding: 13 },
  noticeTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  noticeText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  section: { gap: 8 },
  sectionLabel: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.8 },
  fieldGroup: { gap: 5 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  textInput: { backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 1.5, color: colors.ink, fontSize: 15, minHeight: 46, paddingHorizontal: 11, paddingVertical: 9 },
  emojiInput: { fontSize: 20 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.ink, boxShadow: `3px 3px 0px ${colors.black}`, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
  primaryButtonText: { color: colors.surface, fontSize: 14, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
  secondaryButtonText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  inviteCard: { backgroundColor: colors.surfaceMuted, borderColor: colors.ink, borderWidth: 1.5, gap: 4, padding: 13 },
  inviteCode: { color: colors.ink, fontFamily: 'monospace', fontSize: 23, fontWeight: '800', letterSpacing: 3 },
  inviteMeta: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  memberList: { borderColor: colors.ink, borderWidth: 1.5 },
  memberButton: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 62, paddingHorizontal: 12 },
  memberControlHint: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  memberControlRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 62, paddingHorizontal: 12 },
  memberAvatar: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.ink, borderRadius: 18, borderWidth: 1.5, height: 36, justifyContent: 'center', width: 36 },
  memberInitial: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  memberCopy: { flex: 1, gap: 1 },
  memberName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  memberMeta: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 9 },
  memberArrow: { color: colors.ink, fontSize: 19 },
  removeMemberButton: { alignItems: 'center', borderColor: colors.danger, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 9 },
  removeMemberText: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  pendingText: { color: colors.textSecondary, fontSize: 12 },
  ownerDangerFooter: { borderTopColor: colors.danger, borderTopWidth: 1, gap: 8, paddingTop: 14 },
  ownerDangerHint: { color: colors.danger, fontSize: 11, lineHeight: 16 },
  dangerButton: { alignItems: 'center', borderColor: colors.danger, borderWidth: 1.5, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
  dangerButtonText: { color: colors.danger, fontSize: 15, fontWeight: '800' },
  buttonDisabled: { opacity: 0.5 },
  });
}
