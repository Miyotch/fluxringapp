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

// Overlapping elongated clouds and a dark pocket make an irregular nebula, not a flat wash.
const NEBULA = [
  { x: .93, y: .24, r: .84, squash: .62, color: '#6838a77a' },
  { x: .76, y: .34, r: .64, squash: .48, color: '#8a51ba55' },
  { x: 1.02, y: .45, r: .73, squash: .70, color: '#42399980' },
  { x: .12, y: .69, r: .78, squash: .65, color: '#274e8965' },
  { x: .24, y: .79, r: .69, squash: .45, color: '#68409b70' },
  { x: -.08, y: .90, r: .67, squash: .65, color: '#34328c65' },
  { x: .83, y: .38, r: .45, squash: .48, color: '#050712a0' },
];
/** Three star depths over layered nebulae; gradients need no offscreen blur. */
export function HomeCosmos({ width, height, drift }: { width: number; height: number; drift: SharedValue<number> }) {
  return <Canvas pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
    <Fill color="#050712" />
    {[{ x: .18, y: .20, r: .85, c: '#19284650' }, { x: .86, y: .38, r: .90, c: '#41265f7a' },
      { x: .24, y: .82, r: .80, c: '#34204c55' }].map((n, i) => <Circle key={i} cx={width*n.x} cy={height*n.y} r={width*n.r}>
      <RadialGradient c={vec(width*n.x, height*n.y)} r={width*n.r} colors={[n.c, '#05071200']} />
    </Circle>)}
    {NEBULA.map((n, i) => {
      const center = vec(width * n.x, height * n.y);
      const radius = width * n.r;
      return <Group key={`nebula-${i}`} origin={center} transform={[{ rotate: -.35 }, { scaleY: n.squash }]}>
        <Circle cx={center.x} cy={center.y} r={radius}>
          <RadialGradient c={center} r={radius} colors={[n.color, '#05071200']} />
        </Circle>
      </Group>;
    })}
    {[0, 1, 2].map(layer => <DepthLayer key={layer} layer={layer} width={width} height={height} drift={drift} />)}
  </Canvas>;
}
