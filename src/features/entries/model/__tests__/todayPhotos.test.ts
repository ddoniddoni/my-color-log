import { getNextPhotoPosition, mergeTodayPhotos } from '@/src/features/entries/model/todayPhotos';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { removeEntryPhoto } from '@/src/features/entries/model/removeEntryPhoto';

const queuedPhoto: PendingPhoto = {
  id: 'photo-1', userId: 'user-1', entryId: 'entry-local', dateKey: '2026-07-17', missionId: 'mission-1',
  localUri: 'file:///photo-1.jpg', storagePath: 'user-1/2026-07-17/photo-1.jpg', position: 1, caption: null,
  capturedAt: '2026-07-17T01:00:00.000Z', width: 1200, height: 1600, byteSize: 1000, status: 'pending', retryCount: 0, lastErrorCode: null,
};

describe('today photos', () => {
  it('keeps a confirmed deletion compacted even if the next server refresh fails', () => {
    const photos = [1, 2, 3].map((position) => ({ id: `photo-${position}`, entryId: 'entry', storagePath: `user/${position}.jpg`, position,
      caption: null, capturedAt: queuedPhoto.capturedAt, width: 100, height: 100, byteSize: 100, signedUrl: null }));
    const entry = { id: 'entry', userId: 'user-1', missionId: 'mission-1', dateKey: '2026-07-17', note: null, photos };
    const deleted = removeEntryPhoto(entry, 'photo-1');
    const merged = mergeTodayPhotos(deleted, photos.map((photo) => ({ ...queuedPhoto, id: photo.id, position: photo.position, status: 'synced' })));
    expect(merged.map((photo) => [photo.id, photo.position])).toEqual([['photo-2', 1], ['photo-3', 2]]);
    expect(getNextPhotoPosition(merged)).toBe(3);
    expect(removeEntryPhoto(deleted, 'photo-1')).toEqual(deleted);
  });
  it('uses the server order and caption after deletion or edits on another device', () => {
    const entry = {
      id: 'entry-remote', userId: 'user-1', missionId: 'mission-1', dateKey: '2026-07-17', note: null,
      photos: [{ id: 'photo-1', entryId: 'entry-remote', storagePath: queuedPhoto.storagePath, position: 1, caption: 'edited remotely', capturedAt: queuedPhoto.capturedAt, width: 1200, height: 1600, byteSize: 1000, signedUrl: null }],
    };
    const merged = mergeTodayPhotos(entry, [{ ...queuedPhoto, position: 2, status: 'synced' }]);
    expect(merged[0]).toMatchObject({ position: 1, caption: 'edited remotely', uri: queuedPhoto.localUri });
    expect(getNextPhotoPosition(merged)).toBe(2);
  });

  it('does not resurrect a remotely deleted synced photo', () => {
    expect(mergeTodayPhotos(null, [{ ...queuedPhoto, status: 'synced' }])).toEqual([]);
    expect(mergeTodayPhotos(null, [queuedPhoto])).toHaveLength(1);
  });

  it('reserves remote slots even when signed URLs are unavailable offline', () => {
    const entry = {
      id: 'entry-remote', userId: 'user-1', missionId: 'mission-1', dateKey: '2026-07-17', note: null,
      photos: [{ id: 'remote-photo', entryId: 'entry-remote', storagePath: 'user/remote.jpg', position: 1, caption: null, capturedAt: queuedPhoto.capturedAt, width: 1200, height: 1600, byteSize: 1000, signedUrl: null }],
    };
    const merged = mergeTodayPhotos(entry, [queuedPhoto]);
    expect(merged.map(({ id, position }) => ({ id, position }))).toEqual([
      { id: 'remote-photo', position: 1 }, { id: 'photo-1', position: 2 },
    ]);
    expect(getNextPhotoPosition(merged)).toBe(3);
  });

  it('never displays an unconfirmed review draft as a recorded photo', () => {
    expect(mergeTodayPhotos(null, [{ ...queuedPhoto, status: 'local_saved' }])).toEqual([]);
  });
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
      status: 'synced',
    }]);
  });

  it('returns the first open position and stops at nine', () => {
    const photos = Array.from({ length: 8 }, (_, index) => ({ id: String(index), uri: 'file:///photo.jpg', localUri: 'file:///photo.jpg', storagePath: 'user/photo.jpg', position: index + 1, capturedAt: queuedPhoto.capturedAt, caption: null, status: 'synced' as const }));
    expect(getNextPhotoPosition(photos)).toBe(9);
    expect(getNextPhotoPosition([...photos, { ...photos[0], id: '9', position: 9 }])).toBeNull();
  });
});
