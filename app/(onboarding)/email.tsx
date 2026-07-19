import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { useMutation } from '@tanstack/react-query';
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
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { signInWithEmailPassword, signUpWithEmailPassword } from '@/src/features/auth/api/authRepository';
import { getAuthErrorMessage, type AppAuthErrorCode } from '@/src/features/auth/model/authErrors';
import { validateEmail, validatePassword, validatePasswordConfirmation } from '@/src/features/auth/model/emailPassword';
import { getAuthenticatedDestination } from '@/src/features/auth/model/startupRoute';
import { getProfile } from '@/src/features/profile/api/profileRepository';
import { getInviteCodeFromParam } from '@/src/features/rooms/model/roomInviteLink';

type AuthMode = 'sign-in' | 'sign-up';

export default function EmailOnboardingScreen() {
  const [mode, setMode] = useState<AuthMode>('sign-up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { inviteCode: inviteCodeParam } = useLocalSearchParams<{ inviteCode?: string | string[] }>();
  const inviteCode = getInviteCodeFromParam(inviteCodeParam);
  const isSignUp = mode === 'sign-up';
  const emailValidation = validateEmail(email);
  const passwordValidation = validatePassword(password);
  const confirmationValidation = validatePasswordConfirmation(password, passwordConfirmation);
  const isFormValid = emailValidation.isValid
    && passwordValidation.isValid
    && (!isSignUp || confirmationValidation.isValid);

  const authMutation = useMutation({
    mutationFn: async () => {
      if (!isFormValid) throw new Error('invalid_credentials');
      const session = isSignUp
        ? await signUpWithEmailPassword(emailValidation.value, passwordValidation.value)
        : await signInWithEmailPassword(emailValidation.value, passwordValidation.value);
      const profile = await getProfile(session.user.id);
      return getAuthenticatedDestination(profile);
    },
    onSuccess: (destination) => {
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
    setMode((current) => current === 'sign-up' ? 'sign-in' : 'sign-up');
  };

  const formError = getFormError({
    confirmationValidation,
    emailValidation,
    hasSubmitted,
    isSignUp,
    passwordValidation,
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
              boldFontFamily={boldFontFamily}
              confirmationValidation={confirmationValidation}
              email={email}
              emailValidation={emailValidation}
              fontFamily={fontFamily}
              formError={formError}
              hasSubmitted={hasSubmitted}
              mutationError={mutationError}
              onChangeEmail={setEmail}
              onChangePassword={setPassword}
              onChangePasswordConfirmation={setPasswordConfirmation}
              onSubmit={handleSubmit}
              onSwitchMode={switchMode}
              password={password}
              passwordConfirmation={passwordConfirmation}
              passwordValidation={passwordValidation}
              pending={authMutation.isPending}
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
};

type SignupFormProps = FormSharedProps & {
  confirmationValidation: ReturnType<typeof validatePasswordConfirmation>;
  onChangePasswordConfirmation: (value: string) => void;
  passwordConfirmation: string;
};

function SignupForm({
  boldFontFamily,
  confirmationValidation,
  email,
  emailValidation,
  fontFamily,
  formError,
  hasSubmitted,
  mutationError,
  onChangeEmail,
  onChangePassword,
  onChangePasswordConfirmation,
  onSubmit,
  onSwitchMode,
  password,
  passwordConfirmation,
  passwordValidation,
  pending,
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
          label="Email Address"
          onChangeText={onChangeEmail}
          placeholder="you@doodle.app"
          textContentType="emailAddress"
          value={email}
        />
        <ScribbleField
          autoComplete="new-password"
          error={hasSubmitted && !passwordValidation.isValid}
          icon={<LockIcon />}
          label="Secret Scribble"
          onChangeText={onChangePassword}
          placeholder="••••••••"
          secureTextEntry
          textContentType="newPassword"
          value={password}
        />
        <ScribbleField
          autoComplete="new-password"
          error={hasSubmitted && !confirmationValidation.isValid}
          icon={<TraceIcon />}
          label="Trace it Again"
          onChangeText={onChangePasswordConfirmation}
          onSubmitEditing={onSubmit}
          placeholder="••••••••"
          returnKeyType="done"
          secureTextEntry
          textContentType="newPassword"
          value={passwordConfirmation}
        />
      </View>

      <FormErrors formError={formError} mutationError={mutationError} />
      <SketchActionButton label={pending ? 'Saving…' : 'Next'} onPress={onSubmit} pending={pending} />
      <View style={styles.signupSwitchRow}>
        <AppText style={styles.switchCaption}>Already have a pen name? </AppText>
        <Pressable accessibilityLabel="로그인 화면으로 전환" accessibilityRole="button" hitSlop={8} onPress={onSwitchMode}>
          <AppText style={styles.switchCaption}>Log in</AppText>
        </Pressable>
      </View>
      <DoodleRow />
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
}: FormSharedProps) {
  return (
    <View style={styles.loginCard}>
      <View style={styles.loginBrandGroup}>
        <View style={styles.loginBrandTape}>
          <AppText style={[styles.loginBrand, { fontFamily: boldFontFamily }]}>Color Log</AppText>
          <StarIcon size={17} style={styles.loginStar} />
        </View>
        <AppText style={[styles.loginTagline, { fontFamily }]}>CAPTURE YOUR TODAY&apos;S LIGHT</AppText>
      </View>

      <View style={styles.loginFields}>
        <ScribbleField
          autoCapitalize="none"
          autoComplete="email"
          error={hasSubmitted && !emailValidation.isValid}
          icon={<PenIcon />}
          keyboardType="email-address"
          label="Your ID"
          onChangeText={onChangeEmail}
          placeholder="scribble your id here..."
          textContentType="emailAddress"
          value={email}
        />
        <ScribbleField
          autoComplete="password"
          error={hasSubmitted && !passwordValidation.isValid}
          icon={<LockIcon />}
          label="Secret Password"
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
      <SketchActionButton label={pending ? 'Loading…' : 'Login'} onPress={onSubmit} pending={pending} />
      <View style={styles.loginUtilityRow}>
        <Pressable accessibilityLabel="회원가입 화면으로 전환" accessibilityRole="button" hitSlop={8} onPress={onSwitchMode}>
          <AppText style={styles.loginUtility}>Sign Up</AppText>
        </Pressable>
        <View style={styles.utilityDot} />
        <AppText style={styles.loginUtility}>Lost your light? Owd PW</AppText>
      </View>
      <DoodleRow login />
    </View>
  );
}

type ScribbleFieldProps = {
  autoCapitalize?: 'none';
  autoComplete: 'email' | 'new-password' | 'password';
  error: boolean;
  icon: React.ReactNode;
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
          secureTextEntry={secureTextEntry}
          style={styles.input}
          textContentType={textContentType}
          value={value}
        />
        <View pointerEvents="none" style={styles.inputIcon}>{icon}</View>
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
      <PenIcon color="#000000" />
      <AppText style={[styles.headerWordmark, { fontFamily }]}>Oneul-Bit</AppText>
      <GearIcon />
    </View>
  );
}

function DoodleRow({ login = false }: { login?: boolean }) {
  return (
    <View style={[styles.doodleRow, login && styles.loginDoodleRow]} accessibilityLabel="손그림 장식">
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

function LockIcon() {
  return <Svg height={19} viewBox="0 0 24 24" width={19}><Rect fill="none" height={11} rx={0.8} stroke="#777777" strokeWidth={1.35} width={13} x={5.5} y={10} /><Path d="M8.5 10V7.7a3.5 3.5 0 0 1 7 0V10" fill="none" stroke="#777777" strokeLinecap="round" strokeWidth={1.35} /></Svg>;
}

function TraceIcon() {
  return <Svg height={19} viewBox="0 0 24 24" width={19}><Path d="m4 4 16 16M7 17.5h8.6A2.4 2.4 0 0 0 18 15.1V10" fill="none" stroke="#777777" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.35} /><Path d="M6 11V8.4A2.4 2.4 0 0 1 8.4 6h7.2A2.4 2.4 0 0 1 18 8.4V10" fill="none" stroke="#777777" strokeLinecap="round" strokeWidth={1.35} /></Svg>;
}

function PenIcon({ color = '#000000' }: { color?: string }) {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="m5 19 2.2-.6L18.5 7.1 16.9 5.5 5.6 16.8 5 19Zm12.7-13.5 1.1-1.1a1.1 1.1 0 0 1 1.6 1.6l-1.1 1.1-1.6-1.6Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} /></Svg>;
}

function GearIcon() {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Circle cx={12} cy={12} fill="none" r={3} stroke="#000000" strokeWidth={1.6} /><Path d="M12 3.8v1.7m0 13v1.7m8.2-8.2h-1.7m-13 0H3.8m14-5.8-1.2 1.2m-9.2 9.2-1.2 1.2m0-10.4 1.2 1.2m9.2 9.2 1.2 1.2" fill="none" stroke="#000000" strokeLinecap="round" strokeWidth={1.6} /></Svg>;
}

function PaletteIcon({ color }: { color: string }) {
  return <Svg height={19} viewBox="0 0 24 24" width={19}><Path d="M20 12a8 8 0 1 0-8 8h1.2c1.1 0 1.5-1.4.6-2.1-.9-.7-.4-2.1.8-2.1H16a4 4 0 0 0 4-3.8Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.35} /><Circle cx={7.5} cy={11} fill={color} r={1} /><Circle cx={10.5} cy={7.8} fill={color} r={1} /><Circle cx={14.6} cy={8.5} fill={color} r={1} /></Svg>;
}

function HeartIcon() {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="M20 8.6c0 4-8 9.3-8 9.3S4 12.6 4 8.6A4.1 4.1 0 0 1 11.4 6L12 6.7l.6-.7A4.1 4.1 0 0 1 20 8.6Z" fill="none" stroke="#707070" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.35} /></Svg>;
}

type FormErrorInput = {
  confirmationValidation: ReturnType<typeof validatePasswordConfirmation>;
  emailValidation: ReturnType<typeof validateEmail>;
  hasSubmitted: boolean;
  isSignUp: boolean;
  passwordValidation: ReturnType<typeof validatePassword>;
};

function getFormError({ confirmationValidation, emailValidation, hasSubmitted, isSignUp, passwordValidation }: FormErrorInput): string | null {
  if (!hasSubmitted) return null;
  if (!emailValidation.isValid) return emailValidation.message;
  if (!passwordValidation.isValid) return passwordValidation.message;
  if (isSignUp && !confirmationValidation.isValid) return confirmationValidation.message;
  return null;
}

function getMutationError(error: Error | null, isSignUp: boolean): string | null {
  if (!error) return null;
  return getAuthErrorMessage(error.message as AppAuthErrorCode, isSignUp);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { backgroundColor: '#FFFFFF', flex: 1 },
  signupHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#000000',
    borderBottomWidth: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
    paddingBottom: 8,
    paddingHorizontal: 16,
    boxShadow: '5px 5px 0px #000000',
  },
  headerWordmark: { color: '#000000', fontSize: 24, fontWeight: '800', letterSpacing: -1, lineHeight: 29, transform: [{ rotate: '-1deg' }] },
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
  inputFrame: { borderColor: '#8D8D89', borderWidth: 1, minHeight: 48, position: 'relative', transform: [{ rotate: '-0.4deg' }] },
  inputFrameError: { borderColor: '#B74747', borderWidth: 1.5 },
  input: { color: '#000000', fontFamily: Platform.select({ ios: 'Karla', android: 'sans-serif', default: 'sans-serif' }), fontSize: 16, minHeight: 46, paddingHorizontal: 12, paddingRight: 46 },
  inputIcon: { alignItems: 'center', bottom: 0, justifyContent: 'center', position: 'absolute', right: 14, top: 0 },
  atIcon: { color: '#777777', fontSize: 21, lineHeight: 22 },
  errorText: { color: '#B74747', fontSize: 12, lineHeight: 17, marginTop: 12, textAlign: 'center' },
  actionButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#000000', borderWidth: 1.25, boxShadow: '4px 4px 0px #000000', flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 24, minHeight: 52 },
  actionButtonPressed: { boxShadow: '1px 1px 0px #000000', transform: [{ translateX: 2 }, { translateY: 2 }] },
  actionButtonDisabled: { opacity: 0.55 },
  actionText: { color: '#000000', fontFamily: 'BricolageGrotesque_700Bold', fontSize: 22, fontWeight: '700', lineHeight: 27 },
  signupSwitchRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  switchCaption: { color: '#111111', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 9, lineHeight: 13 },
  doodleRow: { alignItems: 'center', flexDirection: 'row', gap: 24, justifyContent: 'center', marginTop: 24 },
  loginContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 40, paddingTop: 32 },
  loginCard: { width: '100%' },
  loginBrandGroup: { alignItems: 'center', marginBottom: 44 },
  loginBrandTape: { alignItems: 'center', borderColor: '#000000', borderWidth: 1.2, height: 38, justifyContent: 'center', paddingHorizontal: 18, position: 'relative', transform: [{ rotate: '-1.2deg' }] },
  loginBrand: { color: '#000000', fontSize: 22, fontWeight: '700', letterSpacing: -0.5, lineHeight: 27 },
  loginStar: { position: 'absolute', right: -12, top: 27 },
  loginTagline: { color: '#707070', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 8, letterSpacing: 0.25, marginTop: 34, textAlign: 'center' },
  loginFields: { gap: 16 },
  loginUtilityRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  loginUtility: { color: '#444444', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 8, fontStyle: 'italic', lineHeight: 12 },
  utilityDot: { backgroundColor: '#000000', borderRadius: 2, height: 4, width: 4 },
  loginDoodleRow: { marginTop: 52 },
});
