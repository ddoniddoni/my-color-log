import {
  addPendingPhoto,
  cancelPendingPhoto,
  confirmReviewPhoto,
  getQueuedPhoto,
  getUserPhotoQueue,
  removeUserPhotoQueue,
  updatePendingPhoto,
} from '@/src/features/sync/queue/photoQueue';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';

const mockStorageValues = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string): Promise<string | null> => mockStorageValues.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string): Promise<void> => {
      mockStorageValues.set(key, value);
    }),
  },
}));

const pendingPhoto: PendingPhoto = {
  id: 'photo-offline-1',
  userId: 'offline-user',
  entryId: 'entry-offline-1',
  dateKey: '2026-07-22',
  missionId: 'mission-1',
  localUri: 'file:///documents/photo-queue/offline-user/2026-07-22/photo-offline-1.jpg',
  storagePath: 'offline-user/2026-07-22/photo-offline-1.jpg',
  position: 1,
  caption: null,
  capturedAt: '2026-07-22T01:00:00.000Z',
  width: 1200,
  height: 1200,
  byteSize: 1024,
  status: 'pending',
  retryCount: 0,
  lastErrorCode: null,
};

describe('persisted photo upload queue', () => {
  it('restores unconfirmed drafts with their color and caption without auto-uploading', async () => {
    const draft = { ...pendingPhoto, status: 'local_saved' as const, caption: 'unfinished caption', reviewColor: { hex: '#123456', nameEn: 'Blue' } };
    await addPendingPhoto(draft);
    expect(await getUserPhotoQueue(draft.userId)).toEqual([draft]);
  });

  it('atomically reserves separate free slots when two recovered drafts are confirmed', async () => {
    await addPendingPhoto({ ...pendingPhoto, id: 'draft-a', status: 'local_saved' });
    await addPendingPhoto({ ...pendingPhoto, id: 'draft-b', status: 'local_saved' });
    const confirmed = await Promise.all([
      confirmReviewPhoto('draft-a', null, [1]),
      confirmReviewPhoto('draft-b', null, [1]),
    ]);
    expect(confirmed.map((photo) => photo.position)).toEqual([2, 3]);
    expect((await getQueuedPhoto('draft-b'))?.status).toBe('pending');
  });

  it('keeps a full-day draft and its local file URI for later recovery', async () => {
    const draft = { ...pendingPhoto, status: 'local_saved' as const };
    await addPendingPhoto(draft);
    await expect(confirmReviewPhoto(draft.id, null, [1, 2, 3, 4, 5, 6, 7, 8, 9])).rejects.toThrow('entry_photo_limit_reached');
    expect(await getQueuedPhoto(draft.id)).toEqual(draft);
  });

  it('retains the applied color treatment when confirmation fails and the draft is recovered', async () => {
    await addPendingPhoto({ ...pendingPhoto, status: 'local_saved' });
    const localUri = 'file:///documents/photo-queue/rendered-color.jpg';
    await updatePendingPhoto(pendingPhoto.id, { localUri, colorIsolationApplied: true });

    await expect(confirmReviewPhoto(pendingPhoto.id, null, [1, 2, 3, 4, 5, 6, 7, 8, 9])).rejects.toThrow('entry_photo_limit_reached');
    expect(await getQueuedPhoto(pendingPhoto.id)).toMatchObject({
      colorIsolationApplied: true,
      localUri,
      status: 'local_saved',
    });
    expect(await confirmReviewPhoto(pendingPhoto.id, null, [])).toMatchObject({
      colorIsolationApplied: true,
      localUri,
      status: 'pending',
    });
  });

  it('rejects confirmation after a draft has been cancelled', async () => {
    await addPendingPhoto({ ...pendingPhoto, status: 'local_saved' });
    await cancelPendingPhoto(pendingPhoto.id);
    await expect(confirmReviewPhoto(pendingPhoto.id, null, [])).rejects.toThrow('photo_review_not_available');
  });
  afterEach(async () => {
    await removeUserPhotoQueue(pendingPhoto.userId);
  });

  it('reads a locally queued offline photo back from persistent storage', async () => {
    await addPendingPhoto(pendingPhoto);

    await expect(getUserPhotoQueue(pendingPhoto.userId)).resolves.toEqual([pendingPhoto]);
  });

  it('keeps a cancelled tombstone so a later retry cannot revive the photo', async () => {
    await addPendingPhoto(pendingPhoto);
    await cancelPendingPhoto(pendingPhoto.id);

    await expect(getUserPhotoQueue(pendingPhoto.userId)).resolves.toEqual([
      { ...pendingPhoto, lastErrorCode: null, status: 'cancelled' },
    ]);
  });
});
