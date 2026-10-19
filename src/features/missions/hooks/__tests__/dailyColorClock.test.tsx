import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useDailyColorClock } from '../useDailyColorClock';

let clock: ReturnType<typeof useDailyColorClock>;
function Harness() {
  const value = useDailyColorClock('Asia/Seoul');
  useEffect(() => { clock = value; }, [value]);
  return null;
}

describe('foreground midnight clock', () => {
  let screen: ReactTestRenderer;
  let changeState: (state: AppStateStatus) => void;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.useFakeTimers().setSystemTime(new Date('2026-10-18T14:59:59.500Z'));
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => { changeState = listener; return { remove: jest.fn() }; });
  });
  afterEach(async () => { await act(async () => screen?.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });
  it('switches exactly on the next whole second and refreshes immediately after sleep', async () => {
    await act(async () => { screen = create(<Harness />); });
    expect(clock.dateKey).toBe('2026-10-18');
    await act(async () => jest.advanceTimersByTime(500));
    expect(clock).toMatchObject({ dateKey: '2026-10-19', isNewDay: true, millisecondsUntilMidnight: 86_400_000 });
    await act(async () => changeState('background'));
    await act(async () => jest.advanceTimersByTime(120_000));
    expect(clock.millisecondsUntilMidnight).toBe(86_400_000);
    jest.setSystemTime(new Date('2026-10-21T15:00:00Z'));
    await act(async () => changeState('active'));
    expect(clock.dateKey).toBe('2026-10-22');
  });
  it('ignores a queued app-state callback after the screen unmounts', async () => {
    await act(async () => { screen = create(<Harness />); });
    const lastClock = clock;
    await act(async () => screen.unmount());
    jest.setSystemTime(new Date('2026-10-21T15:00:00Z'));
    await act(async () => { changeState('active'); jest.advanceTimersByTime(5_000); });
    expect(clock).toBe(lastClock);
  });
});
