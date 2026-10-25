import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Fill, Circle, Group, Path, RadialGradient, Skia, vec } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { homeStars } from '../lib/homeStars';

function DepthLayer({ layer, width, height, drift }: { layer: number; width: number; height: number; drift: SharedValue<number> }) {
  const stars = useMemo(() => homeStars(layer), [layer]);
  const paths = useMemo(() => [false, true].map(warm => {
    const p = Skia.Path.Make();
    stars.filter(s => s.warm === warm).forEach(s => p.addCircle(s.x * width, s.y * height, s.r));
    return p;
  }), [stars, width, height]);
  const transform = useDerivedValue(() => [
    { translateX: drift.value * (layer + 1) * -.35 },
    { translateY: drift.value * (layer + 1) * -.5 },
  ]);
  return <Group transform={transform} opacity={[.48, .72, .92][layer]}>
    {layer === 2 && stars.map((s, i) => <Circle key={i} cx={s.x * width} cy={s.y * height} r={s.r * 7}>
      <RadialGradient c={vec(s.x * width, s.y * height)} r={s.r * 7} colors={['#afcfff55', '#afcfff00']} />
    </Circle>)}
    <Path path={paths[0]} color="#d4e5ff" /><Path path={paths[1]} color="#e6d6b6" />
  </Group>;
}

/** No blurred offscreen layers: three batched star planes and soft radial light. */
export function HomeCosmos({ width, height, drift }: { width: number; height: number; drift: SharedValue<number> }) {
  return <Canvas pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
    <Fill color="#030711" />
    {[{ x: .22, y: .24, r: .8, c: '#1c335b65' }, { x: .78, y: .68, r: .7, c: '#3b285450' },
      { x: .5, y: .49, r: .55, c: '#39718325' }].map((n, i) => <Circle key={i} cx={width*n.x} cy={height*n.y} r={width*n.r}>
      <RadialGradient c={vec(width*n.x, height*n.y)} r={width*n.r} colors={[n.c, '#03071100']} />
    </Circle>)}
    {[0, 1, 2].map(layer => <DepthLayer key={layer} layer={layer} width={width} height={height} drift={drift} />)}
  </Canvas>;
}
