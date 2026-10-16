import { Redirect, useLocalSearchParams } from 'expo-router';

import { PhotoReviewScreen } from '@/src/features/camera/components/PhotoReviewScreen';
import { isColorHex } from '@/src/features/camera/model/colorIsolation';

export default function PhotoReviewRoute() {
  const params = useLocalSearchParams<{ colorHex?: string; photoId?: string; colorNameEn?: string }>();
  if (!params.photoId) {
    return <Redirect href="/(tabs)" />;
  }
  return <PhotoReviewScreen reviewContext={{ colorHex: isColorHex(params.colorHex) ? params.colorHex : undefined, photoId: params.photoId, colorNameEn: params.colorNameEn }} />;
}
