import React, { useMemo } from 'react';
import { Image, PixelRatio, StyleSheet, View } from 'react-native';
import { Canvas, Fill, ImageShader, Shader, Skia, type SkImage } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { HOME_NEBULA_SPACE_SHADER, nebulaMotion } from '../lib/homeNebulaSpace';

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
  sources: string[]; front: boolean; width: number; height: number; clock: SharedValue<number>; strength: number;
}) {
  const scale = Math.min(1, 480 / (width * PixelRatio.get()));
  const w = width * scale, h = height * scale;
  const layers = front ? [2] : [0, 1];
  // Android's Skia URI loader does not support data: URLs. Decode PNG bytes directly.
  // JSI image ownership is retained by the scene and released by GC after unmount.
  const decoded = useMemo(() => sources.map(uri => {
    try {
      const data = Skia.Data.fromBase64(uri.slice(uri.indexOf(',') + 1));
      try {
        const image = Skia.Image.MakeImageFromEncoded(data);
        if (!image) throw new Error('Cloud PNG decoding returned null');
        return image;
      } finally { data.dispose(); }
    } catch (error) {
      console.warn('[HomeNebulaSpace] Cloud PNG decoding failed; using static fallback', error);
      return null;
    }
  }), [sources]);
  if (!effect || decoded.some(image => !image)) return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {layers.map(layer => <Image key={layer} source={{ uri: sources[layer] }} resizeMode="stretch"
      style={[StyleSheet.absoluteFill, { width, height, opacity: .54 }]} />)}
  </View>;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
    <Canvas pointerEvents="none" style={{ width: w, height: h, transformOrigin: 'top left', transform: [{ scale: 1 / scale }] }}>
      {layers.map(layer => <CloudPlane key={layer} image={decoded[layer]!} layer={layer} width={w} height={h} clock={clock} strength={strength} />)}
    </Canvas>
  </View>;
}
