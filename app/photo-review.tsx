import { Redirect, useLocalSearchParams } from 'expo-router';

import { PhotoReviewScreen } from '@/src/features/camera/components/PhotoReviewScreen';
import { isColorHex } from '@/src/features/camera/model/colorIsolation';

export default function PhotoReviewRoute() {
  const params = useLocalSearchParams<{ colorHex?: string; photoId?: string; colorNameEn?: string }>();
  if (!params.photoId || !params.colorNameEn || !isColorHex(params.colorHex)) {
    return <Redirect href="/(tabs)" />;
  }
  return <PhotoReviewScreen reviewContext={{ colorHex: params.colorHex, photoId: params.photoId, colorNameEn: params.colorNameEn }} />;
}
