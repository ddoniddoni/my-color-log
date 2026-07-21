import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing } from '@/src/design/tokens';

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
  const canDismiss = dismissible && !isBusy;
  const close = (): void => {
    if (canDismiss) onClose();
  };

  return (
    <Modal animationType="fade" onRequestClose={close} statusBarTranslucent transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" accessibilityState={{ disabled: !canDismiss }} disabled={!canDismiss} onPress={close} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.card, contentStyle]}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: colors.overlay, flex: 1, justifyContent: 'center', padding: spacing[4] },
  card: { backgroundColor: colors.white, borderColor: colors.black, borderWidth: 2, boxShadow: '7px 7px 0px #000000', maxWidth: 390, width: '100%' },
});
