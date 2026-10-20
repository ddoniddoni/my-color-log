import AsyncStorage from '@react-native-async-storage/async-storage';
import { type QueryClient, type QueryKey } from '@tanstack/react-query';

import { parseDailyEntry, parseEntryPhoto } from '@/src/features/entries/model/dailyEntry';
import { parseDailyMission, parseMissionRevealPalette } from '@/src/features/missions/model/dailyMission';
import { parseProfile } from '@/src/features/profile/model/profile';

const PREFIX = '@mycolorlog/offline-reads/v1/';
const MAX_READS = 96;
type CachedRead = { key: QueryKey; data: unknown; updatedAt: number };
let writes: Promise<void> = Promise.resolve();
const activeStops = new Map<string, () => void>();

// Only own profile/entry metadata and published missions may cross a restart.
// Session tokens, room data and signed photo URLs never enter this cache.
function sanitizeOfflineRead(key: QueryKey, data: unknown, userId: string): unknown {
  if (key[0] === 'profile' && key.length === 2 && key[1] === userId) {
    if (data === null) return null;
    const value = record(data);
    const profile = parseProfile({ ...value, is_onboarded: value.isOnboarded });
    if (profile.id !== userId) throw new Error('offline_cache_owner_mismatch');
    return profile;
  }
  if (key[0] === 'dailyEntry' && key.length === 3 && key[1] === userId) {
    if (data === null) return null;
    const value = record(data);
    if (!Array.isArray(value.photos)) throw new Error('offline_cache_invalid');
    const photos = value.photos.map((item: unknown) => {
      const photo = record(item);
      return parseEntryPhoto({ ...photo, entry_id: photo.entryId, storage_path: photo.storagePath, captured_at: photo.capturedAt, byte_size: photo.byteSize }, null);
    });
    const entry = parseDailyEntry({ ...value, user_id: value.userId, mission_id: value.missionId, date_key: value.dateKey }, photos);
    if (entry.userId !== userId || entry.dateKey !== key[2] || photos.some((photo) => photo.entryId !== entry.id)) {
      throw new Error('offline_cache_owner_mismatch');
    }
    return entry;
  }
  if (key[0] === 'dailyMission' && key.length === 2) {
    const value = record(data);
    const color = record(value.color);
    const mission = parseDailyMission({
      id: value.id, challenge_date: value.challengeDate, mission_type: value.missionType,
      title_ko: value.titleKo, prompt_ko: value.promptKo, published_at: value.publishedAt, source: value.source,
      color_id: color.id, color_slug: color.slug, color_name_ko: color.nameKo, color_name_en: color.nameEn,
      color_hex: color.accent, color_tint_hex: color.accentTint, color_shade_hex: color.accentShade, color_on_color_hex: color.onAccent,
    });
    if (mission.challengeDate !== key[1]) throw new Error('offline_cache_date_mismatch');
    return mission;
  }
  if (key[0] === 'missionRevealPalette' && key.length === 2 && Array.isArray(data)) {
    return parseMissionRevealPalette(data.map((item: unknown) => {
      const color = record(item);
      return { color_id: color.id, color_slug: color.slug, color_name_ko: color.nameKo, color_name_en: color.nameEn, color_hex: color.accent, color_on_color_hex: color.onAccent };
    }));
  }
  throw new Error('offline_cache_query_not_allowed');
}

export async function restoreOfflineCache(client: QueryClient, userId: string): Promise<void> {
  const reads = await readCache(userId);
  for (const read of reads) {
    if (client.getQueryState(read.key)?.dataUpdatedAt) continue;
    // Restored data must revalidate as soon as a connection is available.
    client.setQueryData(read.key, read.data, { updatedAt: 1 });
  }
}

export function persistOfflineCache(client: QueryClient, userId: string): () => void {
  activeStops.get(userId)?.();
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    const { queryKey: key, state } = event.query;
    let data: unknown;
    try { data = sanitizeOfflineRead(key, state.data, userId); } catch { return; }
    writes = writes.catch(() => undefined).then(async () => {
      const reads = await readCache(userId);
      const next = reads.filter((read) => JSON.stringify(read.key) !== JSON.stringify(key));
      next.push({ key, data, updatedAt: state.dataUpdatedAt });
      next.sort((a, b) => Number(b.key[0] === 'profile') - Number(a.key[0] === 'profile') || b.updatedAt - a.updatedAt);
      await AsyncStorage.setItem(PREFIX + userId, JSON.stringify(next.slice(0, MAX_READS)));
    }).catch(() => {
      // The durable photo queue is independent; a read-cache failure must not
      // turn a successful server operation into a failed photo upload.
    });
  });
  const stop = (): void => {
    unsubscribe();
    if (activeStops.get(userId) === stop) activeStops.delete(userId);
  };
  activeStops.set(userId, stop);
  return stop;
}

export function clearOfflineCache(userId: string): Promise<void> {
  activeStops.get(userId)?.();
  writes = writes.catch(() => undefined).then(() => AsyncStorage.removeItem(PREFIX + userId));
  return writes;
}

export function flushOfflineCache(): Promise<void> { return writes; }

async function readCache(userId: string): Promise<CachedRead[]> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + userId);
    const value: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return [];
    return value.flatMap((item: unknown) => {
      try {
        const read = record(item);
        if (!Array.isArray(read.key) || typeof read.updatedAt !== 'number' || !Number.isFinite(read.updatedAt)) return [];
        return [{ key: read.key, data: sanitizeOfflineRead(read.key, read.data, userId), updatedAt: read.updatedAt }];
      } catch { return []; }
    });
  } catch { return []; }
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error('offline_cache_invalid');
  return value as Record<string, unknown>;
}
