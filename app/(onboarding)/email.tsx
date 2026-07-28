import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { signInWithEmailPassword, signUpWithEmailPassword } from '@/src/features/auth/api/authRepository';
import { getAgeEligibilityErrorMessage, validateMinimumSignUpAge } from '@/src/features/auth/model/ageEligibility';
import { getAuthErrorMessage, type AppAuthErrorCode } from '@/src/features/auth/model/authErrors';
import { validateEmail, validatePassword, validatePasswordConfirmation } from '@/src/features/auth/model/emailPassword';
import { getAuthenticatedDestination } from '@/src/features/auth/model/startupRoute';
import { getProfile } from '@/src/features/profile/api/profileRepository';
import { getInviteCodeFromParam } from '@/src/features/rooms/model/roomInviteLink';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';
import { queryKeys } from '@/src/lib/query/queryKeys';

type AuthMode = 'sign-in' | 'sign-up';

export default function EmailOnboardingScreen() {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const insets = useSafeAreaInsets();
  const { t } = useAppLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { inviteCode: inviteCodeParam } = useLocalSearchParams<{ inviteCode?: string | string[] }>();
  const inviteCode = getInviteCodeFromParam(inviteCodeParam);
  const isSignUp = mode === 'sign-up';
  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password);
  const confirmationValidation = validatePasswordConfirmation(password, passwordConfirmation);
  const ageEligibility = validateMinimumSignUpAge({ day: birthDay, month: birthMonth, year: birthYear });
  const isFormValid = emailValidation.isValid
    && passwordValidation.isValid
    && (!isSignUp || (confirmationValidation.isValid && ageEligibility.isEligible));

  const authMutation = useMutation({
    mutationFn: async () => {
      if (!isFormValid) throw new Error('invalid_credentials');
      const session = isSignUp
        ? await signUpWithEmailPassword(emailValidation.value, passwordValidation.value)
        : await signInWithEmailPassword(emailValidation.value, passwordValidation.value);
      const profile = await getProfile(session.user.id, session.access_token);
      return { destination: getAuthenticatedDestination(profile), profile, userId: session.user.id };
    },
    onSuccess: ({ destination, profile, userId }) => {
      queryClient.setQueryData(queryKeys.profile(userId), profile);
      if (!inviteCode) {
        router.replace(destination);
        return;
      }
      if (destination === '/(onboarding)/nickname') {
        router.replace({ pathname: '/(onboarding)/nickname', params: { inviteCode } });
        return;
      }
      router.replace({ pathname: '/(tabs)/room', params: { inviteCode } });
    },
  });

  const handleSubmit = (): void => {
    setHasSubmitted(true);
    if (isFormValid) authMutation.mutate();
  };

  const switchMode = (): void => {
    authMutation.reset();
    setHasSubmitted(false);
    setPassword('');
    setPasswordConfirmation('');
    setBirthYear('');
    setBirthMonth('');
    setBirthDay('');
    setMode((current) => current === 'sign-up' ? 'sign-in' : 'sign-up');
  };

  const formError = getFormError({
    ageEligibility,
    confirmationValidation,
    emailValidation,
    hasSubmitted,
    isSignUp,
    passwordValidation,
    t,
  });
  const mutationError = getMutationError(authMutation.error, isSignUp);
  const fontFamily = fontsLoaded ? 'BricolageGrotesque_400Regular' : undefined;
  const boldFontFamily = fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined;
  const heavyFontFamily = fontsLoaded ? 'BricolageGrotesque_800ExtraBold' : undefined;

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })} style={styles.flex}>
      <View style={styles.page}>
        {isSignUp ? (
          <SignupHeader fontFamily={heavyFontFamily} topInset={insets.top} />
        ) : null}

        <ScrollView
          contentContainerStyle={[
            isSignUp ? styles.signupContent : styles.loginContent,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isSignUp ? (
            <SignupForm
              ageEligibility={ageEligibility}
              boldFontFamily={boldFontFamily}
              birthDay={birthDay}
              birthMonth={birthMonth}
              birthYear={birthYear}
              confirmationValidation={confirmationValidation}
              email={email}
              emailValidation={emailValidation}
              fontFamily={fontFamily}
              formError={formError}
              hasSubmitted={hasSubmitted}
              mutationError={mutationError}
              onChangeEmail={setEmail}
              onChangeBirthDay={(value) => setBirthDay(sanitizeNumericInput(value, 2))}
              onChangeBirthMonth={(value) => setBirthMonth(sanitizeNumericInput(value, 2))}
              onChangeBirthYear={(value) => setBirthYear(sanitizeNumericInput(value, 4))}
              onChangePassword={setPassword}
              onChangePasswordConfirmation={setPasswordConfirmation}
              onSubmit={handleSubmit}
              onSwitchMode={switchMode}
              password={password}
              passwordConfirmation={passwordConfirmation}
              passwordValidation={passwordValidation}
              pending={authMutation.isPending}
              t={t}
            />
          ) : (
            <LoginForm
              boldFontFamily={boldFontFamily}
              email={email}
              emailValidation={emailValidation}
              fontFamily={fontFamily}
              formError={formError}
              hasSubmitted={hasSubmitted}
              mutationError={mutationError}
              onChangeEmail={setEmail}
              onChangePassword={setPassword}
              onSubmit={handleSubmit}
              onSwitchMode={switchMode}
              password={password}
              passwordValidation={passwordValidation}
              pending={authMutation.isPending}
              t={t}
            />
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

type FormSharedProps = {
  boldFontFamily: string | undefined;
  email: string;
  emailValidation: ReturnType<typeof validateEmail>;
  fontFamily: string | undefined;
  formError: string | null;
  hasSubmitted: boolean;
  mutationError: string | null;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onSubmit: () => void;
  onSwitchMode: () => void;
  password: string;
  passwordValidation: ReturnType<typeof validatePassword>;
  pending: boolean;
  t: (text: string) => string;
};

type SignupFormProps = FormSharedProps & {
  ageEligibility: ReturnType<typeof validateMinimumSignUpAge>;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  confirmationValidation: ReturnType<typeof validatePasswordConfirmation>;
  onChangeBirthDay: (value: string) => void;
  onChangeBirthMonth: (value: string) => void;
  onChangeBirthYear: (value: string) => void;
  onChangePasswordConfirmation: (value: string) => void;
  passwordConfirmation: string;
};

function SignupForm({
  ageEligibility,
  boldFontFamily,
  birthDay,
  birthMonth,
  birthYear,
  confirmationValidation,
  email,
  emailValidation,
  fontFamily,
  formError,
  hasSubmitted,
  mutationError,
  onChangeBirthDay,
  onChangeBirthMonth,
  onChangeBirthYear,
  onChangeEmail,
  onChangePassword,
  onChangePasswordConfirmation,
  onSubmit,
  onSwitchMode,
  password,
  passwordConfirmation,
  passwordValidation,
  pending,
  t,
}: SignupFormProps) {
  return (
    <View style={styles.signupCard}>
      <View pointerEvents="none" style={styles.tape}><View style={styles.tapeLine} /></View>
      <View style={styles.signupTitleGroup}>
        <View style={styles.signupTitleLine}>
          <AppText style={[styles.signupTitle, { fontFamily: boldFontFamily }]}>New Canvas</AppText>
          <StarIcon size={18} />
        </View>
        <AppText style={[styles.signupSubtitle, { fontFamily }]}>Every pixel begins with a single line...</AppText>
      </View>

      <View style={styles.signupFields}>
        <ScribbleField
          autoComplete="email"
          autoCapitalize="none"
          error={hasSubmitted && !emailValidation.isValid}
          icon={<AppText style={styles.atIcon}>@</AppText>}
          keyboardType="email-address"
          label={t('이메일 주소')}
          onChangeText={onChangeEmail}
          placeholder={t('이메일을 입력해 주세요.')}
          textContentType="emailAddress"
          value={email}
        />
        <ScribbleField
          autoComplete="new-password"
          error={hasSubmitted && !passwordValidation.isValid}
          label={t('비밀번호')}
          onChangeText={onChangePassword}
          placeholder="••••••••"
          secureTextEntry
          textContentType="newPassword"
          value={password}
        />
        <ScribbleField
          autoComplete="new-password"
          error={hasSubmitted && !confirmationValidation.isValid}
          label={t('비밀번호 확인')}
          onChangeText={onChangePasswordConfirmation}
          onSubmitEditing={onSubmit}
          placeholder="••••••••"
          returnKeyType="done"
          secureTextEntry
          textContentType="newPassword"
          value={passwordConfirmation}
        />
        <BirthDateFields
          day={birthDay}
          error={hasSubmitted && !ageEligibility.isEligible}
          month={birthMonth}
          onChangeDay={onChangeBirthDay}
          onChangeMonth={onChangeBirthMonth}
          onChangeYear={onChangeBirthYear}
          t={t}
          year={birthYear}
        />
      </View>

      <FormErrors formError={formError} mutationError={mutationError} />
      <SketchActionButton label={pending ? t('가입 중…') : t('회원가입')} onPress={onSubmit} pending={pending} />
      <View style={styles.signupSwitchRow}>
        <AppText style={styles.switchCaption}>이미 계정이 있나요? </AppText>
        <Pressable accessibilityLabel={t('로그인 화면으로 전환')} accessibilityRole="button" onPress={onSwitchMode} style={({ pressed }) => [styles.switchLinkButton, pressed && styles.switchLinkButtonPressed]}>
          <AppText style={[styles.switchCaption, styles.switchLinkText]}>로그인</AppText>
        </Pressable>
      </View>
      <DoodleRow />
    </View>
  );
}

type BirthDateFieldsProps = {
  day: string;
  error: boolean;
  month: string;
  onChangeDay: (value: string) => void;
  onChangeMonth: (value: string) => void;
  onChangeYear: (value: string) => void;
  t: (text: string) => string;
  year: string;
};

function BirthDateFields({
  day,
  error,
  month,
  onChangeDay,
  onChangeMonth,
  onChangeYear,
  t,
  year,
}: BirthDateFieldsProps) {
  return (
    <View style={styles.fieldGroup}>
      <AppText style={styles.fieldLabel}>{t('생년월일')}</AppText>
      <View style={styles.birthDateRow}>
        <BirthDateInput
          accessibilityLabel={t('생년월일 연도')}
          error={error}
          maximumLength={4}
          onChangeText={onChangeYear}
          placeholder="YYYY"
          style={styles.birthYearInputFrame}
          value={year}
        />
        <BirthDateInput
          accessibilityLabel={t('생년월일 월')}
          error={error}
          maximumLength={2}
          onChangeText={onChangeMonth}
          placeholder="MM"
          value={month}
        />
        <BirthDateInput
          accessibilityLabel={t('생년월일 일')}
          error={error}
          maximumLength={2}
          onChangeText={onChangeDay}
          placeholder="DD"
          value={day}
        />
      </View>
      <AppText style={styles.birthDateHint}>{t('만 14세 이상 여부만 확인하며 생년월일은 저장하지 않아요.')}</AppText>
    </View>
  );
}

type BirthDateInputProps = {
  accessibilityLabel: string;
  error: boolean;
  maximumLength: number;
  onChangeText: (value: string) => void;
  placeholder: string;
  style?: object;
  value: string;
};

function BirthDateInput({
  accessibilityLabel,
  error,
  maximumLength,
  onChangeText,
  placeholder,
  style,
  value,
}: BirthDateInputProps) {
  return (
    <View style={[styles.birthDateInputFrame, style, error && styles.inputFrameError]}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="YYYY, MM, DD"
        autoCorrect={false}
        keyboardType="number-pad"
        maxLength={maximumLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#71716E"
        style={styles.birthDateInput}
        value={value}
      />
    </View>
  );
}

function LoginForm({
  boldFontFamily,
  email,
  emailValidation,
  fontFamily,
  formError,
  hasSubmitted,
  mutationError,
  onChangeEmail,
  onChangePassword,
  onSubmit,
  onSwitchMode,
  password,
  passwordValidation,
  pending,
  t,
}: FormSharedProps) {
  return (
    <View style={styles.loginCard}>
      <View style={styles.loginBrandGroup}>
        <View style={styles.loginBrandTape}>
          <AppText style={[styles.loginBrand, { fontFamily: boldFontFamily }]}>Color Log</AppText>
          <StarIcon size={17} style={styles.loginStar} />
        </View>
        <AppText style={[styles.loginTagline, { fontFamily }]}>오늘의 빛을 기록해요</AppText>
      </View>

      <View style={styles.loginFields}>
        <ScribbleField
          autoCapitalize="none"
          autoComplete="email"
          error={hasSubmitted && !emailValidation.isValid}
          icon={<PenIcon />}
          keyboardType="email-address"
          label={t('이메일')}
          onChangeText={onChangeEmail}
          placeholder={t('이메일을 입력해 주세요.')}
          textContentType="emailAddress"
          value={email}
        />
        <ScribbleField
          autoComplete="password"
          error={hasSubmitted && !passwordValidation.isValid}
          label={t('비밀번호')}
          onChangeText={onChangePassword}
          onSubmitEditing={onSubmit}
          placeholder="••••••••"
          returnKeyType="done"
          secureTextEntry
          textContentType="password"
          value={password}
        />
      </View>

      <FormErrors formError={formError} mutationError={mutationError} />
      <SketchActionButton label={pending ? t('로그인 중…') : t('로그인')} onPress={onSubmit} pending={pending} />
      <View style={styles.loginUtilityRow}>
        <AppText style={styles.loginUtility}>처음이신가요? </AppText>
        <Pressable accessibilityLabel={t('회원가입 화면으로 전환')} accessibilityRole="button" onPress={onSwitchMode} style={({ pressed }) => [styles.loginUtilityLinkButton, pressed && styles.loginUtilityLinkButtonPressed]}>
          <AppText localize={false} numberOfLines={1} style={[styles.loginUtility, styles.loginUtilityLink]}>{t('회원가입')}</AppText>
        </Pressable>
      </View>
      <DoodleRow login />
    </View>
  );
}

type ScribbleFieldProps = {
  autoCapitalize?: 'none';
  autoComplete: 'email' | 'new-password' | 'password';
  error: boolean;
  icon?: React.ReactNode;
  keyboardType?: 'email-address';
  label: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  returnKeyType?: 'done';
  secureTextEntry?: boolean;
  textContentType: 'emailAddress' | 'newPassword' | 'password';
  value: string;
};

function ScribbleField({
  autoCapitalize,
  autoComplete,
  error,
  icon,
  keyboardType,
  label,
  onChangeText,
  onSubmitEditing,
  placeholder,
  returnKeyType,
  secureTextEntry,
  textContentType,
  value,
}: ScribbleFieldProps) {
  const { t } = useAppLanguage();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPasswordField = secureTextEntry === true;
  const visibilityLabel = isPasswordVisible ? t('비밀번호 숨기기') : t('비밀번호 표시');

  return (
    <View style={styles.fieldGroup}>
      <AppText style={styles.fieldLabel}>{label}</AppText>
      <View style={[styles.inputFrame, error && styles.inputFrameError]}>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor="#71716E"
          returnKeyType={returnKeyType}
          secureTextEntry={isPasswordField && !isPasswordVisible}
          style={styles.input}
          textContentType={textContentType}
          value={value}
        />
        {isPasswordField ? (
          <Pressable
            accessibilityLabel={visibilityLabel}
            accessibilityRole="button"
            accessibilityState={{ selected: isPasswordVisible }}
            hitSlop={4}
            onPress={() => setIsPasswordVisible((visible) => !visible)}
            style={({ pressed }) => [styles.passwordVisibilityButton, pressed && styles.passwordVisibilityButtonPressed]}
          >
            <PasswordVisibilityIcon isVisible={isPasswordVisible} />
          </Pressable>
        ) : icon ? <View pointerEvents="none" style={styles.inputIcon}>{icon}</View> : null}
      </View>
    </View>
  );
}

function FormErrors({ formError, mutationError }: { formError: string | null; mutationError: string | null }) {
  if (!formError && !mutationError) return null;
  return <AppText accessibilityLiveRegion="polite" style={styles.errorText}>{formError ?? mutationError}</AppText>;
}

function SketchActionButton({ label, onPress, pending }: { label: string; onPress: () => void; pending: boolean }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: pending, disabled: pending }}
      disabled={pending}
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pending && styles.actionButtonDisabled, pressed && !pending && styles.actionButtonPressed]}
    >
      <AppText style={styles.actionText}>{label}</AppText>
      <ArrowIcon />
    </Pressable>
  );
}

