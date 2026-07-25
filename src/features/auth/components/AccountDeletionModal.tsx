import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppModal } from '@/src/components/ui/AppModal';
import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { type ThemeColors } from '@/src/design/tokens';
import { getAccountDeletionConfirmation, isAccountDeletionConfirmed } from '@/src/features/auth/model/accountDeletion';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

type AccountDeletionModalProps = {
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  visible: boolean;
};

export function AccountDeletionModal({ isDeleting, onClose, onConfirm, visible }: AccountDeletionModalProps) {
  const styles = useAccountDeletionStyles();
  const { t } = useAppLanguage();
  return (
    <AppModal accessibilityLabel={t('계정 삭제 닫기')} contentStyle={styles.card} isBusy={isDeleting} onClose={onClose} visible={visible}>
      <AccountDeletionForm key={visible ? 'open' : 'closed'} isDeleting={isDeleting} onClose={onClose} onConfirm={onConfirm} />
    </AppModal>
  );
}

function AccountDeletionForm({ isDeleting, onClose, onConfirm }: Omit<AccountDeletionModalProps, 'visible'>) {
  const { colors } = useAppTheme();
  const { format, language, t } = useAppLanguage();
  const styles = useAccountDeletionStyles();
  const [confirmation, setConfirmation] = useState('');
  const confirmationWord = getAccountDeletionConfirmation(language);
  const canDelete = !isDeleting && isAccountDeletionConfirmed(confirmation, confirmationWord);

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText style={styles.eyebrow}>ACCOUNT DELETE</AppText>
          <AppText accessibilityRole="header" style={styles.title}>계정을 정말 삭제할까요?</AppText>
        </View>
        <Pressable accessibilityLabel={t('계정 삭제 닫기')} accessibilityRole="button" accessibilityState={{ disabled: isDeleting }} disabled={isDeleting} onPress={onClose} style={styles.closeButton}>
          <AppText style={styles.closeText}>×</AppText>
        </Pressable>
      </View>

      <View style={styles.warningBox}>
        <AppText style={styles.warningTitle}>되돌릴 수 없어요</AppText>
        <AppText style={styles.warningText}>내 프로필, 다이어리, 사진이 영구적으로 삭제돼요.</AppText>
      </View>

      <AppText style={styles.description}>방장이라면 가장 먼저 참여한 멤버에게 방장 권한이 넘어가요. 혼자였던 방은 종료되고, 다른 멤버의 개인 기록은 그대로 유지돼요.</AppText>
      <AppText localize={false} style={styles.inputLabel}>{format('계속하려면 ‘{confirmation}’를 입력해 주세요.', { confirmation: confirmationWord })}</AppText>
      <TextInput
        accessibilityLabel={t('계정 삭제 확인 문구')}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isDeleting}
        onChangeText={setConfirmation}
        placeholder={confirmationWord}
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        value={confirmation}
      />
      <View style={styles.actions}>
        <Pressable accessibilityLabel={t('계정 삭제 취소')} accessibilityRole="button" accessibilityState={{ disabled: isDeleting }} disabled={isDeleting} onPress={onClose} style={[styles.cancelButton, isDeleting && styles.disabledButton]}>
          <AppText style={styles.cancelText}>취소</AppText>
        </Pressable>
        <Pressable accessibilityLabel={t('계정 삭제 확정')} accessibilityRole="button" accessibilityState={{ disabled: !canDelete }} disabled={!canDelete} onPress={onConfirm} style={[styles.deleteButton, !canDelete && styles.disabledButton]}>
          <AppText localize={false} style={styles.deleteText}>{isDeleting ? t('삭제 중…') : t('영구 삭제')}</AppText>
        </Pressable>
      </View>
    </>
  );
}

function useAccountDeletionStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: { gap: 14, maxWidth: 410, padding: 20 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { color: colors.danger, fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.9 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.6, lineHeight: 29 },
  closeButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, height: 44, justifyContent: 'center', width: 44 },
  closeText: { color: colors.ink, fontSize: 28, fontWeight: '300', lineHeight: 31 },
  warningBox: { backgroundColor: colors.surfaceMuted, borderColor: colors.danger, borderLeftWidth: 4, gap: 2, padding: 12 },
  warningTitle: { color: colors.danger, fontSize: 14, fontWeight: '800', lineHeight: 20 },
  warningText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  description: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  inputLabel: { color: colors.ink, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  input: { backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 1.5, color: colors.ink, fontSize: 17, minHeight: 50, paddingHorizontal: 13, paddingVertical: 9 },
  actions: { flexDirection: 'row', gap: 10 },
  cancelButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 10 },
  cancelText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  deleteButton: { alignItems: 'center', backgroundColor: colors.danger, boxShadow: `3px 3px 0px ${colors.danger}`, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 10 },
  deleteText: { color: colors.surface, fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.42 },
  });
}
