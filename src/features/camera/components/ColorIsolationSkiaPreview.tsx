import { Canvas, Image, Skia, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';

import { type ColorIsolationUniforms } from '@/src/features/camera/model/colorIsolation';
import { renderColorIsolationImage } from '../api/renderColorIsolationImage';

export type ColorIsolationSkiaPreviewProps = {
  maxDimension?: number;
  fallback: ReactNode;
  onError: () => void;
  size: number;
  uniforms: ColorIsolationUniforms;
  uri: string;
};

type PreviewResources = { uri: string; image: SkImage; uniforms: ColorIsolationUniforms };

export function ColorIsolationSkiaPreview({ fallback, onError, size, uniforms, uri, maxDimension }: ColorIsolationSkiaPreviewProps) {
  const [resources, setResources] = useState<PreviewResources | null>(null);
  const reportError = useEffectEvent(onError);

  useEffect(() => {
    let cancelled = false;
    let loaded: PreviewResources | null = null;
    const load = async () => {
      let image: SkImage | null = null;
      try {
        const data = await Skia.Data.fromURI(uri);
        try {
          if (cancelled) return;
          image = Skia.Image.MakeImageFromEncoded(data);
          if (!image) throw new Error('photo_color_isolation_preview_unavailable');
          loaded = { uri, image: renderColorIsolationImage(image, uniforms, maxDimension), uniforms };
          setResources(loaded);
        } finally { image?.dispose(); image = null; data.dispose(); }
      } catch {
        if (!cancelled) reportError();
      }
    };
    void load();
    return () => {
      cancelled = true;
      loaded?.image.dispose();
    };
  }, [uri, uniforms, maxDimension]);

  // Never show an old URI's image while a new crop/rotation is decoding.
  if (!resources || resources.uri !== uri || resources.uniforms !== uniforms) return fallback;
  return (
    <Canvas style={{ height: size, width: size }}>
      <Image height={size} image={resources.image} width={size} x={0} y={0} fit="cover" />
    </Canvas>
  );
}
