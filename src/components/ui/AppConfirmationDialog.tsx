import { Pressable, StyleSheet, View } from 'react-native';

import { AppModal } from '@/src/components/ui/AppModal';
import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing } from '@/src/design/tokens';
import { useOptionalAppLanguage } from '@/src/lib/localization/LanguageProvider';

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
  const theme = useAppTheme();
  const { t } = useOptionalAppLanguage();
  return (
    <AppModal accessibilityLabel={`${t(title)} ${t('닫기')}`} contentStyle={styles.card} isBusy={isBusy} onClose={onClose} visible={visible}>
      <View style={styles.copy}>
        <AppText style={[styles.eyebrow, { color: theme.colors.textSecondary }]}>{eyebrow}</AppText>
        <AppText accessibilityRole="header" style={[styles.title, { color: theme.colors.ink }]}>{title}</AppText>
        <AppText style={[styles.description, { color: theme.colors.textSecondary }]}>{description}</AppText>
      </View>
      <View style={styles.actions}>
        {cancelLabel ? (
          <Pressable accessibilityLabel={t(cancelLabel)} accessibilityRole="button" accessibilityState={{ disabled: isBusy }} disabled={isBusy} onPress={onClose} style={[styles.secondaryButton, { borderColor: theme.colors.ink }, isBusy && styles.disabledButton]}>
            <AppText style={[styles.secondaryButtonText, { color: theme.colors.ink }]}>{cancelLabel}</AppText>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel={t(confirmLabel)}
          accessibilityRole="button"
          accessibilityState={{ disabled: isBusy }}
          disabled={isBusy}
          onPress={onConfirm}
          style={[
            styles.confirmButton,
            tone === 'destructive'
              ? [styles.destructiveButton, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.danger }]
              : [styles.primaryButton, { backgroundColor: theme.colors.ink, boxShadow: `3px 3px 0px ${theme.colors.black}` }],
            isBusy && styles.disabledButton,
          ]}>
          <AppText style={[styles.confirmButtonText, { color: tone === 'destructive' ? theme.colors.danger : theme.colors.surface }]}>{confirmLabel}</AppText>
        </Pressable>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[5], padding: spacing[5] },
  copy: { gap: spacing[2] },
  eyebrow: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.9 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.7, lineHeight: 29 },
  description: { fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: spacing[2] },
  secondaryButton: { alignItems: 'center', borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing[3] },
  secondaryButtonText: { fontSize: 14, fontWeight: '800' },
  confirmButton: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing[3] },
  primaryButton: {},
  destructiveButton: { borderWidth: 1.5 },
  confirmButtonText: { fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.4 },
});
