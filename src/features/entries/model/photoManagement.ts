import { type TodayPhoto } from '@/src/features/entries/model/todayPhotos';

export type PhotoMoveDirection = 'backward' | 'forward';

export type PhotoPositionUpdate = {
  photoId: string;
  position: number;
};

export function getPhotoMoveUpdates(
  photos: TodayPhoto[],
  photoId: string,
  direction: PhotoMoveDirection,
): PhotoPositionUpdate[] | null {
  const selectedPhoto = photos.find((photo) => photo.id === photoId);
  if (!selectedPhoto) throw new Error('photo_not_found');

  const targetPosition = selectedPhoto.position + (direction === 'backward' ? -1 : 1);
  if (targetPosition < 1 || targetPosition > 9) return null;

  const targetPhoto = photos.find((photo) => photo.position === targetPosition);
  if (!targetPhoto) return [{ photoId: selectedPhoto.id, position: targetPosition }];

  return [
    { photoId: selectedPhoto.id, position: targetPhoto.position },
    { photoId: targetPhoto.id, position: selectedPhoto.position },
  ];
}

export function canMovePhoto(photos: TodayPhoto[], photoId: string, direction: PhotoMoveDirection): boolean {
  return getPhotoMoveUpdates(photos, photoId, direction) !== null;
}
