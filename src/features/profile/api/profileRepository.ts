import { parseProfile, type Profile, validateNickname } from '@/src/features/profile/model/profile';
import { logError } from '@/src/lib/logging/logger';
import { getSupabaseClient } from '@/src/lib/supabase/client';

const profileColumns = 'id, nickname, timezone, is_onboarded';

export async function getProfile(userId: string, accessToken?: string): Promise<Profile | null> {
  const query = getSupabaseClient().from('profiles').select(profileColumns).eq('id', userId).maybeSingle();
  const { data, error } = accessToken
    ? await query.setHeader('Authorization', `Bearer ${accessToken}`)
    : await query;

  if (error) {
    logError('profile_fetch_failed', { code: error.code, message: error.message });
    throw new Error('profile_fetch_failed');
  }

  return data ? parseProfile(data) : null;
}

export async function completeProfile(userId: string, nickname: string, timeZone: string): Promise<Profile> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .upsert({ id: userId, nickname, timezone: timeZone, is_onboarded: true }, { onConflict: 'id' })
    .select(profileColumns)
    .single();

  if (error) throw new Error('profile_save_failed');
  return parseProfile(data);
}

export async function updateProfileTimeZone(userId: string, timeZone: string): Promise<Profile> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .update({ timezone: timeZone })
    .eq('id', userId)
    .select(profileColumns)
    .maybeSingle();

  if (error || !data) throw new Error('profile_timezone_update_failed');
  return parseProfile(data);
}

export async function updateProfileNickname(userId: string, nickname: string): Promise<Profile> {
  const validation = validateNickname(nickname);
  if (!validation.isValid) throw new Error('nickname_invalid');

  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .update({ nickname: validation.value })
    .eq('id', userId)
    .select(profileColumns)
    .maybeSingle();

  if (error || !data) throw new Error('profile_update_failed');
  return parseProfile(data);
}
