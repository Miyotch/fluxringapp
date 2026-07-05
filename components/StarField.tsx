/**
 * StarField.tsx — ホーム背景の星空（宇宙）
 * ------------------------------------------------------------------
 * 上部に紫のグロー（radial）を敷き、白い小さな星を散らす。
 * 星は1つずつ独立して明滅する（星ごとに異なる速さ・位相・強弱をランダムに持ち、
 * 共有クロックから sin で opacity を導出＝ランダムなまたたき）。
 */

import React, { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  Canvas,
  Fill,
  Circle,
  RadialGradient,
  vec,
  useClock,
} from '@shopify/react-native-skia';
import { useDerivedValue, SharedValue } from 'react-native-reanimated';

type Star = {
  x: number;
  y: number;
  r: number;
  base: number;   // 最低の明るさ
  amp: number;    // 明滅の振れ幅
  speed: number;  // 明滅の速さ（rad/s）
  phase: number;  // 位相（0..2π）
};

function makeStars(n: number, w: number, h: number): Star[] {
  const arr: Star[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.4 + Math.random() * 1.3,
      base: 0.12 + Math.random() * 0.3,      // 0.12〜0.42
      amp: 0.35 + Math.random() * 0.5,       // 0.35〜0.85
      speed: 0.5 + Math.random() * 1.9,      // ゆっくり〜やや速い（星ごとにバラバラ）
      phase: Math.random() * Math.PI * 2,
    });
  }
  return arr;
}

// 1つの星（共有クロックから自分だけの明滅を導出）
const TwinkleStar: React.FC<{ star: Star; clock: SharedValue<number> }> = ({ star, clock }) => {
  const opacity = useDerivedValue(() => {
    const t = clock.value / 1000; // 秒
    const o = star.base + star.amp * (0.5 + 0.5 * Math.sin(t * star.speed + star.phase));
    return Math.min(1, o);
  }, [clock]);

  return <Circle cx={star.x} cy={star.y} r={star.r} color="rgba(238,243,255,1)" opacity={opacity} />;
};

export const StarField: React.FC = () => {
  const { width, height } = useWindowDimensions();
  const clock = useClock();

  // 星の位置・明滅パラメータは一度だけ生成（再レンダーで動かさない）
  const stars = useMemo(() => makeStars(84, width, height), [width, height]);

  return (
    <Canvas style={{ position: 'absolute', width, height }} pointerEvents="none">
      {/* 地：中心上寄りの深い藍紫 → ほぼ黒 */}
      <Fill>
        <RadialGradient
          c={vec(width / 2, height * 0.28)}
          r={height * 0.9}
          colors={['#1b1740', '#0c0a1f', '#07060f']}
        />
      </Fill>

      {/* 上部の紫グロー */}
      <Circle cx={width * 0.5} cy={height * 0.16} r={width * 0.7} opacity={0.4}>
        <RadialGradient
          c={vec(width * 0.5, height * 0.16)}
          r={width * 0.7}
          colors={['rgba(124,98,214,0.55)', 'rgba(70,60,140,0.10)', 'rgba(7,6,15,0)']}
        />
      </Circle>

      {/* 星（1つずつランダムに明滅） */}
      {stars.map((s, i) => (
        <TwinkleStar key={i} star={s} clock={clock} />
      ))}
    </Canvas>
  );
};

export default StarField;
