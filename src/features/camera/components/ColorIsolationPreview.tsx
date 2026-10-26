import { Image } from 'expo-image';
import { Component, lazy, Suspense, useMemo, type ReactNode } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

import { getColorIsolationUniforms, type ColorIsolationMode } from '@/src/features/camera/model/colorIsolation';

const nativeSkiaModule = Platform.OS === 'web' ? null : TurboModuleRegistry.get('RNSkiaModule');
const ColorIsolationSkiaPreview = nativeSkiaModule === null
  ? null
  : lazy(async () => {
    const module = await import('./ColorIsolationSkiaPreview');
    return { default: module.ColorIsolationSkiaPreview };
  });

export const isColorIsolationPreviewAvailable = ColorIsolationSkiaPreview !== null;

type PreviewProps = { colorHex: string; size: number; uri: string; onError: () => void; mode?: ColorIsolationMode; maxDimension?: number };

export function ColorIsolationPreview({ colorHex, onError, size, uri, mode = 'emphasize', maxDimension }: PreviewProps) {
  const uniforms = useMemo(() => getColorIsolationUniforms(colorHex, mode), [colorHex, mode]);
  const original = <Image cachePolicy="memory-disk" contentFit="cover" source={{ uri }} style={{ height: size, width: size }} />;
  if (!ColorIsolationSkiaPreview || !uniforms) return original;

  return (
    <PreviewErrorBoundary key={`${uri}:${colorHex}`} fallback={original} onError={onError}>
      <Suspense fallback={original}>
        <ColorIsolationSkiaPreview fallback={original} onError={onError} size={size} uniforms={uniforms} uri={uri} maxDimension={maxDimension} />
      </Suspense>
    </PreviewErrorBoundary>
  );
}

class PreviewErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
