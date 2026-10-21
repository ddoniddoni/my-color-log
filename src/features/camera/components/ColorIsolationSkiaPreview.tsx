import { Canvas, Image, RuntimeShader, Skia, type SkImage, type SkRuntimeEffect } from '@shopify/react-native-skia';
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';

import { COLOR_ISOLATION_SHADER, type ColorIsolationUniforms } from '@/src/features/camera/model/colorIsolation';

export type ColorIsolationSkiaPreviewProps = {
  fallback: ReactNode;
  onError: () => void;
  size: number;
  uniforms: ColorIsolationUniforms;
  uri: string;
};

type PreviewResources = { uri: string; image: SkImage; effect: SkRuntimeEffect };

export function ColorIsolationSkiaPreview({ fallback, onError, size, uniforms, uri }: ColorIsolationSkiaPreviewProps) {
  const [resources, setResources] = useState<PreviewResources | null>(null);
  const reportError = useEffectEvent(onError);

  useEffect(() => {
    let cancelled = false;
    let loaded: PreviewResources | null = null;
    const load = async () => {
      let image: SkImage | null = null;
      let effect: SkRuntimeEffect | null = null;
      try {
        const data = await Skia.Data.fromURI(uri);
        try {
          if (cancelled) return;
          image = Skia.Image.MakeImageFromEncoded(data);
          effect = Skia.RuntimeEffect.Make(COLOR_ISOLATION_SHADER);
          if (!image || !effect) throw new Error('photo_color_isolation_preview_unavailable');
          loaded = { uri, image, effect };
          setResources(loaded);
        } finally { data.dispose(); }
      } catch {
        image?.dispose();
        effect?.dispose();
        if (!cancelled) reportError();
      }
    };
    void load();
    return () => {
      cancelled = true;
      loaded?.image.dispose();
      loaded?.effect.dispose();
    };
  }, [uri]);

  // Never show an old URI's image while a new crop/rotation is decoding.
  if (!resources || resources.uri !== uri) return fallback;
  return (
    <Canvas style={{ height: size, width: size }}>
      <Image height={size} image={resources.image} width={size} x={0} y={0} fit="cover">
        <RuntimeShader source={resources.effect} uniforms={uniforms} />
      </Image>
    </Canvas>
  );
}
