import {
  getNextCancelledPhoto,
  getNextPendingUpload,
  getRecoverableFailedPhotos,
  isPendingUpload,
  type PendingPhoto,
} from '@/src/features/sync/model/pendingPhoto';

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

  it('recovers the oldest upload across dates, including an interrupted upload', () => {
    const photos: PendingPhoto[] = [
      { ...savedPhoto, id: 'today', dateKey: '2026-07-22', capturedAt: '2026-07-22T01:00:00.000Z', status: 'pending' },
      { ...savedPhoto, id: 'yesterday', dateKey: '2026-07-21', capturedAt: '2026-07-21T11:00:00.000Z', status: 'uploading' },
      { ...savedPhoto, id: 'review-draft', capturedAt: '2026-07-20T01:00:00.000Z' },
    ];

    expect(getNextPendingUpload(photos)?.id).toBe('yesterday');
  });

  it('only retries failed photos once in the current recovery cycle', () => {
    const failedYesterday = { ...savedPhoto, id: 'failed-yesterday', status: 'failed' as const };
    const failedToday = {
      ...savedPhoto,
      id: 'failed-today',
      dateKey: '2026-07-18',
      capturedAt: '2026-07-18T01:00:00.000Z',
      status: 'failed' as const,
    };

    expect(getRecoverableFailedPhotos(
      [failedToday, failedYesterday, { ...savedPhoto, id: 'pending', status: 'pending' }],
      new Set([failedYesterday.id]),
    ).map((photo) => photo.id)).toEqual(['failed-today']);
  });

  it('cleans cancelled photos before they can be considered for upload', () => {
    const cancelled = { ...savedPhoto, id: 'cancelled', status: 'cancelled' as const };
    const attemptedIds = new Set<string>();

    expect(getNextCancelledPhoto([cancelled], attemptedIds)?.id).toBe(cancelled.id);
    attemptedIds.add(cancelled.id);
    expect(getNextCancelledPhoto([cancelled], attemptedIds)).toBeNull();
    expect(getNextPendingUpload([cancelled])).toBeNull();
  });
});
