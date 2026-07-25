import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppModal } from '@/src/components/ui/AppModal';
import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { type ThemeColors } from '@/src/design/tokens';
import { validateNickname } from '@/src/features/profile/model/profile';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

type ProfileNicknameModalProps = {
  isSaving: boolean;
  nickname: string;
  onClose: () => void;
  onSave: (nickname: string) => void;
  visible: boolean;
};

export function ProfileNicknameModal({ isSaving, nickname, onClose, onSave, visible }: ProfileNicknameModalProps) {
  const styles = useProfileNicknameStyles();
  const { t } = useAppLanguage();
  return (
    <AppModal accessibilityLabel={t('닉네임 수정 닫기')} contentStyle={styles.card} isBusy={isSaving} onClose={onClose} visible={visible}>
      <NicknameForm key={`${nickname}:${visible ? 'open' : 'closed'}`} isSaving={isSaving} nickname={nickname} onClose={onClose} onSave={onSave} />
    </AppModal>
  );
}

function NicknameForm({ isSaving, nickname, onClose, onSave }: Omit<ProfileNicknameModalProps, 'visible'>) {
  const { colors } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useProfileNicknameStyles();
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
    <>
      <View style={styles.header}>
        <View>
          <AppText style={styles.eyebrow}>PROFILE EDIT</AppText>
          <AppText accessibilityRole="header" style={styles.title}>나를 부를 이름</AppText>
        </View>
        <Pressable accessibilityLabel={t('닉네임 수정 닫기')} accessibilityRole="button" accessibilityState={{ disabled: isSaving }} disabled={isSaving} onPress={onClose} style={styles.closeButton}><AppText style={styles.closeText}>×</AppText></Pressable>
      </View>
      <AppText style={styles.description}>친구방에서 이 이름으로 보여요. 2~12자로 입력해 주세요.</AppText>
      <TextInput
        accessibilityLabel={t('새 닉네임')}
        autoFocus
        defaultValue={nickname}
        editable={!isSaving}
        maxLength={12}
        onChangeText={(value) => {
          nicknameRef.current = value;
          if (validationMessage) setValidationMessage(null);
        }}
        onSubmitEditing={save}
        placeholder={t('닉네임')}
        placeholderTextColor={colors.textTertiary}
        returnKeyType="done"
        style={styles.input}
      />
      {validationMessage ? <AppText accessibilityLiveRegion="polite" style={styles.errorText}>{validationMessage}</AppText> : null}
      <Pressable accessibilityLabel={t('닉네임 저장')} accessibilityRole="button" accessibilityState={{ disabled: isSaving }} disabled={isSaving} onPress={save} style={[styles.saveButton, isSaving && styles.disabledButton]}>
        <AppText localize={false} style={styles.saveButtonText}>{isSaving ? t('저장 중…') : t('저장하기')}</AppText>
      </Pressable>
      {Platform.OS === 'ios' ? <AppText style={styles.hint}>완료를 누르거나 저장하기를 눌러 반영할 수 있어요.</AppText> : null}
    </>
  );
}

function useProfileNicknameStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: { gap: 14, padding: 20 },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.9 },
  title: { color: colors.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.65, lineHeight: 30, marginTop: 3 },
  closeButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, height: 44, justifyContent: 'center', width: 44 },
  closeText: { color: colors.ink, fontSize: 28, fontWeight: '300', lineHeight: 31 },
  description: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  input: { backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 1.5, color: colors.ink, fontSize: 18, minHeight: 52, paddingHorizontal: 13, paddingVertical: 10 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: -6 },
  saveButton: { alignItems: 'center', backgroundColor: colors.ink, boxShadow: `3px 3px 0px ${colors.black}`, justifyContent: 'center', minHeight: 50, paddingHorizontal: 16 },
  saveButtonText: { color: colors.surface, fontSize: 15, fontWeight: '800' },
  disabledButton: { opacity: 0.5 },
  hint: { color: colors.textSecondary, fontSize: 10, lineHeight: 14, textAlign: 'center' },
  });
}
