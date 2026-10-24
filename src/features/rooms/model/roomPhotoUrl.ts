import { getPublicEnv } from '@/src/lib/env/publicEnv';
import { ENTRY_PHOTO_BUCKET } from '@/src/lib/supabase/entryPhotoUrls';

export function getRoomPhotoUrls(paths: readonly string[]): Map<string, string> {
  const base = `${getPublicEnv().supabaseUrl.replace(/\/$/, '')}/storage/v1/object/authenticated/${ENTRY_PHOTO_BUCKET}/`;
  return new Map(paths.flatMap((path) => {
    // Never forward an Authorization header to an external or path-traversal URL.
    const parts = path.split('/');
    if (!path || parts.some((part) => !part || part === '.' || part === '..' || /[\\\x00-\x1f]/.test(part))) return [];
    return [[path, base + parts.map(encodeURIComponent).join('/')] as const];
  }));
}

// Supabase's authenticated Storage route can cache a previous successful read at
// the CDN even with private/max-age=0. cacheNonce forces an origin permission check.
export function withRoomPhotoNonce(url: string, nonce: string): string {
  return `${url}?cacheNonce=${encodeURIComponent(nonce)}`;
}
