import { Pressable, StyleSheet, View } from 'react-native';

import { AppModal } from '@/src/components/ui/AppModal';
import { AppText } from '@/src/components/ui/AppText';
import { colors, spacing } from '@/src/design/tokens';

type AppConfirmationDialogProps = {
  cancelLabel?: string;
  confirmLabel: string;
  description: string;
  eyebrow?: string;
  isBusy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tone?: 'default' | 'destructive';
  title: string;
  visible: boolean;
};

export function AppConfirmationDialog({
  cancelLabel,
  confirmLabel,
  description,
  eyebrow = 'PLEASE CONFIRM',
  isBusy = false,
  onClose,
  onConfirm,
  tone = 'default',
  title,
  visible,
}: AppConfirmationDialogProps) {
  return (
    <AppModal accessibilityLabel={`${title} 닫기`} contentStyle={styles.card} isBusy={isBusy} onClose={onClose} visible={visible}>
      <View style={styles.copy}>
        <AppText style={styles.eyebrow}>{eyebrow}</AppText>
        <AppText accessibilityRole="header" style={styles.title}>{title}</AppText>
        <AppText style={styles.description}>{description}</AppText>
      </View>
      <View style={styles.actions}>
        {cancelLabel ? (
          <Pressable accessibilityLabel={cancelLabel} accessibilityRole="button" disabled={isBusy} onPress={onClose} style={[styles.secondaryButton, isBusy && styles.disabledButton]}>
            <AppText style={styles.secondaryButtonText}>{cancelLabel}</AppText>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel={confirmLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: isBusy }}
          disabled={isBusy}
          onPress={onConfirm}
          style={[styles.confirmButton, tone === 'destructive' ? styles.destructiveButton : styles.primaryButton, isBusy && styles.disabledButton]}>
          <AppText style={[styles.confirmButtonText, tone === 'destructive' && styles.destructiveButtonText]}>{confirmLabel}</AppText>
        </Pressable>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[5], padding: spacing[5] },
  copy: { gap: spacing[2] },
  eyebrow: { color: 'rgba(0, 0, 0, 0.58)', fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.9 },
  title: { color: colors.black, fontSize: 22, fontWeight: '800', letterSpacing: -0.7, lineHeight: 29 },
  description: { color: 'rgba(0, 0, 0, 0.68)', fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: spacing[2] },
  secondaryButton: { alignItems: 'center', borderColor: colors.black, borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing[3] },
  secondaryButtonText: { color: colors.black, fontSize: 14, fontWeight: '800' },
  confirmButton: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing[3] },
  primaryButton: { backgroundColor: colors.black, boxShadow: '3px 3px 0px #000000' },
  destructiveButton: { backgroundColor: '#FFF7F6', borderColor: colors.danger, borderWidth: 1.5 },
  confirmButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  destructiveButtonText: { color: colors.danger },
  disabledButton: { opacity: 0.4 },
});
