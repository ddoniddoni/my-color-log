import { Redirect, useLocalSearchParams } from 'expo-router';

import { CameraCaptureScreen } from '@/src/features/camera/components/CameraCaptureScreen';

export default function CameraRoute() {
  const params = useLocalSearchParams<{ missionId?: string; dateKey?: string; position?: string; colorNameEn?: string }>();
  const position = Number(params.position);
  if (!params.missionId || !params.dateKey || !params.colorNameEn || !Number.isInteger(position) || position < 1 || position > 9) {
    return <Redirect href="/(tabs)" />;
  }
  return <CameraCaptureScreen captureContext={{ missionId: params.missionId, dateKey: params.dateKey, position, colorNameEn: params.colorNameEn }} />;
}
