import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Fill, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { homeStars } from '../lib/homeStars';

function DepthLayer({ layer, width, height, drift }: { layer: number; width: number; height: number; drift: SharedValue<number> }) {
  const stars = useMemo(() => homeStars(layer), [layer]);
  const transform = useDerivedValue(() => [
    { translateX: drift.value * (layer + 1) * -.35 },
    { translateY: drift.value * (layer + 1) * -.5 },
  ]);
  return <Group transform={transform} opacity={[.44, .60, .74][layer]}>
    {layer === 2 && stars.map((s, i) => <Circle key={i} cx={s.x * width} cy={s.y * height} r={s.r * 5.5}>
      <RadialGradient c={vec(s.x * width, s.y * height)} r={s.r * 5.5} colors={['#b9b2e630', '#b9b2e600']} />
    </Circle>)}
    {stars.map((s, i) => <Circle key={`star-${i}`} cx={s.x * width} cy={s.y * height} r={s.r} opacity={s.opacity} color={s.warm ? "#e6d6b6" : "#d4e5ff"} />)}
  </Group>;
}

/** No blurred offscreen layers: three sparse star planes with individual brightness and soft radial light. */
export function HomeCosmos({ width, height, drift }: { width: number; height: number; drift: SharedValue<number> }) {
  return <Canvas pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
    <Fill color="#050712" />
    {[{ x: .18, y: .20, r: .85, c: '#19284650' }, { x: .86, y: .38, r: .90, c: '#41265f7a' },
      { x: .24, y: .82, r: .80, c: '#34204c55' }].map((n, i) => <Circle key={i} cx={width*n.x} cy={height*n.y} r={width*n.r}>
      <RadialGradient c={vec(width*n.x, height*n.y)} r={width*n.r} colors={[n.c, '#05071200']} />
    </Circle>)}
    {[0, 1, 2].map(layer => <DepthLayer key={layer} layer={layer} width={width} height={height} drift={drift} />)}
  </Canvas>;
}
