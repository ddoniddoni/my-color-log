import { parseProfile, type Profile } from '@/src/features/profile/model/profile';
import { supabase } from '@/src/lib/supabase/client';

const profileColumns = 'id, nickname, timezone, is_onboarded';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select(profileColumns).eq('id', userId).maybeSingle();
  if (error) throw new Error('profile_fetch_failed');
  return data ? parseProfile(data) : null;
}

export async function completeProfile(userId: string, nickname: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, nickname, timezone: 'Asia/Seoul', is_onboarded: true }, { onConflict: 'id' })
    .select(profileColumns)
    .single();

  if (error) throw new Error('profile_save_failed');
  return parseProfile(data);
}
