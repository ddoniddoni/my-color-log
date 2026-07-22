import {
  addPendingPhoto,
  cancelPendingPhoto,
  getUserPhotoQueue,
  removeUserPhotoQueue,
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
