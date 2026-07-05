/**
 * StarField.tsx — ホーム背景の星空（宇宙）
 * ------------------------------------------------------------------
 * 上部に紫のグロー（radial）を敷き、白い小さな星を散らす。
 * 星は3レイヤーに分け、レイヤーごとに位相をずらした明滅で「またたき」を出す
 * （星ごとにフックを持たず、Group の opacity を SharedValue で駆動＝軽量）。
 */

import React, { useMemo, useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { Canvas, Fill, Group, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

type Star = { x: number; y: number; r: number };

function makeStars(n: number, w: number, h: number): Star[] {
  const arr: Star[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({ x: Math.random() * w, y: Math.random() * h, r: 0.4 + Math.random() * 1.3 });
  }
  return arr;
}

export const StarField: React.FC = () => {
  const { width, height } = useWindowDimensions();

  // 星の位置は一度だけ生成（再レンダーで動かさない）
  const layers = useMemo(
    () => [makeStars(36, width, height), makeStars(30, width, height), makeStars(26, width, height)],
    [width, height],
  );

  // 3レイヤーの明滅（位相ずらし）
  const o0 = useSharedValue(0.7);
  const o1 = useSharedValue(0.5);
  const o2 = useSharedValue(0.9);
  useEffect(() => {
    o0.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
    o1.value = withDelay(600, withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, true));
    o2.value = withDelay(1200, withRepeat(withTiming(0.5, { duration: 2500, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [o0, o1, o2]);
  const opacities = [o0, o1, o2];

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

      {/* 星（3レイヤー・またたき） */}
      {layers.map((stars, li) => (
        <Group key={li} opacity={opacities[li]}>
          {stars.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} color="rgba(238,243,255,0.92)" />
          ))}
        </Group>
      ))}
    </Canvas>
  );
};

export default StarField;
