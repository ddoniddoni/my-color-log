import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { colors } from '@/src/design/tokens';
import { ACCOUNT_DELETION_CONFIRMATION, isAccountDeletionConfirmed } from '@/src/features/auth/model/accountDeletion';

type AccountDeletionModalProps = {
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  visible: boolean;
};

export function AccountDeletionModal({ isDeleting, onClose, onConfirm, visible }: AccountDeletionModalProps) {
  return (
    <Modal animationType="fade" onRequestClose={() => !isDeleting && onClose()} statusBarTranslucent transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="계정 삭제 닫기" disabled={isDeleting} onPress={onClose} style={StyleSheet.absoluteFill} />
        <AccountDeletionForm key={visible ? 'open' : 'closed'} isDeleting={isDeleting} onClose={onClose} onConfirm={onConfirm} />
      </View>
    </Modal>
  );
}

function AccountDeletionForm({ isDeleting, onClose, onConfirm }: Omit<AccountDeletionModalProps, 'visible'>) {
  const [confirmation, setConfirmation] = useState('');
  const canDelete = !isDeleting && isAccountDeletionConfirmed(confirmation);

  return (
    <View accessibilityViewIsModal style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText style={styles.eyebrow}>ACCOUNT DELETE</AppText>
          <AppText style={styles.title}>계정을 정말 삭제할까요?</AppText>
        </View>
        <Pressable accessibilityLabel="계정 삭제 닫기" accessibilityRole="button" accessibilityState={{ disabled: isDeleting }} disabled={isDeleting} onPress={onClose} style={styles.closeButton}>
          <AppText style={styles.closeText}>×</AppText>
        </Pressable>
      </View>

      <View style={styles.warningBox}>
        <AppText style={styles.warningTitle}>되돌릴 수 없어요</AppText>
        <AppText style={styles.warningText}>내 프로필, 다이어리, 사진이 영구적으로 삭제돼요.</AppText>
      </View>

      <AppText style={styles.description}>방장이라면 가장 먼저 참여한 멤버에게 방장 권한이 넘어가요. 혼자였던 방은 종료되고, 다른 멤버의 개인 기록은 그대로 유지돼요.</AppText>
      <AppText style={styles.inputLabel}>계속하려면 ‘{ACCOUNT_DELETION_CONFIRMATION}’를 입력해 주세요.</AppText>
      <TextInput
        accessibilityLabel="계정 삭제 확인 문구"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isDeleting}
        onChangeText={setConfirmation}
        placeholder={ACCOUNT_DELETION_CONFIRMATION}
        placeholderTextColor="rgba(0, 0, 0, 0.36)"
        style={styles.input}
        value={confirmation}
      />
      <View style={styles.actions}>
        <Pressable accessibilityLabel="계정 삭제 취소" accessibilityRole="button" accessibilityState={{ disabled: isDeleting }} disabled={isDeleting} onPress={onClose} style={[styles.cancelButton, isDeleting && styles.disabledButton]}>
          <AppText style={styles.cancelText}>취소</AppText>
        </Pressable>
        <Pressable accessibilityLabel="계정 삭제 확정" accessibilityRole="button" accessibilityState={{ disabled: !canDelete }} disabled={!canDelete} onPress={onConfirm} style={[styles.deleteButton, !canDelete && styles.disabledButton]}>
          <AppText style={styles.deleteText}>{isDeleting ? '삭제 중…' : '영구 삭제'}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.58)', flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.white, borderColor: colors.black, borderWidth: 2, boxShadow: '7px 7px 0px #000000', gap: 14, maxWidth: 410, padding: 20, width: '100%' },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { color: colors.danger, fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.9 },
  title: { color: colors.black, fontSize: 22, fontWeight: '800', letterSpacing: -0.6, lineHeight: 29 },
  closeButton: { alignItems: 'center', borderColor: colors.black, borderWidth: 1.5, height: 38, justifyContent: 'center', width: 38 },
  closeText: { color: colors.black, fontSize: 28, fontWeight: '300', lineHeight: 31 },
  warningBox: { backgroundColor: '#FFF0EE', borderColor: '#D46057', borderLeftWidth: 4, gap: 2, padding: 12 },
  warningTitle: { color: '#8D2520', fontSize: 14, fontWeight: '800', lineHeight: 20 },
  warningText: { color: '#5F2925', fontSize: 13, lineHeight: 19 },
  description: { color: 'rgba(0, 0, 0, 0.7)', fontSize: 13, lineHeight: 20 },
  inputLabel: { color: colors.black, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  input: { backgroundColor: colors.white, borderColor: colors.black, borderWidth: 1.5, color: colors.black, fontSize: 17, minHeight: 50, paddingHorizontal: 13, paddingVertical: 9 },
  actions: { flexDirection: 'row', gap: 10 },
  cancelButton: { alignItems: 'center', borderColor: colors.black, borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 10 },
  cancelText: { color: colors.black, fontSize: 14, fontWeight: '800' },
  deleteButton: { alignItems: 'center', backgroundColor: colors.danger, boxShadow: '3px 3px 0px #B74747', flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 10 },
  deleteText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.42 },
});
