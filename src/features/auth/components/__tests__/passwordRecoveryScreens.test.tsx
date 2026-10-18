import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { requestPasswordReset } from '@/src/features/auth/api/passwordRecoveryRepository';
import { passwordRecoveryFlow } from '@/src/features/auth/model/passwordRecoveryIntent';
import { ForgotPasswordScreen } from '../ForgotPasswordScreen';
import { ResetPasswordScreen } from '../ResetPasswordScreen';

let mockParams: { recoveryId?: string } = {};
const mockReplace = jest.fn();
const mockUpdatePassword = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ replace: mockReplace }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/design/ThemeProvider', () => ({ useAppTheme: () => ({ colors: jest.requireActual('@/src/design/tokens').colors }) }));
jest.mock('@/src/lib/localization/LanguageProvider', () => {
  const language = {
    t: (text: string) => text,
    format: (text: string, values: Record<string, number | string>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key])),
  };
  return { useAppLanguage: () => language, useOptionalAppLanguage: () => language };
});
jest.mock('@/src/features/auth/api/passwordRecoveryRepository', () => ({
  requestPasswordReset: jest.fn().mockResolvedValue(undefined),
  createRecoveryConnection: () => ({
    authenticate: jest.fn().mockResolvedValue(undefined),
    updatePassword: (password: string) => mockUpdatePassword(password),
    dispose: jest.fn(),
  }),
}));

describe('password recovery screens', () => {
  let screen: ReactTestRenderer;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    mockParams = {};
  });
  afterEach(async () => {
    await act(async () => { screen?.unmount(); });
    passwordRecoveryFlow.clear(passwordRecoveryFlow.getSnapshot().id);
    jest.useRealTimers();
  });
  const button = (label: string) => screen.root.findAllByType(Button).find((node) => node.props.label === label)!;
  const hasText = (text: string) => screen.root.findAllByType(AppText).some((node) => node.props.children === text);

  it('validates email, prevents duplicate sends, and displays a resend cooldown', async () => {
    jest.useFakeTimers();
    await act(async () => { screen = create(<ForgotPasswordScreen />); });
    await act(async () => { button('재설정 메일 보내기').props.onPress(); });
    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(hasText('이메일 주소를 확인해 주세요.')).toBe(true);
    await act(async () => { screen.root.findByType(TextInput).props.onChangeText(' COLOR@Example.com '); });
    await act(async () => {
      const send = button('재설정 메일 보내기').props.onPress;
      send(); send();
    });
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    expect(requestPasswordReset).toHaveBeenCalledWith('color@example.com');
    expect(button('60초 후 다시 보내기').props.disabled).toBe(true);
    expect(hasText('해당 이메일로 가입된 계정이 있다면 재설정 메일을 보냈어요. 스팸함도 확인해 주세요.')).toBe(true);
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(button('메일 다시 보내기').props.disabled).toBe(false);
  });

  it('checks confirmation, updates through the verified flow, and removes the password fields on success', async () => {
    mockParams = { recoveryId: passwordRecoveryFlow.start({ kind: 'token-hash', tokenHash: 'screen-test' }) };
    await act(async () => { screen = create(<ResetPasswordScreen />); });
    await act(async () => {
      screen.root.findAllByType(TextInput)[0].props.onChangeText('new-password');
      screen.root.findAllByType(TextInput)[1].props.onChangeText('different');
    });
    await act(async () => { button('비밀번호 변경').props.onPress(); });
    expect(mockUpdatePassword).not.toHaveBeenCalled();
    expect(hasText('비밀번호가 서로 달라요.')).toBe(true);
    await act(async () => { screen.root.findAllByType(TextInput)[1].props.onChangeText('new-password'); });
    await act(async () => { button('비밀번호 변경').props.onPress(); });
    expect(mockUpdatePassword).toHaveBeenCalledWith('new-password');
    expect(screen.root.findAllByType(TextInput)).toHaveLength(0);
    expect(hasText('비밀번호를 변경했어요')).toBe(true);
    await act(async () => { button('로그인 화면으로 돌아가기').props.onPress(); });
    expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/email');
  });

  it('offers a fresh email instead of a password form for an expired link', async () => {
    mockParams = { recoveryId: passwordRecoveryFlow.start({ kind: 'invalid', reason: 'expired' }) };
    await act(async () => { screen = create(<ResetPasswordScreen />); });
    expect(screen.root.findAllByType(TextInput)).toHaveLength(0);
    await act(async () => { button('새 재설정 메일 요청').props.onPress(); });
    expect(mockReplace).toHaveBeenCalledWith('/auth/forgot-password');
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });
});
