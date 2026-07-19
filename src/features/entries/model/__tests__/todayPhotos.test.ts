import { getNextPhotoPosition, getTodayPhotoSlots, mergeTodayPhotos } from '@/src/features/entries/model/todayPhotos';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';

const queuedPhoto: PendingPhoto = {
  id: 'photo-1', userId: 'user-1', entryId: 'entry-local', dateKey: '2026-07-17', missionId: 'mission-1',
  localUri: 'file:///photo-1.jpg', storagePath: 'user-1/2026-07-17/photo-1.jpg', position: 1, caption: null,
  capturedAt: '2026-07-17T01:00:00.000Z', width: 1200, height: 1600, byteSize: 1000, status: 'pending', retryCount: 0, lastErrorCode: null,
};

describe('today photos', () => {
  it('prefers the preserved local image while the same remote photo exists', () => {
    const merged = mergeTodayPhotos({
      id: 'entry-remote', userId: 'user-1', missionId: 'mission-1', dateKey: '2026-07-17', note: null,
      photos: [{ id: 'photo-1', entryId: 'entry-remote', storagePath: queuedPhoto.storagePath, position: 1, caption: null, capturedAt: queuedPhoto.capturedAt, width: 1200, height: 1600, byteSize: 1000, signedUrl: 'https://signed.example/photo.jpg' }],
    }, [queuedPhoto]);
    expect(merged).toEqual([{
      id: 'photo-1',
      uri: queuedPhoto.localUri,
      localUri: queuedPhoto.localUri,
      storagePath: queuedPhoto.storagePath,
      position: 1,
      capturedAt: queuedPhoto.capturedAt,
      caption: null,
      status: 'syncing',
    }]);
  });

  it('returns the first open position and stops at nine', () => {
    const photos = Array.from({ length: 8 }, (_, index) => ({ id: String(index), uri: 'file:///photo.jpg', localUri: 'file:///photo.jpg', storagePath: 'user/photo.jpg', position: index + 1, capturedAt: queuedPhoto.capturedAt, caption: null, status: 'synced' as const }));
    expect(getNextPhotoPosition(photos)).toBe(9);
    expect(getNextPhotoPosition([...photos, { ...photos[0], id: '9', position: 9 }])).toBeNull();
  });

  it('places a first photo in the top-left cell of the fixed nine-cell board', () => {
    const firstPhoto = { id: 'photo-1', uri: 'file:///photo-1.jpg', localUri: 'file:///photo-1.jpg', storagePath: 'user/photo-1.jpg', position: 1, capturedAt: queuedPhoto.capturedAt, caption: null, status: 'synced' as const };
    const slots = getTodayPhotoSlots([firstPhoto]);
    expect(slots).toHaveLength(9);
    expect(slots[0]).toEqual(firstPhoto);
    expect(slots.slice(1)).toEqual([null, null, null, null, null, null, null, null]);
  });
});
