import { canMovePhoto, getPhotoMoveUpdates } from '@/src/features/entries/model/photoManagement';
import { type TodayPhoto } from '@/src/features/entries/model/todayPhotos';

const photos: TodayPhoto[] = [
  { id: 'photo-1', uri: 'file:///photo-1.jpg', localUri: 'file:///photo-1.jpg', storagePath: 'user/photo-1.jpg', position: 1, capturedAt: '2026-07-17T01:00:00.000Z', caption: null, status: 'synced' },
  { id: 'photo-2', uri: 'file:///photo-2.jpg', localUri: 'file:///photo-2.jpg', storagePath: 'user/photo-2.jpg', position: 2, capturedAt: '2026-07-17T02:00:00.000Z', caption: null, status: 'synced' },
  { id: 'photo-3', uri: 'file:///photo-3.jpg', localUri: 'file:///photo-3.jpg', storagePath: 'user/photo-3.jpg', position: 4, capturedAt: '2026-07-17T03:00:00.000Z', caption: null, status: 'synced' },
];

describe('photo management', () => {
  it('swaps two occupied neighbouring cells', () => {
    expect(getPhotoMoveUpdates(photos, 'photo-2', 'backward')).toEqual([
      { photoId: 'photo-2', position: 1 },
      { photoId: 'photo-1', position: 2 },
    ]);
  });

  it('moves a photo into the neighbouring empty cell without changing other photos', () => {
    expect(getPhotoMoveUpdates(photos, 'photo-2', 'forward')).toEqual([
      { photoId: 'photo-2', position: 3 },
    ]);
  });

  it('does not move beyond the first or last board cell', () => {
    expect(canMovePhoto(photos, 'photo-1', 'backward')).toBe(false);
    expect(getPhotoMoveUpdates([{ ...photos[2], position: 9 }], 'photo-3', 'forward')).toBeNull();
  });
});
