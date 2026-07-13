/**
 * NebulaBand.tsx — 天の川バンド背景（nebula_band_standalone v97 準拠）
 * ------------------------------------------------------------------
 * ホーム（ディスカバー）の全面背景。参照実装の構成をそのまま移植:
 *   ・bgbase: радial(125% 95% at 50% 28%, #15132e → #0c0a1f 55% → #07060f)
 *   ・雲: 低彩度FR青紫の radial blob ×36。帯（縦49%±16%ガウス分布）に密集。
 *         定位置で横±/縦±のそよぎ・膨縮・濃淡呼吸（流れない）。blur13・加算系合成
 *   ・星: 520個（72%が帯に密集・下側は間引き＆縮小・12%だけ大きめ）。
 *         まばたき a = b*(0.16+0.84*(0.5+0.5 sin(t·f+ph)))
 *
 * 移植ノート:
 *   ・乱数は決定論ハッシュ（再レンダーで模様が変わらない。参照は毎回乱数=仕様だが
 *     アプリでは固定が望ましい）。ガウスは Box-Muller をハッシュで駆動
 *   ・星のまばたきは 16 群（位相・周波数を群単位で共有）に量子化して
 *     Path をまとめ、derived value 数を抑える（520個 → 16個）
 *   ・雲は 1 個ずつ center/radius/濃淡 を useClock から導出（36×3 derived）
 */

import React, { useMemo, useEffect, useState } from 'react';
import { AccessibilityInfo, useWindowDimensions, StyleSheet } from 'react-native';
import {
  Canvas,
  Group,
  Circle,
  Path,
  Paint,
  Blur,
  RadialGradient,
  vec,
  useClock,
  Skia,
} from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, SharedValue } from 'react-native-reanimated';

// ── 参照実装の定数 ──
const BANDY = 0.49;  // 帯の中心（縦%）
const BANDH = 0.16;  // 帯の広がり
const CLOUD_COLORS: [number, number, number][] = [
  [68, 90, 224], [84, 102, 218], [58, 100, 230], [98, 108, 214], [74, 96, 226],
];
const N_CLOUDS = 36;
const N_STARS = 520;
const STAR_GROUPS = 16;
const REF_W = 380; // 参照実装の内部座標幅（サイズ換算基準）

// 決定論ハッシュ（0..1）
function hash(x: number): number {
  'worklet';
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}
const rnd = (seed: number, a: number, b: number) => a + hash(seed) * (b - a);
// Box-Muller（ハッシュ駆動）
function gauss(seed: number): number {
  const u = hash(seed * 1.37) + 1e-9;
  const v = hash(seed * 7.91);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283 * v);
}

type Cloud = {
  bx: number; by: number; r: number; c: [number, number, number];
  a: number; ph: number; dr: number; w1: number; w2: number;
};

function buildClouds(): Cloud[] {
  const out: Cloud[] = [];
  for (let i = 0; i < N_CLOUDS; i++) {
    out.push({
      bx: rnd(i * 3.1 + 0.7, -6, 106),
      by: (BANDY + gauss(i * 5.3 + 2.1) * BANDH) * 100,
      r: rnd(i * 7.7 + 1.3, 70, 190),
      c: CLOUD_COLORS[i % CLOUD_COLORS.length],
      a: rnd(i * 11.3 + 4.9, 0.16, 0.3),
      ph: rnd(i * 13.7 + 3.3, 0, 6),
      dr: rnd(i * 17.9 + 8.1, -0.5, 0.5),
      w1: 6.283 / rnd(i * 19.3 + 6.7, 12, 19),
      w2: 6.283 / rnd(i * 23.1 + 9.9, 15, 24),
    });
  }
  return out;
}

type StarGroup = { path: ReturnType<typeof Skia.Path.Make>; f: number; ph: number; b: number };

function buildStarGroups(W: number, H: number): StarGroup[] {
  const scale = W / REF_W;
  const groups: StarGroup[] = Array.from({ length: STAR_GROUPS }, (_, g) => ({
    path: Skia.Path.Make(),
    f: rnd(g * 29.3 + 1.1, 0.9, 3.0),
    ph: rnd(g * 31.7 + 2.7, 0, 6),
    b: rnd(g * 37.1 + 5.5, 0.35, 0.82),
  }));
  let gi = 0;
  for (let i = 0; i < N_STARS; i++) {
    const band = hash(i * 3.3 + 0.4) < 0.72;
    const y = band
      ? (BANDY + gauss(i * 5.9 + 1.8) * BANDH * 1.2) * 100
      : hash(i * 7.1 + 2.2) * 100;
    if (y > 50 && hash(i * 9.7 + 3.6) < 0.42) continue; // 下側の星を間引き
    const big = hash(i * 11.9 + 4.4) >= 0.88;           // 大きい星は12%だけ
    let rr = big ? rnd(i * 13.3 + 5.2, 1.05, 1.35) : rnd(i * 15.7 + 6.0, 0.35, 1.0);
    if (y > 50) rr *= big ? 0.5 : 0.72;                 // 下側は縮小
    const x = hash(i * 17.3 + 7.7) * 100;
    groups[gi % STAR_GROUPS].path.addCircle((x / 100) * W, (y / 100) * H, rr * scale);
    gi++;
  }
  return groups;
}

