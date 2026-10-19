import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTodayPhotoActions } from '../useTodayPhotoActions';
import { useDiaryEdits } from '@/src/features/diary/hooks/useDiaryEdits';
import { addPendingPhoto, getQueuedPhoto, removeUserPhotoQueue, PHOTO_SYNC_MUTATION_SCOPE } from '@/src/features/sync/queue/photoQueue';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { mergeTodayPhotos } from '../../model/todayPhotos';
import { deleteMyEntryPhotoRecord, syncPendingPhoto } from '../../api/entryRepository';
import { PhotoSyncProvider } from '@/src/features/sync/hooks/usePhotoSync';

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: async (key: string) => mockStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => { mockStorage.set(key, value); },
} }));
jest.mock('../../api/entryRepository', () => ({ syncPendingPhoto: jest.fn(), deleteMyEntryPhotoRecord: jest.fn().mockResolvedValue(null), removeEntryPhotoObject: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/src/features/sync/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => 'online' }));
jest.mock('@/src/features/camera/api/localPhotoRepository', () => ({ removeLocalPhotoFile: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/src/features/diary/api/diaryRepository', () => ({ updateDiaryEntryNote: jest.fn(), updateDiaryPhotoCaption: jest.fn() }));

const photo: PendingPhoto = { id: 'photo', userId: 'owner', entryId: 'entry', missionId: 'mission', dateKey: '2026-10-19',
  localUri: 'file:///photo.jpg', storagePath: 'owner/photo.jpg', position: 1, caption: null, capturedAt: '2026-10-19T01:00:00Z',
  width: 100, height: 100, byteSize: 100, status: 'uploading', retryCount: 0, lastErrorCode: null };
let today: ReturnType<typeof useTodayPhotoActions>;
let diary: ReturnType<typeof useDiaryEdits>;
function Probe() {
  const todayValue = useTodayPhotoActions({ userId: photo.userId, dateKey: photo.dateKey, entry: undefined, queuedPhotos: [photo] });
  const diaryValue = useDiaryEdits({ userId: photo.userId, monthKey: '2026-10' });
  useEffect(() => { today = todayValue; diary = diaryValue; }, [todayValue, diaryValue]);
  return null;
}

describe('deletion while an upload is in flight', () => {
  let screen: ReactTestRenderer;
  let client: QueryClient;
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    jest.mocked(deleteMyEntryPhotoRecord).mockResolvedValue(null);
    await addPendingPhoto(photo);
    client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } });
    await act(async () => { screen = create(<QueryClientProvider client={client}><Probe /></QueryClientProvider>); });
  });
  afterEach(async () => { await act(async () => screen?.unmount()); client.clear(); await removeUserPhotoQueue(photo.userId); });

  it('keeps a cancellation marker after deletion from Today until the sync worker finishes', async () => {
    await act(async () => { await today.deletePhoto(mergeTodayPhotos(undefined, [photo])[0]); });
    expect(await getQueuedPhoto(photo.id)).toMatchObject({ status: 'cancelled' });
  });

  it('keeps a cancellation marker after deletion from the diary until the sync worker finishes', async () => {
    await act(async () => { await diary.deletePhoto({ dateKey: photo.dateKey, entryId: photo.entryId,
      photo: { ...photo, signedUrl: null } }); });
    expect(await getQueuedPhoto(photo.id)).toMatchObject({ status: 'cancelled' });
  });

  it('restores the pending upload if the server rejects the deletion', async () => {
    jest.mocked(deleteMyEntryPhotoRecord).mockRejectedValueOnce(new Error('entry_photo_delete_failed'));
    await act(async () => { await expect(today.deletePhoto(mergeTodayPhotos(undefined, [photo])[0])).rejects.toThrow('entry_photo_delete_failed'); });
    expect(await getQueuedPhoto(photo.id)).toEqual(photo);
  });

  it.each(['today', 'diary'] as const)('serializes %s deletion after the active upload', async (source) => {
    let finishUpload!: () => void;
    const upload = client.getMutationCache().build(client, {
      scope: PHOTO_SYNC_MUTATION_SCOPE,
      mutationFn: () => new Promise<void>((resolve) => { finishUpload = resolve; }),
    });
    let uploading!: Promise<void>;
    let deleting!: Promise<unknown>;
    await act(async () => { uploading = upload.execute(undefined); });
    await act(async () => {
      deleting = source === 'today' ? today.deletePhoto(mergeTodayPhotos(undefined, [photo])[0])
        : diary.deletePhoto({ dateKey: photo.dateKey, entryId: photo.entryId, photo: { ...photo, signedUrl: null } });
    });
    expect(deleteMyEntryPhotoRecord).not.toHaveBeenCalled();
    await act(async () => { finishUpload(); await uploading; await deleting; });
    expect(deleteMyEntryPhotoRecord).toHaveBeenCalledWith(photo.id);
    expect(await getQueuedPhoto(photo.id)).toMatchObject({ status: 'cancelled' });
  });

  it('finishes queued cleanup after the real sync provider and diary deletion run in order', async () => {
    let finishUpload!: (value: Awaited<ReturnType<typeof syncPendingPhoto>>) => void;
    jest.mocked(syncPendingPhoto).mockImplementationOnce(() => new Promise((resolve) => { finishUpload = resolve; }));
    const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    await act(async () => {
      screen.update(<QueryClientProvider client={client}><PhotoSyncProvider userId="owner"><Probe /></PhotoSyncProvider></QueryClientProvider>);
    });
    await flush();
    expect(syncPendingPhoto).toHaveBeenCalledTimes(1);
    let deleting!: Promise<unknown>;
    await act(async () => { deleting = diary.deletePhoto({ dateKey: photo.dateKey, entryId: photo.entryId, photo: { ...photo, signedUrl: null } }); });
    expect(deleteMyEntryPhotoRecord).not.toHaveBeenCalled();
    await act(async () => {
      const saved = { ...photo, signedUrl: null };
      finishUpload({ entryId: photo.entryId, wasCancelled: false, photo: saved, photos: [saved] });
      await deleting;
    });
    await flush(); await flush();
    expect(await getQueuedPhoto(photo.id)).toBeNull();
    expect(deleteMyEntryPhotoRecord).toHaveBeenCalledTimes(2);
  });
});
