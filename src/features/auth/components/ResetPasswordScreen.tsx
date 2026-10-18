import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { PasswordRecoveryForm, RecoveryErrorText, RecoveryInput } from '@/src/features/auth/components/PasswordRecoveryForm';
import { validatePassword, validatePasswordConfirmation } from '@/src/features/auth/model/emailPassword';
import { getRecoveryErrorMessage, type RecoveryError } from '@/src/features/auth/model/passwordRecovery';
import { passwordRecoveryFlow as flow } from '@/src/features/auth/model/passwordRecoveryIntent';

export function ResetPasswordScreen() {
  const { recoveryId } = useLocalSearchParams<{ recoveryId?: string | string[] }>();
  const id = typeof recoveryId === 'string' ? recoveryId : '';
  // A new incoming email clears the form instead of reusing a previous password.
  return <RecoveryAttempt key={id} id={id} />;
}

function RecoveryAttempt({ id }: { id: string }) {
  const snapshot = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const state = snapshot.id === id ? snapshot : null;
  const router = useRouter();
  const status = state?.status ?? 'idle';
  const editing = status === 'ready' || status === 'saving';

  useEffect(() => flow.retain(id), [id]);

  const leave = (destination: '/(onboarding)/email' | '/auth/forgot-password'): void => {
    flow.clear(id);
    router.replace(destination);
  };
  return (
    <PasswordRecoveryForm title={status === 'complete' ? '비밀번호를 변경했어요' : '새 비밀번호 설정'} description={status === 'complete' ? '새 비밀번호로 로그인해 기록을 이어가세요.' : '8자 이상의 새 비밀번호를 입력해 주세요.'}>
      {status === 'checking' ? <AppText accessibilityRole="progressbar" accessibilityLiveRegion="polite">재설정 링크를 확인하고 있어요…</AppText> : null}
      {editing ? <NewPasswordForm id={id} saving={status === 'saving'} error={state?.error ?? null} /> : null}
      {status === 'error' || status === 'idle' ? <>
        <RecoveryErrorText>{getRecoveryErrorMessage(state?.error ?? 'invalid')}</RecoveryErrorText>
        {state?.error === 'network' ? <Button label="다시 시도" onPress={() => flow.retry(id)} /> : null}
        <Button label="새 재설정 메일 요청" onPress={() => leave('/auth/forgot-password')} />
      </> : null}
      <Button variant="secondary" label="로그인 화면으로 돌아가기" disabled={status === 'saving'} onPress={() => leave('/(onboarding)/email')} />
    </PasswordRecoveryForm>
  );
}

function NewPasswordForm({ id, saving, error }: { id: string; saving: boolean; error: RecoveryError | null }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const message = validationError ?? (error ? getRecoveryErrorMessage(error) : null);

  const submit = (): void => {
    const validation = validatePassword(password);
    if (!validation.isValid) { setValidationError(validation.message); return; }
    const matching = validatePasswordConfirmation(password, confirmation);
    if (!matching.isValid) { setValidationError(matching.message); return; }
    setValidationError(null);
    // Completion unmounts this form, discarding both password fields.
    void flow.submit(id, password, confirmation);
  };

  return <>
    <RecoveryInput label="새 비밀번호" autoComplete="new-password" textContentType="newPassword" secureTextEntry value={password} onChangeText={setPassword} editable={!saving} error={message !== null} />
    <RecoveryInput label="새 비밀번호 확인" autoComplete="new-password" textContentType="newPassword" secureTextEntry value={confirmation} onChangeText={setConfirmation} editable={!saving} error={message !== null} onSubmitEditing={submit} returnKeyType="done" />
    {message ? <RecoveryErrorText>{message}</RecoveryErrorText> : null}
    <Button label={saving ? '비밀번호 변경 중…' : '비밀번호 변경'} accessibilityState={{ busy: saving }} disabled={saving} onPress={submit} />
  </>;
}
