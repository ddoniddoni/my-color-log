import { Redirect, useLocalSearchParams } from 'expo-router';

import { CameraCaptureScreen } from '@/src/features/camera/components/CameraCaptureScreen';
import { isColorHex } from '@/src/features/camera/model/colorIsolation';

export default function CameraRoute() {
  const params = useLocalSearchParams<{ colorHex?: string; missionId?: string; dateKey?: string; position?: string; colorNameEn?: string }>();
  const position = Number(params.position);
  if (!params.missionId || !params.dateKey || !params.colorNameEn || !isColorHex(params.colorHex) || !Number.isInteger(position) || position < 1 || position > 9) {
    return <Redirect href="/(tabs)" />;
  }
  return <CameraCaptureScreen captureContext={{ colorHex: params.colorHex, missionId: params.missionId, dateKey: params.dateKey, position, colorNameEn: params.colorNameEn }} />;
}
