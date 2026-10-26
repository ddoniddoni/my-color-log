import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { readPhotoViewingPreferences, writePhotoViewingPreferences } from '../api/photoViewingPreferences';
import { queryKeys } from '@/src/lib/query/queryKeys';

export function usePhotoViewingPreferences(userId: string | null, dateKey: string) {
  const client = useQueryClient();
  const queryKey = queryKeys.photoViewingPreferences(userId ?? '', dateKey);
  const query = useQuery({ queryKey, enabled: Boolean(userId), networkMode: 'always',
    queryFn: () => readPhotoViewingPreferences(userId!, dateKey) });
  const mutation = useMutation({ networkMode: 'always', scope: { id: `photo-viewing:${userId}` },
    mutationFn: async ({ photoId, colorHex, enabled }: { photoId: string; colorHex: string; enabled: boolean }) => {
      if (!userId) throw new Error('photo_viewing_user_missing');
      await client.cancelQueries({ queryKey });
      const photos = await readPhotoViewingPreferences(userId, dateKey);
      if (enabled) photos[photoId] = colorHex;
      else delete photos[photoId];
      await writePhotoViewingPreferences(userId, dateKey, photos);
      client.setQueryData(queryKey, Object.fromEntries(Object.entries(photos).slice(-9)));
    },
  });
  return { preferences: query.data ?? {}, loading: query.isPending, saving: mutation.isPending,
    loadFailed: query.isError, retry: query.refetch, setEnabled: mutation.mutateAsync };
}
