import { File } from 'expo-file-system';
import { applyColorIsolationToPhoto } from '../colorIsolationRepository';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { updatePendingPhoto } from '@/src/features/sync/queue/photoQueue';

jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('@/src/features/sync/queue/photoQueue', () => ({ updatePendingPhoto: jest.fn() }));
jest.mock('../localPhotoRepository', () => ({ removeLocalPhotoFile: jest.fn() }));

const photo: PendingPhoto = {
  id: 'photo-1',
  userId: 'owner',
  entryId: 'entry-1',
  dateKey: '2026-10-20',
  missionId: 'mission-1',
  localUri: 'file:///photos/photo-1.jpg',
  storagePath: 'owner/2026-10-20/photo-1.jpg',
  position: 1,
  caption: null,
  capturedAt: '2026-10-20T01:00:00.000Z',
  width: 1600,
  height: 1600,
  byteSize: 10,
  status: 'local_saved',
  retryCount: 0,
  lastErrorCode: null,
};


beforeEach(() => jest.clearAllMocks());

describe('color isolation save retries', () => {
  it('reuses a rendered draft without opening, rendering, or replacing its file again', async () => {
    const rendered: PendingPhoto = { ...photo, colorIsolationApplied: true };
    await expect(applyColorIsolationToPhoto(rendered, '#E53935')).resolves.toBe(rendered);
    expect(File).not.toHaveBeenCalled();
    expect(updatePendingPhoto).not.toHaveBeenCalled();
  });

  it('cannot render or modify a photo that has already been confirmed for upload', async () => {
    await expect(applyColorIsolationToPhoto({ ...photo, colorIsolationApplied: true, status: 'pending' }, '#E53935'))
      .rejects.toThrow('photo_color_isolation_not_available');
    expect(File).not.toHaveBeenCalled();
  });
});