function SignupHeader({ fontFamily, topInset }: { fontFamily: string | undefined; topInset: number }) {
  return (
    <View style={[styles.signupHeader, { paddingTop: Math.max(topInset, 8) }]}>
      <View accessibilityLabel="Color Log" accessibilityRole="header" style={styles.headerWordmark}>
        {HEADER_WORDMARK_LETTERS.map(({ id, letter, offsetY, rotation }) => (
          <View
            key={id}
            style={[styles.headerWordmarkLetterWrap, { transform: [{ rotate: rotation }, { translateY: offsetY }] }, letter === ' ' ? styles.headerWordmarkGap : null]}>
            <AppText style={[styles.headerWordmarkLetter, { fontFamily }]}>{letter}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const HEADER_WORDMARK_LETTERS = [
  { id: 'color-c', letter: 'C', offsetY: 1, rotation: '-7deg' },
  { id: 'color-o', letter: 'O', offsetY: -1, rotation: '4deg' },
  { id: 'color-l', letter: 'L', offsetY: 2, rotation: '-4deg' },
  { id: 'color-o-second', letter: 'O', offsetY: -2, rotation: '6deg' },
  { id: 'color-r', letter: 'R', offsetY: 1, rotation: '-5deg' },
  { id: 'word-gap', letter: ' ', offsetY: 0, rotation: '0deg' },
  { id: 'log-l', letter: 'L', offsetY: -2, rotation: '5deg' },
  { id: 'log-o', letter: 'O', offsetY: 2, rotation: '-5deg' },
  { id: 'log-g', letter: 'G', offsetY: -1, rotation: '7deg' },
] as const;

function DoodleRow({ login = false }: { login?: boolean }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.doodleRow, login && styles.loginDoodleRow]}>
      {login ? <PaletteIcon color="#A2A2A2" /> : <HeartIcon />}
      {login ? <PenIcon color="#A2A2A2" /> : <PaletteIcon color="#7D7D7D" />}
      {login ? <StarIcon color="#A2A2A2" size={18} /> : <PenIcon color="#8D8D8D" />}
    </View>
  );
}

function ArrowIcon() {
  return <Svg height={23} viewBox="0 0 24 24" width={23}><Path d="M4 12h15m-5-5 5 5-5 5" fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} /></Svg>;
}

function StarIcon({ color = '#000000', size, style }: { color?: string; size: number; style?: object }) {
  return <View style={style}><Svg height={size} viewBox="0 0 24 24" width={size}><Path d="m12 3 2.1 5.9L20 9l-4.8 3.7 1.6 5.9-4.8-3.5-4.8 3.5 1.6-5.9L4 9l5.9-.1L12 3Z" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={1.6} /></Svg></View>;
}

function PasswordVisibilityIcon({ isVisible }: { isVisible: boolean }) {
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22}>
      <Path d="M2.5 12s3.4-5.7 9.5-5.7S21.5 12 21.5 12s-3.4 5.7-9.5 5.7S2.5 12 2.5 12Z" fill="none" stroke="#777777" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
      <Circle cx={12} cy={12} fill="none" r={2.6} stroke="#777777" strokeWidth={1.5} />
      {!isVisible ? <Path d="m4 4 16 16" fill="none" stroke="#777777" strokeLinecap="round" strokeWidth={1.7} /> : null}
    </Svg>
  );
}

