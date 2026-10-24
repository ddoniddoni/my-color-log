import { getRoomPhotoUrls } from '../roomPhotoUrl';

jest.mock('@/src/lib/env/publicEnv', () => ({ getPublicEnv: () => ({ supabaseUrl: 'https://project.example', supabasePublishableKey: 'public' }) }));
jest.mock('@/src/lib/supabase/entryPhotoUrls', () => ({ ENTRY_PHOTO_BUCKET: 'cl-entry-photos' }));
it('builds same-origin authenticated paths without embedded credentials', () => {
  const urls = getRoomPhotoUrls(['owner/2026-10-01/photo.jpg', '../escape', 'owner/../escape', '/external', 'https://evil.example/image', 'owner/special #?.jpg']);
  expect(urls.get('owner/2026-10-01/photo.jpg')).toBe('https://project.example/storage/v1/object/authenticated/cl-entry-photos/owner/2026-10-01/photo.jpg');
  expect(urls.has('../escape')).toBe(false);
  expect(urls.has('owner/../escape')).toBe(false);
  expect(urls.has('/external')).toBe(false);
  expect(urls.has('https://evil.example/image')).toBe(false);
  expect(urls.get('owner/special #?.jpg')).toContain('special%20%23%3F.jpg');
  expect([...urls.values()].every((url) => new URL(url).origin === 'https://project.example' && !url.includes('token='))).toBe(true);
});
