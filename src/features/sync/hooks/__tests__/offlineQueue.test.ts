import { QueryClient, onlineManager, useQuery } from '@tanstack/react-query';

import { useUserPhotoQueue } from '@/src/features/sync/hooks/useUserPhotoQueue';
import { addPendingPhoto } from '@/src/features/sync/queue/photoQueue';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: async (key: string) => mockStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => { mockStorage.set(key, value); },
} }));
jest.mock('@tanstack/react-query', () => ({ ...jest.requireActual('@tanstack/react-query'), useQuery: jest.fn() }));

describe('local queue while offline', () => {
  it('reads persisted drafts and pending uploads using the production hook options', async () => {
    const draft: PendingPhoto = { id: 'draft', userId: 'owner', entryId: 'entry', missionId: 'mission', dateKey: '2026-10-17',
      localUri: 'file:///saved.jpg', storagePath: 'owner/saved.jpg', capturedAt: '2026-10-17T01:00:00Z', position: 1,
      caption: null, width: 100, height: 100, byteSize: 100, status: 'local_saved', retryCount: 0, lastErrorCode: null };
    await addPendingPhoto(draft);
    await addPendingPhoto({ ...draft, id: 'pending', status: 'pending', position: 2 });
    await addPendingPhoto({ ...draft, id: 'other', userId: 'other' });
    useUserPhotoQueue('owner');
    const options = jest.mocked(useQuery).mock.calls[0][0];
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    onlineManager.setOnline(false);
    try {
      const result = await client.fetchQuery(options);
      expect(result).toEqual([draft, { ...draft, id: 'pending', status: 'pending', position: 2 }]);
    } finally {
      onlineManager.setOnline(true);
      client.clear();
    }
  });
});
