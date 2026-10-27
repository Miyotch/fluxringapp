import React from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import { Canvas, Fill, Image as SkiaImage, ImageShader, Shader, Skia, type SkImage } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { HOME_NEBULA_SPACE_SHADER, NEBULA_OPACITY, nebulaMotion } from '../lib/homeNebulaSpace';

const effect = Skia.RuntimeEffect.Make(HOME_NEBULA_SPACE_SHADER);
if (!effect) console.warn('[HomeNebulaSpace] Cloud shader unavailable; using static transparent clouds');

function CloudPlane({ image, layer, width, height, clock, strength }: {
  image: SkImage; layer: number; width: number; height: number; clock: SharedValue<number>; strength: number;
}) {
  const uniforms = useDerivedValue(() => ({ resolution: [width, height], ...nebulaMotion(clock.value / 1000, strength, layer) }),
    [width, height, strength, layer, clock]);
  if (!effect) return null;
  return <Fill><Shader source={effect} uniforms={uniforms}>
    <ImageShader image={image} fit="fill" rect={{ x: 0, y: 0, width, height }} tx="decal" ty="decal" />
  </Shader></Fill>;
}

/** At most 480 physical pixels wide. Stars and the card retain full resolution. */
export function HomeNebulaSpace({ sources, front, width, height, clock, strength }: {
  sources: SkImage[]; front: boolean; width: number; height: number; clock: SharedValue<number>; strength: number;
}) {
  const scale = Math.min(1, 480 / (width * PixelRatio.get()));
  const w = width * scale, h = height * scale;
  const layers = front ? [2] : [0, 1];
  // Share the three original raster images between both depth planes. No PNG roundtrip
  // or duplicate decode; cache and mounted scenes own them through JSI references.
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
    <Canvas pointerEvents="none" style={{ width: w, height: h, transformOrigin: 'top left', transform: [{ scale: 1 / scale }] }}>
      {layers.map(layer => effect
        ? <CloudPlane key={layer} image={sources[layer]} layer={layer} width={w} height={h} clock={clock} strength={strength} />
        : <SkiaImage key={layer} image={sources[layer]} x={0} y={0} width={w} height={h} fit="fill" opacity={.54 * NEBULA_OPACITY} />)}
    </Canvas>
  </View>;
}
