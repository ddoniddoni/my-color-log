import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useColorScheme } from 'react-native';

import { ThemeProvider, useAppTheme } from '../ThemeProvider';
import { getThemePreference, saveThemePreference, type ThemePreference } from '../themePreference';
import { colors, darkColors } from '../tokens';

jest.mock('../themePreference', () => ({ getThemePreference: jest.fn(), saveThemePreference: jest.fn() }));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/src/lib/logging/logger', () => ({ logError: jest.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('theme preference lifecycle', () => {
  let screen: ReactTestRenderer;
  let theme: ReturnType<typeof useAppTheme>;
  let saved: ThemePreference;
  function Consumer() { theme = useAppTheme(); return null; }
  const render = () => <ThemeProvider><Consumer /></ThemeProvider>;
  const mount = async () => { await act(async () => { screen = create(render()); }); };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.resetAllMocks();
    saved = 'system';
    jest.mocked(useColorScheme).mockReturnValue('light');
    jest.mocked(getThemePreference).mockImplementation(async () => saved);
    jest.mocked(saveThemePreference).mockImplementation(async (value) => { saved = value; });
  });
  afterEach(async () => { await act(async () => screen?.unmount()); });

  it('follows system changes only when system is selected, and restores the manual choice after restart', async () => {
    await mount();
    expect(theme!.colors).toBe(colors);
    jest.mocked(useColorScheme).mockReturnValue('dark');
    await act(async () => screen.update(render()));
    expect(theme!.colors).toBe(darkColors);
    await act(async () => theme.setPreference('light'));
    expect(theme!.resolvedTheme).toBe('light');
    await act(async () => screen.unmount());
    await mount();
    expect(theme!.preference).toBe('light');
    expect(theme!.colors).toBe(colors);
    await act(async () => theme.setPreference('system'));
    expect(theme!.colors).toBe(darkColors);
  });

  it('does not let a late initial read overwrite a newer selection', async () => {
    const read = deferred<ThemePreference>();
    jest.mocked(getThemePreference).mockReturnValue(read.promise);
    await mount();
    let save: Promise<void>;
    await act(async () => { save = theme.setPreference('dark'); });
    expect(theme!.resolvedTheme).toBe('dark');
    await act(async () => { read.resolve('light'); await save; });
    expect(theme!.preference).toBe('dark');
    expect(saved).toBe('dark');
    expect(theme!.isLoading).toBe(false);
  });

  it('falls back to the system on read failure and allows a later selection', async () => {
    jest.mocked(getThemePreference).mockRejectedValue(new Error('storage_unavailable'));
    jest.mocked(useColorScheme).mockReturnValue('dark');
    await mount();
    expect(theme!.isLoading).toBe(false);
    expect(theme!.preference).toBe('system');
    expect(theme!.colors).toBe(darkColors);
    await act(async () => theme.setPreference('light'));
    expect(saved).toBe('light');
  });

  it('rolls back a failed save to the persisted choice and supports retry', async () => {
    saved = 'dark';
    await mount();
    const write = deferred<void>();
    jest.mocked(saveThemePreference).mockReturnValueOnce(write.promise);
    let failure: Promise<unknown>;
    await act(async () => { failure = theme.setPreference('light').catch((error: unknown) => error); });
    expect(theme!.colors).toBe(colors);
    await act(async () => { write.reject(new Error('write_failed')); await failure; });
    expect(theme!.preference).toBe('dark');
    expect(saved).toBe('dark');
    await act(async () => theme.setPreference('light'));
    expect(saved).toBe('light');
  });

  it('serializes rapid saves so the last choice also wins after restart', async () => {
    await mount();
    const firstWrite = deferred<void>();
    jest.mocked(saveThemePreference).mockImplementationOnce(async (value) => {
      await firstWrite.promise;
      saved = value;
    });
    let first: Promise<void>;
    let second: Promise<void>;
    await act(async () => { first = theme.setPreference('dark'); second = theme.setPreference('light'); });
    expect(theme!.preference).toBe('light');
    await act(async () => { firstWrite.resolve(); await first; await second; });
    expect(saved).toBe('light');
    await act(async () => screen.unmount());
    await mount();
    expect(theme!.preference).toBe('light');
  });
});
