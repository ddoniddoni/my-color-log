import { Redirect, useLocalSearchParams } from 'expo-router';

import { PhotoReviewScreen } from '@/src/features/camera/components/PhotoReviewScreen';

export default function PhotoReviewRoute() {
  const params = useLocalSearchParams<{ photoId?: string; colorNameEn?: string }>();
  if (!params.photoId || !params.colorNameEn) {
    return <Redirect href="/(tabs)" />;
  }
  return <PhotoReviewScreen reviewContext={{ photoId: params.photoId, colorNameEn: params.colorNameEn }} />;
}
