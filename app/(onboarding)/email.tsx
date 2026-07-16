import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { requestEmailOtp, verifyEmailOtp } from '@/src/features/auth/api/authRepository';
import { validateEmail, validateEmailOtp } from '@/src/features/auth/model/emailOtp';
import { Screen } from '@/src/components/layout/Screen';
import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { colors, radius, spacing } from '@/src/design/tokens';

type Step = 'email' | 'otp';

export default function EmailOnboardingScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const router = useRouter();
  const emailValidation = validateEmail(email);
  const isOtpValid = validateEmailOtp(otp);

  const requestOtpMutation = useMutation({
    mutationFn: async () => {
      if (!emailValidation.isValid) throw new Error('invalid_email');
      await requestEmailOtp(emailValidation.value);
    },
    onSuccess: () => {
      setHasSubmitted(false);
      setOtp('');
      setStep('otp');
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async () => {
      if (!emailValidation.isValid || !isOtpValid) throw new Error('invalid_email_otp');
      await verifyEmailOtp(emailValidation.value, otp.trim());
    },
    onSuccess: () => router.replace('/(onboarding)/nickname'),
  });

  const handleRequestOtp = (): void => {
    setHasSubmitted(true);
    if (emailValidation.isValid) requestOtpMutation.mutate();
  };

  const handleVerifyOtp = (): void => {
    setHasSubmitted(true);
    if (emailValidation.isValid && isOtpValid) verifyOtpMutation.mutate();
  };

  const returnToEmail = (): void => {
    requestOtpMutation.reset();
    verifyOtpMutation.reset();
    setHasSubmitted(false);
    setOtp('');
    setStep('email');
  };

  const showEmailValidation = step === 'email' && hasSubmitted && !emailValidation.isValid;
  const showOtpValidation = step === 'otp' && hasSubmitted && !isOtpValid;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', default: undefined })}>
      <Screen contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'email' ? (
          <>
            <View style={styles.copy}>
              <AppText variant="caption">나만의 컬러 다이어리</AppText>
              <AppText variant="title1">이메일로 시작해요</AppText>
              <AppText color="secondary">비밀번호 없이 6자리 인증번호로 안전하게 로그인할 수 있어요.</AppText>
            </View>
            <View style={styles.form}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                accessibilityLabel="이메일 주소"
                style={[styles.input, showEmailValidation && styles.inputError]}
              />
              {showEmailValidation ? <AppText variant="caption" style={styles.errorText}>{emailValidation.message}</AppText> : null}
              {requestOtpMutation.isError ? <AppText variant="caption" style={styles.errorText}>인증번호를 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.</AppText> : null}
            </View>
            <View style={styles.bottom}>
              <AppText variant="caption" color="secondary">입력한 이메일은 계정 복구와 로그인에만 사용해요.</AppText>
              <Button label={requestOtpMutation.isPending ? '보내는 중…' : '인증번호 받기'} onPress={handleRequestOtp} disabled={requestOtpMutation.isPending} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.copy}>
              <AppText variant="caption">이메일 인증</AppText>
              <AppText variant="title1">인증번호를 입력해 주세요</AppText>
              <AppText color="secondary">{emailValidation.isValid ? emailValidation.value : '입력한 이메일'}로 보낸 6자리 코드예요.</AppText>
            </View>
            <View style={styles.form}>
              <TextInput
                value={otp}
                onChangeText={setOtp}
                placeholder="000000"
                placeholderTextColor={colors.textTertiary}
                autoComplete="one-time-code"
                keyboardType="number-pad"
                maxLength={6}
                textContentType="oneTimeCode"
                accessibilityLabel="6자리 이메일 인증번호"
                style={[styles.input, styles.otpInput, showOtpValidation && styles.inputError]}
              />
              {showOtpValidation ? <AppText variant="caption" style={styles.errorText}>6자리 숫자를 입력해 주세요.</AppText> : null}
              {verifyOtpMutation.isError ? <AppText variant="caption" style={styles.errorText}>인증번호가 맞지 않거나 만료됐어요. 다시 확인해 주세요.</AppText> : null}
            </View>
            <View style={styles.bottom}>
              <Button label="이메일 주소 바꾸기" variant="secondary" onPress={returnToEmail} disabled={verifyOtpMutation.isPending} />
              <Button label={verifyOtpMutation.isPending ? '확인하는 중…' : '인증하고 계속하기'} onPress={handleVerifyOtp} disabled={verifyOtpMutation.isPending} />
            </View>
          </>
        )}
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
  otpInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger },
  bottom: { gap: spacing[3] },
});
