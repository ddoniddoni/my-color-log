import { Canvas, Image, Rect, RuntimeShader, Skia, useImage } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';

import { COLOR_ISOLATION_DEFAULTS, COLOR_ISOLATION_SHADER, type NormalizedRgb } from '@/src/features/camera/model/colorIsolation';

const colorIsolationEffect = Skia.RuntimeEffect.Make(COLOR_ISOLATION_SHADER);

export type ColorIsolationSkiaPreviewProps = {
  size: number;
  targetColor: NormalizedRgb;
  uri: string;
};

export function ColorIsolationSkiaPreview({ size, targetColor, uri }: ColorIsolationSkiaPreviewProps) {
  const image = useImage(uri);
  const uniforms = getColorIsolationUniformsFromTarget(targetColor);

  return (
    <Canvas style={[styles.canvas, { height: size, width: size }]}>
      <Rect color="#000000" height={size} width={size} x={0} y={0} />
      {image && colorIsolationEffect && uniforms ? (
        <Image height={size} image={image} width={size} x={0} y={0} fit="cover">
          <RuntimeShader
            source={colorIsolationEffect}
            uniforms={uniforms}
          />
        </Image>
      ) : null}
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: '#000000' },
});

function getColorIsolationUniformsFromTarget(targetColor: NormalizedRgb) {
  return {
    ...COLOR_ISOLATION_DEFAULTS,
    targetColor,
  };
}
