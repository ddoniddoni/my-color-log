import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';

import { hasRevealedMission, markMissionRevealed } from '../../api/revealRepository';
import { useMissionReveal } from '../useMissionReveal';
import { queryKeys } from '@/src/lib/query/queryKeys';

jest.mock('../../api/revealRepository', () => ({ hasRevealedMission: jest.fn(), markMissionRevealed: jest.fn() }));
let result: ReturnType<typeof useMissionReveal>;
function Harness({ userId, dateKey }: { userId: string; dateKey: string }) {
  const value = useMissionReveal(userId, dateKey);
  useEffect(() => { result = value; }, [value]);
  return null;
}
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });

describe('persisted reveal presentation', () => {
  let screen: ReactTestRenderer;
  let client: QueryClient;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    jest.mocked(hasRevealedMission).mockResolvedValue(false);
    jest.mocked(markMissionRevealed).mockResolvedValue(undefined);
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  });
  afterEach(async () => { await act(async () => screen?.unmount()); client.clear(); onlineManager.setOnline(true); });
  const render = (dateKey = '2026-10-19', userId = 'owner') => <QueryClientProvider client={client}><Harness userId={userId} dateKey={dateKey} /></QueryClientProvider>;

  it('saves offline and keeps the open result visible until the user continues', async () => {
    onlineManager.setOnline(false);
    await act(async () => { screen = create(render()); });
    await flush();
    expect(result.isLoading).toBe(false);
    await act(async () => result.begin());
    await act(async () => result.reveal());
    await flush();
    expect(markMissionRevealed).toHaveBeenCalledWith('owner', '2026-10-19');
    expect(result.isPresenting).toBe(true);
    await act(async () => result.dismiss());
    expect(result.isPresenting).toBe(false);
  });

  it('does not mark the next date or another account when an old write finishes late', async () => {
    let finish!: () => void;
    jest.mocked(markMissionRevealed).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await act(async () => { screen = create(render()); });
    await flush();
    let saving!: Promise<void>;
    await act(async () => { result.begin(); saving = result.reveal(); });
    await act(async () => screen.update(render('2026-10-20', 'friend')));
    await flush();
    await act(async () => { finish(); await saving; });
    expect(client.getQueryData(queryKeys.missionReveal('owner', '2026-10-19'))).toBe(true);
    expect(client.getQueryData(queryKeys.missionReveal('friend', '2026-10-20'))).toBe(false);
    expect(result.isPresenting).toBe(true);
  });

  it('skips the reveal when that account has already opened today’s color', async () => {
    jest.mocked(hasRevealedMission).mockResolvedValue(true);
    await act(async () => { screen = create(render()); });
    await flush();
    expect(result.isPresenting).toBe(false);
  });
});
