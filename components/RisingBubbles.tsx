/**
 * RisingBubbles.tsx — 購入時の泡（下から上へシュワシュワ）
 * ------------------------------------------------------------------
 * マウントされると小さな星の泡が下から立ち上り、左右に揺れながら上昇し、
 * 上端付近で消える。約2秒でフェードアウトして onDone を呼ぶ（親が非表示化）。
 * 藍紫〜シアン＋白のみ（暖色不使用）。
 */

import React, { useMemo, useEffect } from 'react';
import {
  Canvas,
  Circle,
  useClock,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';

type Bubble = {
  x: number;
  r: number;
  speed: number;   // 上昇の速さ（周期/秒）
  phase: number;   // 0..1 の位相ずらし
  wobA: number;    // 横揺れ振幅
  wobS: number;    // 横揺れ速さ
  white: boolean;  // 白 or シアン
};

function makeBubbles(n: number, w: number): Bubble[] {
  const arr: Bubble[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      x: w * (0.16 + Math.random() * 0.68), // 中央〜広めに湧く
      r: 1 + Math.random() * 3.2,
      speed: 0.32 + Math.random() * 0.55,
      phase: Math.random(),
      wobA: 6 + Math.random() * 16,
      wobS: 1 + Math.random() * 2.2,
      white: Math.random() < 0.5,
    });
  }
  return arr;
}

const Bub: React.FC<{
  b: Bubble;
  clock: SharedValue<number>;
  op: SharedValue<number>;
  width: number;
  height: number;
}> = ({ b, clock, op, width, height }) => {
  const frac = useDerivedValue(() => ((clock.value / 1000) * b.speed + b.phase) % 1);

  const cy = useDerivedValue(() => height - frac.value * height * 0.92);
  const cx = useDerivedValue(
    () => b.x + Math.sin((clock.value / 1000) * b.wobS + b.phase * 6.28) * b.wobA,
  );
  const opacity = useDerivedValue(() => op.value * Math.sin(frac.value * Math.PI) * 0.98);

  return (
    <Circle
      cx={cx}
      cy={cy}
      r={b.r}
      color={b.white ? 'rgba(240,248,255,1)' : 'rgba(120,220,240,1)'}
      opacity={opacity}
    />
  );
};

type Props = {
  width: number;
  height: number;
  onDone?: () => void;
};

export const RisingBubbles: React.FC<Props> = ({ width, height, onDone }) => {
  const clock = useClock();
  const op = useSharedValue(0);
  const bubbles = useMemo(() => makeBubbles(130, width), [width]);

  useEffect(() => {
    // 立ち上がり → 維持 → フェードアウト → onDone
    op.value = withSequence(
      withTiming(1, { duration: 300 }),
      withDelay(
        1300,
        withTiming(0, { duration: 500 }, (finished) => {
          'worklet';
          if (finished && onDone) runOnJS(onDone)();
        }),
      ),
    );
  }, [op, onDone]);

  return (
    <Canvas style={{ position: 'absolute', width, height }} pointerEvents="none">
      {bubbles.map((b, i) => (
        <Bub key={i} b={b} clock={clock} op={op} width={width} height={height} />
      ))}
    </Canvas>
  );
};

export default RisingBubbles;
