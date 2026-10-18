import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { requestPasswordReset } from '@/src/features/auth/api/passwordRecoveryRepository';
import { PasswordRecoveryForm, RecoveryErrorText, RecoveryInput } from '@/src/features/auth/components/PasswordRecoveryForm';
import { validateEmail } from '@/src/features/auth/model/emailPassword';
import { getRecoveryError, getRecoveryErrorMessage } from '@/src/features/auth/model/passwordRecovery';
import { getInviteCodeFromParam } from '@/src/features/rooms/model/roomInviteLink';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const inFlight = useRef(false);
  const cooldownUntil = useRef(0);
  const router = useRouter();
  const { format } = useAppLanguage();
  const { inviteCode: param } = useLocalSearchParams<{ inviteCode?: string | string[] }>();
  const inviteCode = getInviteCodeFromParam(param);
  const coolingDown = remainingSeconds > 0;

  useEffect(() => {
    if (!coolingDown) return;
    const timer = setInterval(() => setRemainingSeconds(Math.max(0, Math.ceil((cooldownUntil.current - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [coolingDown]);

  const submit = async (): Promise<void> => {
    if (inFlight.current || cooldownUntil.current > Date.now()) return;
    const validation = validateEmail(email);
    if (!validation.isValid) { setError(validation.message); return; }
    inFlight.current = true;
    setPending(true);
    setError(null);
    setSent(false);
    try {
      await requestPasswordReset(validation.value);
      setSent(true);
      cooldownUntil.current = Date.now() + 60_000;
      setRemainingSeconds(60);
    } catch (cause) {
      const reason = getRecoveryError(cause);
      setError(getRecoveryErrorMessage(reason));
      if (reason === 'rate-limit') {
        cooldownUntil.current = Date.now() + 60_000;
        setRemainingSeconds(60);
      }
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <PasswordRecoveryForm title="비밀번호 재설정" description="가입한 이메일을 입력해 주세요. 새 비밀번호를 설정할 수 있는 링크를 보내드릴게요.">
      <RecoveryInput label="이메일 주소" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" value={email} onChangeText={setEmail} editable={!pending} onSubmitEditing={() => void submit()} returnKeyType="send" error={error !== null} />
      {sent ? <AppText accessibilityLiveRegion="polite">해당 이메일로 가입된 계정이 있다면 재설정 메일을 보냈어요. 스팸함도 확인해 주세요.</AppText> : null}
      {error ? <RecoveryErrorText>{error}</RecoveryErrorText> : null}
      <Button label={pending ? '메일 보내는 중…' : coolingDown ? format('{seconds}초 후 다시 보내기', { seconds: remainingSeconds }) : sent ? '메일 다시 보내기' : '재설정 메일 보내기'} disabled={pending || coolingDown} accessibilityState={{ busy: pending }} onPress={() => void submit()} />
      <Button variant="secondary" label="로그인 화면으로 돌아가기" disabled={pending} onPress={() => router.replace(inviteCode ? { pathname: '/(onboarding)/email', params: { inviteCode } } : '/(onboarding)/email')} />
    </PasswordRecoveryForm>
  );
}
