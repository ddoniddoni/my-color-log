export type BlockedUser = { id: string; nickname: string; createdAt: string };
export type UserBlockTarget = { id: string; nickname: string; shouldBlock: boolean };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseBlockedUsers(value: unknown): BlockedUser[] {
  if (!Array.isArray(value)) throw new Error('user_blocks_invalid_response');
  const seen = new Set<string>();
  return value.map((row: unknown) => {
    if (typeof row !== 'object' || row === null || !('user_id' in row) || typeof row.user_id !== 'string'
      || !uuidPattern.test(row.user_id) || seen.has(row.user_id) || !('nickname' in row) || typeof row.nickname !== 'string'
      || !('created_at' in row) || typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))) {
      throw new Error('user_blocks_invalid_response');
    }
    seen.add(row.user_id);
    return { id: row.user_id, nickname: row.nickname, createdAt: row.created_at };
  });
}

export function getUserBlockErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'authentication_required') return '다시 로그인한 뒤 차단 설정을 변경해 주세요.';
  if (code === 'user_block_not_available') return '함께 있는 방의 멤버만 차단할 수 있어요. 방을 다시 확인해 주세요.';
  return '차단 설정을 저장하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
}
