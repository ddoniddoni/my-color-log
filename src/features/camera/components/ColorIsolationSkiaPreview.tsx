import { Canvas, Image, Rect, RuntimeShader, Skia, useImage } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';

import { COLOR_ISOLATION_SHADER, type ColorIsolationUniforms } from '@/src/features/camera/model/colorIsolation';

const colorIsolationEffect = Skia.RuntimeEffect.Make(COLOR_ISOLATION_SHADER);

export type ColorIsolationSkiaPreviewProps = {
  size: number;
  uniforms: ColorIsolationUniforms;
  uri: string;
};

export function ColorIsolationSkiaPreview({ size, uniforms, uri }: ColorIsolationSkiaPreviewProps) {
  const image = useImage(uri);

  return (
    <Canvas style={[styles.canvas, { height: size, width: size }]}>
      <Rect color="#000000" height={size} width={size} x={0} y={0} />
      {image && colorIsolationEffect ? (
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
