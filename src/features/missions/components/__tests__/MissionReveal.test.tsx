import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, type AppStateStatus } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { AppText } from '@/src/components/ui/AppText';
import { playRevealHaptic } from '@/src/features/missions/api/revealHaptics';
import type { DailyMission, MissionRevealColor } from '@/src/features/missions/model/dailyMission';
import { MissionReveal } from '../MissionReveal';

const mockAnimations: ((finished: boolean) => void)[] = [];
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const native = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true, default: { View: native.View },
    Easing: { bezier: jest.fn() }, ReduceMotion: { Never: 'never' }, cancelAnimation: jest.fn(),
    useAnimatedStyle: (callback: () => object) => callback(),
    useSharedValue: (initial: number) => React.useRef({ value: initial, set(value: number) { this.value = value; } }).current,
    withTiming: (value: number, _: unknown, callback?: (finished: boolean) => void) => { if (callback) mockAnimations.push(callback); return value; },
  };
});
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (callback: () => void) => callback() }));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/src/features/missions/api/revealHaptics', () => ({ playRevealHaptic: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/src/design/ThemeProvider', () => ({ useAppTheme: () => ({ colors: jest.requireActual('@/src/design/tokens').colors }) }));
jest.mock('@/src/lib/localization/LanguageProvider', () => {
  const value = { language: 'ko', t: (text: string) => text, format: (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key: string) => values[key]) };
  return { useAppLanguage: () => value, useOptionalAppLanguage: () => value };
});

const palette: MissionRevealColor[] = Array.from({ length: 10 }, (_, i) => ({ id: `color-${i}`, slug: `color-${i}`, nameKo: '체리 레드', nameEn: 'Cherry Red', accent: '#D94A4A', onAccent: '#FFFFFF' }));
const mission: DailyMission = { id: 'mission', challengeDate: '2026-10-19', missionType: 'color', titleKo: '오늘의 체리 레드', promptKo: '오늘 스쳐 간 빨강을 찾아보세요.', publishedAt: '2026-10-18T15:00:00Z', source: 'scheduled', color: { ...palette[0], accentTint: '#F9E6E6', accentShade: '#8D2727' } };

describe('color reveal experience', () => {
  let screen: ReactTestRenderer;
  const onRevealed = jest.fn<Promise<void>, []>();
  const onContinue = jest.fn();
  const onStart = jest.fn();
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks(); mockAnimations.length = 0;
    onRevealed.mockResolvedValue(undefined);
  });
  afterEach(async () => { await act(async () => screen?.unmount()); jest.restoreAllMocks(); });
  const render = (reduceMotion = false, key = 'today') => <MissionReveal key={key} mission={mission} palette={palette} reduceMotion={reduceMotion} isNewDay onStart={onStart} onRevealed={onRevealed} onContinue={onContinue} />;
  const button = () => screen.root.findByType(Button);
  const hasText = (text: string) => screen.root.findAllByType(AppText).some((node) => node.props.children === text);

  it('keeps the result secret, prevents duplicate starts, then holds the color until Continue', async () => {
    await act(async () => { screen = create(render()); });
    expect(hasText('체리 레드')).toBe(false);
    expect(JSON.stringify(screen.toJSON())).not.toContain('오늘의 체리 레드 룰렛');
    await act(async () => { const start = button().props.onPress; start(); start(); });
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onRevealed).not.toHaveBeenCalled();
    await act(async () => { mockAnimations.shift()?.(true); });
    expect(onRevealed).toHaveBeenCalledTimes(1);
    expect(playRevealHaptic).toHaveBeenCalledTimes(1);
    expect(hasText('체리 레드')).toBe(true);
    expect(onContinue).not.toHaveBeenCalled();
    expect(button().props.label).toBe('이 색으로 기록하기');
    await act(async () => button().props.onPress());
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('uses a short fade without rotation or haptics for reduced motion', async () => {
    await act(async () => { screen = create(render(true)); });
    await act(async () => button().props.onPress());
    expect(mockAnimations).toHaveLength(0);
    expect(playRevealHaptic).not.toHaveBeenCalled();
    expect(hasText('체리 레드')).toBe(true);
    expect(onRevealed).toHaveBeenCalledTimes(1);
  });

  it('retries local persistence without replaying the animation or changing the color', async () => {
    onRevealed.mockRejectedValueOnce(new Error('storage_unavailable'));
    await act(async () => { screen = create(render(true)); });
    await act(async () => button().props.onPress());
    expect(button().props.label).toBe('다시 저장하기');
    expect(hasText('체리 레드')).toBe(true);
    await act(async () => button().props.onPress());
    expect(onRevealed).toHaveBeenCalledTimes(2);
    expect(button().props.label).toBe('이 색으로 기록하기');
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('ignores the old animation callback after midnight remounts the reveal', async () => {
    await act(async () => { screen = create(render()); });
    await act(async () => button().props.onPress());
    const finishYesterday = mockAnimations.shift();
    await act(async () => screen.update(render(false, 'tomorrow')));
    await act(async () => finishYesterday?.(true));
    expect(onRevealed).not.toHaveBeenCalled();
    expect(button().props.label).toBe('오늘의 색 열기');
  });

  it('settles an interrupted reveal in the background without a delayed haptic', async () => {
    let changeState: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => { changeState = listener; return { remove: jest.fn() }; });
    await act(async () => { screen = create(render()); });
    await act(async () => button().props.onPress());
    await act(async () => changeState?.('background'));
    expect(onRevealed).toHaveBeenCalledTimes(1);
    expect(playRevealHaptic).not.toHaveBeenCalled();
    await act(async () => mockAnimations.shift()?.(true));
    expect(onRevealed).toHaveBeenCalledTimes(1);
  });
});
