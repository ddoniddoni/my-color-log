import { syncPendingPhoto } from '@/src/features/entries/api/entryRepository';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';

const photo: PendingPhoto = { id: 'local', userId: 'owner', entryId: 'local-entry', dateKey: '2026-10-17', missionId: 'mission',
  localUri: 'file:///preserved.jpg', storagePath: 'owner/local.jpg', position: 1, caption: 'local caption',
  capturedAt: '2026-10-17T01:00:00Z', width: 100, height: 100, byteSize: 100, status: 'uploading', retryCount: 0, lastErrorCode: null };
const row = { id: 'remote', entry_id: 'entry', storage_path: 'owner/remote.jpg', position: 1, caption: null as string | null,
  captured_at: photo.capturedAt, width: 100, height: 100, byte_size: 100 };
let mockQueued: PendingPhoto | null;
const mockRead = jest.fn<Promise<{ data: (typeof row)[]; error: null }>, []>();
const mockInsert = jest.fn<Promise<{ error: { code: string } | null }>, [Record<string, unknown>]>();
const mockUpload = jest.fn(async () => ({ error: null }));
const mockRemove = jest.fn(async () => ({ error: null }));
const mockRpc = jest.fn(async (name: string) => ({ data: name === 'cl_get_or_create_daily_entry' ? [{ id: 'entry' }] : [], error: null }));
jest.mock('@/src/lib/supabase/client', () => ({ getSupabaseClient: () => ({
  rpc: mockRpc,
  from: () => ({ select: () => ({ eq: () => ({ order: mockRead }) }), insert: mockInsert }),
  storage: { from: () => ({ upload: mockUpload, remove: mockRemove }) },
}) }));
jest.mock('expo-file-system', () => ({ File: class { exists = true; async arrayBuffer() { return new ArrayBuffer(1); } } }));
jest.mock('@/src/features/sync/queue/photoQueue', () => ({
  getQueuedPhoto: async () => mockQueued,
  updatePendingPhoto: async (_id: string, update: Partial<PendingPhoto>) => { if (mockQueued) mockQueued = { ...mockQueued, ...update }; },
}));
jest.mock('@/src/features/rooms/api/roomRepository', () => ({ shareEntryToActiveRoom: async () => false }));
jest.mock('@/src/lib/supabase/entryPhotoUrls', () => ({ ENTRY_PHOTO_BUCKET: 'private-photos', getEntryPhotoSignedUrls: jest.fn() }));

describe('photo upload reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRead.mockReset(); mockInsert.mockReset();
    mockQueued = { ...photo };
    mockInsert.mockResolvedValue({ error: null });
  });

  it('chooses a free slot after server-side deletion compacts the remaining photo', async () => {
    mockRead.mockResolvedValue({ data: [row], error: null });
    const result = await syncPendingPhoto(photo);
    if (result.wasCancelled) throw new Error('unexpected_cancellation');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ id: photo.id, position: 2, entry_id: 'entry' }));
    expect(mockQueued).toMatchObject({ position: 2, localUri: photo.localUri });
    expect(result.photo?.position).toBe(2);
    expect(result.photos?.map((item) => [item.id, item.position])).toEqual([['remote', 1], ['local', 2]]);
  });

  it('converges after an interrupted successful upload without overwriting remote edits', async () => {
    mockRead.mockResolvedValue({ data: [{ ...row, id: photo.id, position: 3, caption: 'remote edit' }], error: null });
    const result = await syncPendingPhoto(photo);
    if (result.wasCancelled) throw new Error('unexpected_cancellation');
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(result.photo).toMatchObject({ position: 3, caption: 'remote edit' });
    expect(mockQueued).toMatchObject({ position: 3, caption: 'remote edit' });
  });

  it('reloads placement when another device claims the chosen slot', async () => {
    mockRead.mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [row], error: null });
    mockInsert.mockResolvedValueOnce({ error: { code: '23505' } }).mockResolvedValueOnce({ error: null });
    await syncPendingPhoto(photo);
    expect(mockInsert.mock.calls.map(([value]) => value.position)).toEqual([1, 2]);
  });

  it('retains the local photo when all nine slots are taken', async () => {
    mockRead.mockResolvedValue({ data: Array.from({ length: 9 }, (_, i) => ({ ...row, id: `remote-${i}`, position: i + 1 })), error: null });
    await expect(syncPendingPhoto(photo)).rejects.toThrow('entry_photo_limit_reached');
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockQueued?.localUri).toBe(photo.localUri);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('honors cancellation even when an earlier upload already exists remotely', async () => {
    mockQueued = { ...photo, status: 'cancelled' };
    mockRead.mockResolvedValue({ data: [{ ...row, id: photo.id }], error: null });
    expect((await syncPendingPhoto(photo)).wasCancelled).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('cl_delete_my_entry_photo', { p_photo_id: photo.id });
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
