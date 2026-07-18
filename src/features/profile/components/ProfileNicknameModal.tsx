import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { colors } from '@/src/design/tokens';
import { validateNickname } from '@/src/features/profile/model/profile';

type ProfileNicknameModalProps = {
  isSaving: boolean;
  nickname: string;
  onClose: () => void;
  onSave: (nickname: string) => void;
  visible: boolean;
};

export function ProfileNicknameModal({ isSaving, nickname, onClose, onSave, visible }: ProfileNicknameModalProps) {
  return (
    <Modal animationType="fade" onRequestClose={() => !isSaving && onClose()} statusBarTranslucent transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="닉네임 수정 닫기" disabled={isSaving} onPress={onClose} style={StyleSheet.absoluteFill} />
        <NicknameForm key={`${nickname}:${visible ? 'open' : 'closed'}`} isSaving={isSaving} nickname={nickname} onClose={onClose} onSave={onSave} />
      </View>
    </Modal>
  );
}

function NicknameForm({ isSaving, nickname, onClose, onSave }: Omit<ProfileNicknameModalProps, 'visible'>) {
  const nicknameRef = useRef(nickname);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const save = (): void => {
    const validation = validateNickname(nicknameRef.current);
    if (!validation.isValid) {
      setValidationMessage(validation.message);
      return;
    }

    setValidationMessage(null);
    onSave(validation.value);
  };

  return (
    <View accessibilityViewIsModal style={styles.card}>
      <View style={styles.header}>
        <View>
          <AppText style={styles.eyebrow}>PROFILE EDIT</AppText>
          <AppText style={styles.title}>나를 부를 이름</AppText>
        </View>
        <Pressable accessibilityLabel="닉네임 수정 닫기" accessibilityRole="button" disabled={isSaving} onPress={onClose} style={styles.closeButton}><AppText style={styles.closeText}>×</AppText></Pressable>
      </View>
      <AppText style={styles.description}>친구방에서 이 이름으로 보여요. 2~12자로 입력해 주세요.</AppText>
      <TextInput
        accessibilityLabel="새 닉네임"
        autoFocus
        defaultValue={nickname}
        editable={!isSaving}
        maxLength={12}
        onChangeText={(value) => {
          nicknameRef.current = value;
          if (validationMessage) setValidationMessage(null);
        }}
        onSubmitEditing={save}
        placeholder="닉네임"
        placeholderTextColor="rgba(0, 0, 0, 0.38)"
        returnKeyType="done"
        style={styles.input}
      />
      {validationMessage ? <AppText accessibilityLiveRegion="polite" style={styles.errorText}>{validationMessage}</AppText> : null}
      <Pressable accessibilityLabel="닉네임 저장" accessibilityRole="button" accessibilityState={{ disabled: isSaving }} disabled={isSaving} onPress={save} style={[styles.saveButton, isSaving && styles.disabledButton]}>
        <AppText style={styles.saveButtonText}>{isSaving ? '저장 중…' : '저장하기'}</AppText>
      </Pressable>
      {Platform.OS === 'ios' ? <AppText style={styles.hint}>완료를 누르거나 저장하기를 눌러 반영할 수 있어요.</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.54)', flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.white, borderColor: colors.black, borderWidth: 2, boxShadow: '7px 7px 0px #000000', gap: 14, maxWidth: 390, padding: 20, width: '100%' },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: 'rgba(0, 0, 0, 0.58)', fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.9 },
  title: { color: colors.black, fontSize: 23, fontWeight: '800', letterSpacing: -0.65, lineHeight: 30, marginTop: 3 },
  closeButton: { alignItems: 'center', borderColor: colors.black, borderWidth: 1.5, height: 38, justifyContent: 'center', width: 38 },
  closeText: { color: colors.black, fontSize: 28, fontWeight: '300', lineHeight: 31 },
  description: { color: 'rgba(0, 0, 0, 0.68)', fontSize: 14, lineHeight: 21 },
  input: { backgroundColor: colors.white, borderColor: colors.black, borderWidth: 1.5, color: colors.black, fontSize: 18, minHeight: 52, paddingHorizontal: 13, paddingVertical: 10 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: -6 },
  saveButton: { alignItems: 'center', backgroundColor: colors.black, boxShadow: '3px 3px 0px #000000', justifyContent: 'center', minHeight: 50, paddingHorizontal: 16 },
  saveButtonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  disabledButton: { opacity: 0.5 },
  hint: { color: 'rgba(0, 0, 0, 0.52)', fontSize: 10, lineHeight: 14, textAlign: 'center' },
});
