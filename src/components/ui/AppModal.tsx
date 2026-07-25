import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing } from '@/src/design/tokens';
import { useOptionalAppLanguage } from '@/src/lib/localization/LanguageProvider';

type AppModalProps = {
  accessibilityLabel: string;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  dismissible?: boolean;
  isBusy?: boolean;
  onClose: () => void;
  visible: boolean;
};

export function AppModal({ accessibilityLabel, children, contentStyle, dismissible = true, isBusy = false, onClose, visible }: AppModalProps) {
  const theme = useAppTheme();
  const { t } = useOptionalAppLanguage();
  const canDismiss = dismissible && !isBusy;
  const close = (): void => {
    if (canDismiss) onClose();
  };

  return (
    <Modal animationType="fade" onRequestClose={close} statusBarTranslucent transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <Pressable accessibilityLabel={t(accessibilityLabel)} accessibilityRole="button" accessibilityState={{ disabled: !canDismiss }} disabled={!canDismiss} onPress={close} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.ink, boxShadow: `7px 7px 0px ${theme.colors.black}` }, contentStyle]}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing[4] },
  card: { borderWidth: 2, maxWidth: 390, width: '100%' },
});
