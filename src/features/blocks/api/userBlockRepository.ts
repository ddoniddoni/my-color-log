import { parseBlockedUsers } from '@/src/features/blocks/model/userBlock';
import { getSupabaseClient } from '@/src/lib/supabase/client';

export async function getBlockedUsers(signal: AbortSignal) {
  const { data, error } = await getSupabaseClient().rpc('cl_get_my_blocked_users').abortSignal(signal);
  if (error) throw new Error('user_blocks_fetch_failed');
  return parseBlockedUsers(data);
}

export async function setUserBlock(userId: string, shouldBlock: boolean): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const { data, error } = await getSupabaseClient().rpc('cl_set_user_block', {
      p_blocked_user_id: userId, p_should_block: shouldBlock,
    }).abortSignal(controller.signal);
    if (error) throw new Error(['authentication_required', 'user_block_not_available'].includes(error.message) ? error.message : 'user_block_save_failed');
    if (data !== shouldBlock) throw new Error('user_block_save_failed');
  } finally {
    clearTimeout(timeout);
  }
}
