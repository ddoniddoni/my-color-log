import { isPendingUpload, type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';

const savedPhoto: PendingPhoto = {
  id: 'photo-1',
  userId: 'user-1',
  entryId: 'entry-1',
  dateKey: '2026-07-17',
  missionId: 'mission-1',
  localUri: 'file:///photo-1.jpg',
  storagePath: 'user-1/2026-07-17/photo-1.jpg',
  position: 1,
  caption: null,
  capturedAt: '2026-07-17T01:00:00.000Z',
  width: 1200,
  height: 1600,
  byteSize: 1000,
  status: 'local_saved',
  retryCount: 0,
  lastErrorCode: null,
};

describe('pending photo state', () => {
  it('waits for explicit confirmation before uploading a locally saved review photo', () => {
    expect(isPendingUpload(savedPhoto)).toBe(false);
    expect(isPendingUpload({ ...savedPhoto, status: 'pending' })).toBe(true);
  });
});
