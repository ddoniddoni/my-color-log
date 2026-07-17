import { parseDailyMission, parseMissionRevealPalette, type DailyMission, type MissionRevealColor } from '@/src/features/missions/model/dailyMission';
import { supabase } from '@/src/lib/supabase/client';

export async function getDailyMission(dateKey: string): Promise<DailyMission> {
  const { data, error } = await supabase.rpc('get_daily_mission', { p_challenge_date: dateKey });
  if (error) throw new Error('daily_mission_fetch_failed');
  if (!Array.isArray(data) || data.length !== 1) throw new Error('daily_mission_missing');
  return parseDailyMission(data[0] as unknown);
}

export async function getMissionRevealPalette(dateKey: string): Promise<MissionRevealColor[]> {
  const { data, error } = await supabase.rpc('get_mission_reveal_palette', { p_challenge_date: dateKey });
  if (error) throw new Error('mission_reveal_palette_fetch_failed');
  return parseMissionRevealPalette(data);
}