function PenIcon({ color = '#000000' }: { color?: string }) {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="m5 19 2.2-.6L18.5 7.1 16.9 5.5 5.6 16.8 5 19Zm12.7-13.5 1.1-1.1a1.1 1.1 0 0 1 1.6 1.6l-1.1 1.1-1.6-1.6Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} /></Svg>;
}

function PaletteIcon({ color }: { color: string }) {
  return <Svg height={19} viewBox="0 0 24 24" width={19}><Path d="M20 12a8 8 0 1 0-8 8h1.2c1.1 0 1.5-1.4.6-2.1-.9-.7-.4-2.1.8-2.1H16a4 4 0 0 0 4-3.8Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.35} /><Circle cx={7.5} cy={11} fill={color} r={1} /><Circle cx={10.5} cy={7.8} fill={color} r={1} /><Circle cx={14.6} cy={8.5} fill={color} r={1} /></Svg>;
}

function HeartIcon() {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="M20 8.6c0 4-8 9.3-8 9.3S4 12.6 4 8.6A4.1 4.1 0 0 1 11.4 6L12 6.7l.6-.7A4.1 4.1 0 0 1 20 8.6Z" fill="none" stroke="#707070" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.35} /></Svg>;
}

type FormErrorInput = {
  ageEligibility: ReturnType<typeof validateMinimumSignUpAge>;
  confirmationValidation: ReturnType<typeof validatePasswordConfirmation>;
  emailValidation: ReturnType<typeof validateEmail>;
  hasSubmitted: boolean;
  isSignUp: boolean;
  passwordValidation: ReturnType<typeof validatePassword>;
  t: (text: string) => string;
};

