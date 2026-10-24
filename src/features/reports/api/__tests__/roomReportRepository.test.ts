import { submitRoomReport } from '../roomReportRepository';

const mockRpc = jest.fn();
const mockAbortSignal = jest.fn();
jest.mock('@/src/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: mockRpc }) }));
const input = { kind: 'photo' as const, roomId: 'room', targetId: 'photo', reason: 'privacy' as const, details: '  사유  ' };
const reportId = '12345678-1234-4234-8234-123456789012';

beforeEach(() => {
  jest.clearAllMocks();
  mockRpc.mockReturnValue({ abortSignal: mockAbortSignal });
  mockAbortSignal.mockResolvedValue({ data: { report_id: reportId, already_submitted: false }, error: null });
});

it('submits only target and normalized reason; identity and status come from the server', async () => {
  await expect(submitRoomReport(input)).resolves.toEqual({ id: reportId, alreadySubmitted: false });
  expect(mockRpc).toHaveBeenCalledWith('cl_submit_room_report', { p_room_id: 'room', p_target_type: 'photo', p_target_id: 'photo', p_reason: 'privacy', p_details: '사유' });
  expect(mockAbortSignal).toHaveBeenCalledWith(expect.objectContaining({ aborted: false }));
});

it('rejects invalid details before making a request', async () => {
  await expect(submitRoomReport({ ...input, reason: 'other', details: ' ' })).rejects.toThrow('room_report_invalid_input');
  expect(mockRpc).not.toHaveBeenCalled();
});

it('recognizes duplicate receipts without sending new identity data', async () => {
  mockAbortSignal.mockResolvedValue({ data: { report_id: reportId, already_submitted: true }, error: null });
  await expect(submitRoomReport({ ...input, kind: 'member', details: null })).resolves.toEqual({ id: reportId, alreadySubmitted: true });
});

it('does not convert failed or malformed responses into success', async () => {
  mockAbortSignal.mockResolvedValue({ data: null, error: { message: 'room_report_not_available' } });
  await expect(submitRoomReport(input)).rejects.toThrow('room_report_not_available');
  mockAbortSignal.mockResolvedValue({ data: true, error: null });
  await expect(submitRoomReport(input)).rejects.toThrow('room_report_invalid_response');
});

it('hides unknown server details', async () => {
  mockAbortSignal.mockResolvedValue({ data: null, error: { message: 'database secret' } });
  await expect(submitRoomReport(input)).rejects.toThrow('room_report_submit_failed');
});

it('aborts a stalled request rather than leaving the popup locked forever', async () => {
  jest.useFakeTimers();
  mockAbortSignal.mockImplementation((signal: AbortSignal) => new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve({ data: null, error: { message: 'aborted' } }));
  }));
  const pending = expect(submitRoomReport(input)).rejects.toThrow('room_report_submit_failed');
  await jest.advanceTimersByTimeAsync(20_000);
  await pending;
  jest.useRealTimers();
});
