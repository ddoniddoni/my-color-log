import { getBlockedUsers, setUserBlock } from '../userBlockRepository';
import { getSupabaseClient } from '@/src/lib/supabase/client';

jest.mock('@/src/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));
const abortSignal = jest.fn();
const rpc = jest.fn(() => ({ abortSignal }));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getSupabaseClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof getSupabaseClient>);
});
afterEach(() => jest.useRealTimers());
it('requires the server receipt to match the requested state and binds no actor ID', async () => {
  abortSignal.mockResolvedValue({ data: true, error: null });
  await setUserBlock('target',true);
  expect(rpc).toHaveBeenCalledWith('cl_set_user_block', { p_blocked_user_id: 'target', p_should_block: true });
  abortSignal.mockResolvedValue({ data: true, error: null });
  await expect(setUserBlock('target',false)).rejects.toThrow('user_block_save_failed');
  abortSignal.mockResolvedValue({ data: false, error: null });
  await expect(setUserBlock('target',false)).resolves.toBeUndefined();
});
it('uses cancellable list requests and rejects malformed results', async () => {
  const controller = new AbortController();
  abortSignal.mockResolvedValue({ data: [{ nickname: 'missing ID' }], error: null });
  await expect(getBlockedUsers(controller.signal)).rejects.toThrow('user_blocks_invalid_response');
  expect(abortSignal).toHaveBeenCalledWith(controller.signal);
});
it('times out a stalled request and sanitizes errors', async () => {
  jest.useFakeTimers();
  abortSignal.mockImplementation((signal: AbortSignal) => new Promise((resolve) => signal.addEventListener('abort', () => resolve({ data: null, error: { message: 'private detail' } }))));
  const pending = setUserBlock('target',true);
  const assertion = expect(pending).rejects.toThrow('user_block_save_failed');
  await jest.advanceTimersByTimeAsync(20_000);
  await assertion;
  expect(jest.getTimerCount()).toBe(0);
});
