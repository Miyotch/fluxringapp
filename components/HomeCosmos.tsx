import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Fill, Circle, Group, Path, Shader, RadialGradient, Skia, vec } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { homeStars } from '../lib/homeStars';
import { HOME_NEBULA_SHADER } from '../lib/homeNebula';

const nebulaEffect = Skia.RuntimeEffect.Make(HOME_NEBULA_SHADER);
function DepthLayer({ layer, width, height, drift }: { layer: number; width: number; height: number; drift: SharedValue<number> }) {
  const stars = useMemo(() => homeStars(layer), [layer]);
  // Batch the larger star field by color and brightness: 18 paths, not 1400 nodes.
  const paths = useMemo(() => Array.from({ length: 6 }, (_, bucket) => {
    const path = Skia.Path.Make();
    stars.filter(s => (s.warm ? 3 : 0) + Math.min(2, Math.floor(s.opacity * 3)) === bucket)
      .forEach(s => path.addCircle(s.x * width, s.y * height, s.r));
    return path;
  }), [stars, width, height]);
  const transform = useDerivedValue(() => [
    { translateX: drift.value * (layer + 1) * -.35 },
    { translateY: drift.value * (layer + 1) * -.5 },
  ]);
  return <Group transform={transform} opacity={[.58, .73, .86][layer]}>
    {layer === 2 && stars.filter(s => s.opacity > .6).map((s, i) => <Circle key={i} cx={s.x * width} cy={s.y * height} r={s.r * 5}>
      <RadialGradient c={vec(s.x * width, s.y * height)} r={s.r * 5} colors={['#d5e6ff28', '#d5e6ff00']} />
    </Circle>)}
    {paths.map((path, i) => <Path key={i} path={path} color={i < 3 ? '#d3e0ee' : '#e1cba7'} opacity={[.24, .53, .86][i % 3]} />)}
  </Group>;
}

/** A static nebula canvas is separate from the animated stars so it needs no frame redraws. */
export function HomeCosmos({ width, height, drift }: { width: number; height: number; drift: SharedValue<number> }) {
  const uniforms = useMemo(() => ({ resolution: [width, height] }), [width, height]);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill color="#030509" />
      {nebulaEffect && <Fill><Shader source={nebulaEffect} uniforms={uniforms} /></Fill>}
    </Canvas>
    <Canvas style={StyleSheet.absoluteFill}>
      {[0, 1, 2].map(layer => <DepthLayer key={layer} layer={layer} width={width} height={height} drift={drift} />)}
    </Canvas>
  </View>;
}
