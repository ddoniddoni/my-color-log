import { QueryClient } from '@tanstack/react-query';

import { refreshBlockAccess } from '../refreshBlockAccess';
import { getUserBlockErrorMessage, parseBlockedUsers } from '../userBlock';
import { queryKeys } from '@/src/lib/query/queryKeys';

const row = { user_id: '12345678-1234-4234-8234-123456789012', nickname: '친구', created_at: '2026-10-01T00:00:00Z' };
it('parses only valid unique blocked users', () => {
  expect(parseBlockedUsers([row])).toEqual([{ id: row.user_id, nickname: '친구', createdAt: row.created_at }]);
  for (const invalid of [null, {}, [row, row], [{ ...row, user_id: 'invalid' }], [{ ...row, created_at: 'yesterday' }], [{ ...row, nickname: null }]]) {
    expect(() => parseBlockedUsers(invalid)).toThrow('user_blocks_invalid_response');
  }
});
it('never displays raw server errors', () => {
  expect(getUserBlockErrorMessage(new Error('secret internal detail'))).not.toContain('secret');
  expect(getUserBlockErrorMessage(new Error('authentication_required'))).toContain('로그인');
});
it('clears all room snapshots and cancels old responses without touching personal data or another account', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const affected = [queryKeys.roomTodayBoard('me', 'one', '2026-10-01'), queryKeys.roomTodayBoard('me', 'two', '2026-10-02'),
    queryKeys.roomHistoryBoard('me', 'one', '2026-09-01'), queryKeys.roomHistory('me', 'one'), queryKeys.roomPhotoReactions('me', 'one', 'p'), queryKeys.blockedUsers('me')];
  const preserved = [queryKeys.dailyEntry('me', '2026-10-01'), queryKeys.photoQueue('me'), queryKeys.diaryMonth('me','2026-10'), queryKeys.rooms('me'), queryKeys.roomTodayBoard('other', 'one', '2026-10-01')];
  for (const key of [...affected, ...preserved]) client.setQueryData(key, ['private snapshot']);
  let finish: (value: string[]) => void = () => {};
  let signal: AbortSignal | undefined;
  const oldRequest = client.fetchQuery({ queryKey: affected[0], queryFn: (context) => {
    signal = context.signal;
    return new Promise<string[]>((resolve) => { finish = resolve; });
  } }).catch(() => null);
  await refreshBlockAccess(client, 'me');
  expect(signal?.aborted).toBe(true);
  finish(['late blocked photo']);
  await oldRequest;
  for (const key of affected) expect(client.getQueryData(key)).toBeUndefined();
  for (const key of preserved) expect(client.getQueryData(key)).toEqual(['private snapshot']);
  client.clear();
});
