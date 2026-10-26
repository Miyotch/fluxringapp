import React from 'react';
import { Canvas, Circle, Group, Line, RadialGradient, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { CLOUD_SIGNALS } from '../lib/homePinkNoise';
import { pinkAt } from '../lib/homeNebulaSpace';
import type { Star } from '../lib/homeStarfieldModel';

function Light({ star, index, width, height, clock, strength }: {
  star: Star; index: number; width: number; height: number; clock: SharedValue<number>; strength: number;
}) {
  const signals = CLOUD_SIGNALS[index % 3];
  const delay = index * 19.73;
  const transform = useDerivedValue(() => [{ translateX: ((star.x * width + clock.value * .00030 + 12) % (width + 24)) - 12 },
    { translateY: star.y * height }]);
  // Most stars stay steady; selected lights breathe independently, never blinking off.
  const opacity = useDerivedValue(() => star.alpha * (.76 + (index % 3 === 0 || star.bright ? .23 : .07)
    * strength * pinkAt(signals.density, clock.value / 1000 + delay)));
  const haloOpacity = useDerivedValue(() => .16 + .07 * strength * pinkAt(signals.horizontal, clock.value / 1000 + delay - 4));
  const color = `rgb(${star.color.join(',')})`;
  const radius = star.bright ? 5.4 : star.core * 3.2;
  return <Group transform={transform} opacity={opacity}>
    <Group opacity={haloOpacity}>
      <Circle cx={0} cy={0} r={radius}>
        <RadialGradient c={vec(0, 0)} r={radius} colors={[color, 'transparent']} positions={[0, 1]} />
      </Circle>
    </Group>
    <Circle cx={0} cy={0} r={star.core * 1.8}>
      <RadialGradient c={vec(0, 0)} r={star.core * 1.8} colors={[color, color, 'transparent']} positions={[0, .2, 1]} />
    </Circle>
    {star.bright && index % 2 === 0 && <Group opacity={.15}>
      <Line p1={vec(-2.5, -.6)} p2={vec(2.5, .6)} color={color} strokeWidth={.35} />
      <Line p1={vec(.35, -1.5)} p2={vec(-.35, 1.5)} color={color} strokeWidth={.3} />
    </Group>}
  </Group>;
}

/** Sparse full-resolution lights; the deep field remains a cached native image. */
export function HomeStarlight({ stars, width, height, clock, strength }: {
  stars: Star[]; width: number; height: number; clock: SharedValue<number>; strength: number;
}) {
  return <Canvas pointerEvents="none" style={{ position: 'absolute', width, height }}>
    {stars.map((star, index) => <Light key={index} {...{ star, index, width, height, clock, strength }} />)}
  </Canvas>;
}
