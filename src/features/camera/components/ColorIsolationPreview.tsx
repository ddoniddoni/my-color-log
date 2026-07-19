import { Image } from 'expo-image';
import { lazy, Suspense } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

import { toNormalizedRgb } from '@/src/features/camera/model/colorIsolation';

const nativeSkiaModule = Platform.OS === 'web' ? null : TurboModuleRegistry.get('RNSkiaModule');
const ColorIsolationSkiaPreview = nativeSkiaModule === null
  ? null
  : lazy(async () => {
    const module = await import('./ColorIsolationSkiaPreview');
    return { default: module.ColorIsolationSkiaPreview };
  });

export const isColorIsolationPreviewAvailable = ColorIsolationSkiaPreview !== null;

export function ColorIsolationPreview({ colorHex, size, uri }: { colorHex: string; size: number; uri: string }) {
  const targetColor = toNormalizedRgb(colorHex);
  if (!ColorIsolationSkiaPreview || !targetColor) {
    return <OriginalPhotoPreview size={size} uri={uri} />;
  }

  return <Suspense fallback={<OriginalPhotoPreview size={size} uri={uri} />}><ColorIsolationSkiaPreview size={size} targetColor={targetColor} uri={uri} /></Suspense>;
}

function OriginalPhotoPreview({ size, uri }: { size: number; uri: string }) {
  return <Image cachePolicy="memory-disk" contentFit="cover" source={{ uri }} style={{ height: size, width: size }} />;
}