// ── 1つの雲（そよぎ・膨縮・濃淡呼吸） ──
const CloudBlob: React.FC<{
  c: Cloud;
  W: number;
  H: number;
  scale: number;
  clock: SharedValue<number>;
  stop: SharedValue<boolean>;
}> = ({ c, W, H, scale, clock, stop }) => {
  const center = useDerivedValue(() => {
    const t = stop.value ? 0 : clock.value / 1000;
    return vec(
      ((c.bx + c.dr * 9 * Math.sin(t * c.w1 + c.ph)) / 100) * W,
      ((c.by + 5 * Math.sin(t * c.w2 + c.ph + 2.0)) / 100) * H,
    );
  }, [clock]);
  const radius = useDerivedValue(() => {
    const t = stop.value ? 0 : clock.value / 1000;
    return c.r * scale * (1 + 0.22 * Math.sin(t * c.w1 * 0.7 + c.ph + 4.0));
  }, [clock]);
  const opacity = useDerivedValue(() => {
    const t = stop.value ? 0 : clock.value / 1000;
    return c.a * (0.66 + 0.34 * (0.5 + 0.5 * Math.sin(t * c.w2 * 0.9 + c.ph + 1.0)));
  }, [clock]);

  const col = `rgb(${c.c[0]},${c.c[1]},${c.c[2]})`;
  const colHalf = `rgba(${c.c[0]},${c.c[1]},${c.c[2]},0.5)`;
  const colZero = `rgba(${c.c[0]},${c.c[1]},${c.c[2]},0)`;

  return (
    <Group opacity={opacity}>
      <Circle c={center} r={radius}>
        <RadialGradient c={center} r={radius} colors={[col, colHalf, colZero]} positions={[0, 0.42, 1]} />
      </Circle>
    </Group>
  );
};

// ── 星の1群（まばたきを共有） ──
const StarLayer: React.FC<{
  g: StarGroup;
  clock: SharedValue<number>;
  stop: SharedValue<boolean>;
}> = ({ g, clock, stop }) => {
  const opacity = useDerivedValue(() => {
    const t = stop.value ? 0 : clock.value / 1000;
    return g.b * (0.16 + 0.84 * (0.5 + 0.5 * Math.sin(t * g.f + g.ph)));
  }, [clock]);
  return <Path path={g.path} color="rgb(200,214,252)" opacity={opacity} />;
};

export type NebulaBandProps = {
  paused?: boolean;
};

export const NebulaBand: React.FC<NebulaBandProps> = ({ paused = false }) => {
  const { width: W, height: H } = useWindowDimensions();
  const scale = W / REF_W;

  // reduce-motion → 静止画
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      // @ts-ignore
      sub?.remove?.();
    };
  }, []);

  const clock = useClock();
  const stop = useSharedValue(paused || reduced);
  useEffect(() => {
    stop.value = paused || reduced;
  }, [paused, reduced, stop]);

  const clouds = useMemo(buildClouds, []);
  const starGroups = useMemo(() => buildStarGroups(W, H), [W, H]);

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width: W, height: H }]} pointerEvents="none">
      {/* bgbase: radial(125% 95% at 50% 28%) #15132e → #0c0a1f → #07060f
          横 rx=1.25W の正円を縦に 0.95H/1.25W へ圧縮して楕円化 */}
      <Group
        transform={[
          { translateX: W / 2 },
          { translateY: H * 0.28 },
          { scaleY: (H * 0.95) / (W * 1.25) },
          { translateX: -W / 2 },
          { translateY: -H * 0.28 },
        ]}
      >
        <Circle cx={W / 2} cy={H * 0.28} r={W * 1.25}>
          <RadialGradient
            c={vec(W / 2, H * 0.28)}
            r={W * 1.25}
            colors={['#15132e', '#0c0a1f', '#07060f']}
            positions={[0, 0.55, 1]}
          />
        </Circle>
      </Group>

      {/* 雲（帯）: 加算系合成 + blur13 で外縁を溶かす */}
      <Group
        layer={
          <Paint blendMode="screen">
            <Blur blur={13 * scale} />
          </Paint>
        }
      >
        {clouds.map((c, i) => (
          <CloudBlob key={i} c={c} W={W} H={H} scale={scale} clock={clock} stop={stop} />
        ))}
      </Group>

      {/* 星（シャープ・まばたき） */}
      <Group layer={<Paint blendMode="screen" />}>
        {starGroups.map((g, i) => (
          <StarLayer key={i} g={g} clock={clock} stop={stop} />
        ))}
      </Group>
    </Canvas>
  );
};

export default NebulaBand;