function getFormError({ ageEligibility, confirmationValidation, emailValidation, hasSubmitted, isSignUp, passwordValidation, t }: FormErrorInput): string | null {
  if (!hasSubmitted) return null;
  if (!emailValidation.isValid) return emailValidation.message;
  if (!passwordValidation.isValid) return passwordValidation.message;
  if (isSignUp && !confirmationValidation.isValid) return confirmationValidation.message;
  if (isSignUp && !ageEligibility.isEligible) return t(getAgeEligibilityErrorMessage(ageEligibility));
  return null;
}

function getMutationError(error: Error | null, isSignUp: boolean): string | null {
  if (!error) return null;
  return getAuthErrorMessage(error.message as AppAuthErrorCode, isSignUp);
}

function sanitizeNumericInput(value: string, maximumLength: number): string {
  return value.replace(/\D/g, '').slice(0, maximumLength);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { backgroundColor: '#FFFFFF', flex: 1 },
  signupHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#000000',
    borderBottomWidth: 4,
    justifyContent: 'center',
    minHeight: 42,
    paddingBottom: 8,
    paddingHorizontal: 16,
    boxShadow: '5px 5px 0px #000000',
  },
  headerWordmark: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  headerWordmarkLetterWrap: { marginHorizontal: 1.5 },
  headerWordmarkLetter: { color: '#000000', fontSize: 19, fontWeight: '800', letterSpacing: 0.4, lineHeight: 24 },
  headerWordmarkGap: { marginHorizontal: 4, opacity: 0 },
  signupContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 40, paddingTop: 40 },
  signupCard: { backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 24, position: 'relative', transform: [{ rotate: '0.5deg' }], width: '100%' },
  tape: { alignItems: 'center', backgroundColor: '#F0F0EE', height: 40, justifyContent: 'center', left: '50%', position: 'absolute', top: -16, transform: [{ translateX: -56 }, { rotate: '-2deg' }], width: 112 },
  tapeLine: { backgroundColor: 'rgba(0, 0, 0, 0.12)', height: 1, width: '100%' },
  signupTitleGroup: { gap: 8, marginBottom: 24 },
  signupTitleLine: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  signupTitle: { color: '#000000', fontSize: 24, fontWeight: '700', lineHeight: 30 },
  signupSubtitle: { color: '#000000', fontSize: 16, fontStyle: 'italic', lineHeight: 22 },
  signupFields: { gap: 16 },
  fieldGroup: { gap: 8 },
  fieldLabel: { color: '#000000', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 9, fontWeight: '500', lineHeight: 12, marginLeft: 4 },
  birthDateRow: { flexDirection: 'row', gap: 8 },
  birthDateInputFrame: { borderColor: '#8D8D89', borderWidth: 1, flex: 1, minHeight: 48, transform: [{ rotate: '-0.4deg' }] },
  birthYearInputFrame: { flex: 1.45 },
  birthDateInput: { color: '#000000', fontFamily: Platform.select({ ios: 'Karla', android: 'sans-serif', default: 'sans-serif' }), fontSize: 16, minHeight: 46, paddingHorizontal: 8, textAlign: 'center' },
  birthDateHint: { color: '#5D5F5F', fontSize: 11, lineHeight: 16, marginLeft: 4 },
  inputFrame: { borderColor: '#8D8D89', borderWidth: 1, minHeight: 48, position: 'relative', transform: [{ rotate: '-0.4deg' }] },
  inputFrameError: { borderColor: '#B74747', borderWidth: 1.5 },
  input: { color: '#000000', fontFamily: Platform.select({ ios: 'Karla', android: 'sans-serif', default: 'sans-serif' }), fontSize: 16, minHeight: 46, paddingHorizontal: 12, paddingRight: 46 },
  inputIcon: { alignItems: 'center', bottom: 0, justifyContent: 'center', position: 'absolute', right: 14, top: 0 },
  passwordVisibilityButton: { alignItems: 'center', bottom: 0, justifyContent: 'center', minHeight: 44, position: 'absolute', right: 2, top: 0, width: 44 },
  passwordVisibilityButtonPressed: { opacity: 0.56 },
  atIcon: { color: '#777777', fontSize: 21, lineHeight: 22 },
  errorText: { color: '#B74747', fontSize: 12, lineHeight: 17, marginTop: 12, textAlign: 'center' },
  actionButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#000000', borderWidth: 1.25, boxShadow: '4px 4px 0px #000000', flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 24, minHeight: 52 },
  actionButtonPressed: { boxShadow: '1px 1px 0px #000000', transform: [{ translateX: 2 }, { translateY: 2 }] },
  actionButtonDisabled: { opacity: 0.55 },
  actionText: { color: '#000000', fontFamily: 'BricolageGrotesque_700Bold', fontSize: 22, fontWeight: '700', lineHeight: 27 },
  signupSwitchRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 12, minHeight: 44 },
  switchCaption: { color: '#111111', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 12, lineHeight: 17 },
  switchLinkButton: { alignItems: 'center', flexShrink: 0, justifyContent: 'center', marginHorizontal: -8, minHeight: 44, paddingHorizontal: 8 },
  switchLinkButtonPressed: { opacity: 0.56 },
  switchLinkText: { flexShrink: 0, fontWeight: '700', textDecorationLine: 'underline' },
  doodleRow: { alignItems: 'center', flexDirection: 'row', gap: 24, justifyContent: 'center', marginTop: 24 },
  loginContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 40, paddingTop: 32 },
  loginCard: { width: '100%' },
  loginBrandGroup: { alignItems: 'center', marginBottom: 44 },
  loginBrandTape: { alignItems: 'center', borderColor: '#000000', borderWidth: 1.2, height: 38, justifyContent: 'center', paddingHorizontal: 18, position: 'relative', transform: [{ rotate: '-1.2deg' }] },
  loginBrand: { color: '#000000', fontSize: 22, fontWeight: '700', letterSpacing: -0.5, lineHeight: 27 },
  loginStar: { position: 'absolute', right: -12, top: 27 },
  loginTagline: { color: '#707070', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 8, letterSpacing: 0.25, marginTop: 34, textAlign: 'center' },
  loginFields: { gap: 16 },
  loginUtilityRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 16, minHeight: 44 },
  loginUtility: { color: '#444444', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 12, fontStyle: 'italic', lineHeight: 17 },
  loginUtilityLink: { color: '#000000', flexShrink: 0, textDecorationLine: 'underline' },
  loginUtilityLinkButton: { alignItems: 'center', flexShrink: 0, justifyContent: 'center', minHeight: 44, paddingHorizontal: 8, width: 88 },
  loginUtilityLinkButtonPressed: { opacity: 0.56 },
  loginDoodleRow: { marginTop: 52 },
});
