import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { getStoredSession } from '@/src/features/auth/api/authRepository';
import { completeProfile } from '@/src/features/profile/api/profileRepository';
import { validateNickname } from '@/src/features/profile/model/profile';
import { Screen } from '@/src/components/layout/Screen';
import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { colors, radius, spacing } from '@/src/design/tokens';
import { queryKeys } from '@/src/lib/query/queryKeys';

export default function NicknameScreen() {
  const [nickname, setNickname] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const validation = validateNickname(nickname);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!validation.isValid) throw new Error('invalid_nickname');
      const session = await getStoredSession();
      if (!session?.user) throw new Error('missing_authenticated_session');
      return completeProfile(session.user.id, validation.value);
    },
    onSuccess: async (profile) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile(profile.id) });
      router.replace('/(tabs)');
    },
  });

  const handleSubmit = (): void => {
    setHasSubmitted(true);
    if (validation.isValid) mutation.mutate();
  };
  const showValidation = hasSubmitted && !validation.isValid;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', default: undefined })}>
      <Screen contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.copy}><AppText variant="caption">나만의 컬러 다이어리</AppText><AppText variant="title1">어떻게 불러드릴까요?</AppText><AppText color="secondary">친구방에서 보여줄 닉네임이에요. 나중에 바꿀 수 있어요.</AppText></View>
        <View style={styles.form}>
          <TextInput value={nickname} onChangeText={setNickname} placeholder="닉네임" placeholderTextColor={colors.textTertiary} maxLength={12} autoFocus autoCapitalize="none" accessibilityLabel="닉네임" style={[styles.input, showValidation && styles.inputError]} />
          <View style={styles.meta}><AppText color={showValidation ? 'primary' : 'tertiary'} variant="caption">{showValidation ? validation.message : '2~12자'}</AppText><AppText color="tertiary" variant="caption">{nickname.trim().length}/12</AppText></View>
          {mutation.isError && hasSubmitted ? <AppText color="secondary">연결을 확인한 뒤 다시 시도해 주세요.</AppText> : null}
        </View>
        <View style={styles.bottom}><AppText variant="caption" color="secondary">이메일 계정으로 내 기록을 안전하게 이어갈 수 있어요.</AppText><Button label={mutation.isPending ? '시작하는 중…' : '시작하기'} onPress={handleSubmit} disabled={mutation.isPending} /></View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { justifyContent: 'space-between' },
  copy: { gap: spacing[3] },
  form: { gap: spacing[2] },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.textPrimary, fontSize: 16, paddingHorizontal: spacing[4] },
  inputError: { borderColor: colors.danger },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  bottom: { gap: spacing[4] },
});
