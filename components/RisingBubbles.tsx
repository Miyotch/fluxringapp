/**
 * RisingBubbles.tsx — 購入時の泡（シャンパンの泡が立ち上るイメージ）
 * ------------------------------------------------------------------
 * マウントされると、グラスの底の湧き出し点（nucleation）から極小の泡が
 * 幾筋もの細い列になって立ち上る。上昇につれ少し膨らみ、わずかに横へ
 * 揺れながら加速し、上端付近ではじけて消える。
 * 約2秒でフェードアウトして onDone を呼ぶ（親が非表示化）。
 * 藍紫〜シアン＋白のみ（暖色不使用）。
 */

import React, { useMemo, useEffect } from 'react';
import {
  Canvas,
  Group,
  Circle,
  Paint,
  Blur,
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
  x0: number;      // 湧き出しの基準X（列）
  r: number;       // 基本半径（極小）
  speed: number;   // 上昇の速さ（周期/秒）
  phase: number;   // 0..1 の位相ずらし
  wobA: number;    // 横揺れ振幅（小さめ）
  wobS: number;    // 横揺れ速さ（速め）
  drift: number;   // 上昇に伴うわずかな横流れ
  white: boolean;  // 白 or シアン
  grow: number;    // 上昇に伴う膨張率
};

// シャンパンの泡＝底の数点から細い列で湧く。列ごとに密度を変える。
function makeBubbles(n: number, w: number): Bubble[] {
  const streams = 11;
  const streamX = Array.from({ length: streams }, (_, i) =>
    w * (0.18 + (0.64 * (i + 0.5)) / streams) + (Math.random() - 0.5) * 10,
  );
  const arr: Bubble[] = [];
  for (let i = 0; i < n; i++) {
    const sx = streamX[Math.floor(Math.random() * streams)];
    // 半径は二乗バイアスで「ほとんど極小・稀に少し大きい」分布
    const t = Math.random();
    const r = 0.35 + t * t * 1.7;
    arr.push({
      x0: sx + (Math.random() - 0.5) * 5, // 列内の細かな散り
      r,
      speed: 0.5 + Math.random() * 0.7,   // 速め（シュワッと）
      phase: Math.random(),
      wobA: 1.5 + Math.random() * 4.5,    // 揺れは控えめ
      wobS: 2.4 + Math.random() * 3.4,    // 速い小刻みな揺れ
      drift: (Math.random() - 0.5) * 10,
      white: Math.random() < 0.5,
      grow: 0.35 + Math.random() * 0.5,   // 上でやや膨らむ
    });
  }
  return arr;
}

const Bub: React.FC<{
  b: Bubble;
  clock: SharedValue<number>;
  op: SharedValue<number>;
  height: number;
}> = ({ b, clock, op, height }) => {
  const frac = useDerivedValue(() => ((clock.value / 1000) * b.speed + b.phase) % 1);

  // 上昇は下ほど遅く上ほど速い（frac^0.85）＝立ち上がりの加速感
  const cy = useDerivedValue(() => height - Math.pow(frac.value, 0.85) * height * 0.94);
  const cx = useDerivedValue(
    () =>
      b.x0 +
      b.drift * frac.value +
      Math.sin((clock.value / 1000) * b.wobS + b.phase * 6.28) * b.wobA * (0.3 + frac.value),
  );
  const radius = useDerivedValue(() => b.r * (1 + b.grow * frac.value));
  // 出はじけ・上端はじけでフェード（sin エンベロープ）
  const opacity = useDerivedValue(() => op.value * Math.sin(frac.value * Math.PI) * 0.96);

  return (
    <Circle
      cx={cx}
      cy={cy}
      r={radius}
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
  // 粒度を細かく＝数を増やし半径を小さく（シャンパンの泡）
  const bubbles = useMemo(() => makeBubbles(280, width), [width]);

  useEffect(() => {
    // 立ち上がり → 維持 → フェードアウト → onDone
    op.value = withSequence(
      withTiming(1, { duration: 300 }),
      withDelay(
        1400,
        withTiming(0, { duration: 500 }, (finished) => {
          'worklet';
          if (finished && onDone) runOnJS(onDone)();
        }),
      ),
    );
  }, [op, onDone]);

  return (
    <Canvas style={{ position: 'absolute', width, height }} pointerEvents="none">
      {/* 微細な泡はにじみを与えると発泡感が出る（screen 合成＋弱ブラー） */}
      <Group layer={<Paint><Blur blur={0.5} /></Paint>}>
        {bubbles.map((b, i) => (
          <Bub key={i} b={b} clock={clock} op={op} height={height} />
        ))}
      </Group>
    </Canvas>
  );
};

export default RisingBubbles;
