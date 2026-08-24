/**
 * StarField.tsx — ホーム背景の星（v99 `.bgstars` 準拠・高再現実装）
 * ------------------------------------------------------------------
 * 参照: fr_v99_tsubasa.html `buildStars()`（596-612行）/ `@keyframes tw`（23行）。
 * 参照は DOM div ×479 を CSS keyframe で明滅させる実装。それを Skia へ移植する。
 *
 * 遠近3層（参照の n0/n1/n2 をそのまま計算）:
 *   層0 遠景 317個: 径 rand(0.5,1.0)×0.8 / 基輝度 rand(.05,.16)×1.6 / ハロー無し
 *   層1 中景 126個: 径 rand(1.1,1.7)×0.8 / 基輝度 rand(.20,.40)×1.6 / ハロー 1.3× rgba(200,220,255,.35)
 *   層2 近景  36個: 径 rand(2.0,2.9)×0.8 / 基輝度 rand(.42,.62)×1.6 / ハロー 2.2× rgba(200,230,250,.7)
 *   ※径は SIZE_TUNE でさらに縮小（実機フィードバック反映・下記）
 *
 * 明滅: 参照は `tw` keyframe（0%,100%=o0 / 50%=o1・ease-in-out・周期 rand(2.2,5.2)/2.5
 *   = 0.88〜2.08秒）を負の delay で位相をバラつかせる。ease-in-out の2点補間は
 *   余弦と実質同形なので o(t) = o0 + (o1-o0)·(0.5-0.5·cos(2π(t+ph)/dur)) で置換。
 *
 * 移植ノート:
 *   ・乱数は決定論ハッシュ（NebulaBand と同方式。再レンダーで模様が変わらない）
 *   ・明滅は群に量子化して Path をまとめ、derived value 数を抑える
 *     （479個 → 8+12+36 = 56群。層2は目立つので星ごと＝1星1群）
 *   ・ハローは参照の box-shadow の代替。当初は Path+Blur で近似したが、
 *     毎フレーム 48 回の saveLayer（オフスクリーン合成）が走り実機で重かった
 *     ため、星ごとの RadialGradient 円（中心=ハロー色 → 外周=透明）に変更。
 *     Blur を使わないので saveLayer ゼロ。box-shadow '0 0 Bpx' の視覚半径
 *     ≈ 星半径 + B をグラデ円の半径にとる
 *   ・参照の層0 filter:blur(0.4px) は知覚できる差がほぼ無いわりに saveLayer
 *     を要するため省略（かわりの霞は基輝度がそのまま担う）
 *   ・背景（bgbase）は NebulaBand 側が描くので、この層は透明で重ねる
 *   ・paused / reduce-motion で明滅停止（静止表示）
 *
 * 未移植（意図的）:
 *   ・カードのフリップ量に連動する横パララックス（参照 animateBG: translateX(shift*-7)）
 */

import React, { useMemo, useEffect, useState } from 'react';
import { AccessibilityInfo, useWindowDimensions, StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  vec,
  useClock,
  Skia,
  SkPath,
} from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, SharedValue } from 'react-native-reanimated';

// ── 参照実装のパラメータ（P オブジェクト・682行） ──
const P_COUNT = 300;
const P_SIZE = 0.5;
const P_BRIGHT = 1.6;
const P_TWINKLE = 2.5;

const REF_W = 380;                             // 参照の内部座標幅（デバイス枠）
export const STAR_COLOR = 'rgb(238,243,255)';  // #eef3ff
const SIZE_K = Math.max(P_SIZE, 0.5) * 1.6; // = 0.8（径への共通係数）

// ── 実機調整ポイント ──
// 星の全体スケール。1.0 = 参照 v99 の数値どおり。
// 2026-07-21 の実機フィードバックで 0.7 / 0.85 へ縮小していたが、参照HTMLへの
// 忠実再現を優先して参照値へ戻した（2026-08-17）。実機で再び目立ちすぎる場合は
// ここだけ下げれば戻せる。
const SIZE_TUNE = 1.0;          // 星の径（ハローも比例して縮む）
export const HALO_TUNE = 1.0;   // ハローの強さ（α に乗算）

// 参照の層別個数: 317 / 126 / 36（計479）
const N0 = Math.round(P_COUNT * 0.58 * 1.3 * 1.4);
const N1 = Math.round(P_COUNT * 0.3 * 1.4);
const N2 = Math.round(P_COUNT * 0.12);

export type LayerSpec = {
  n: number;
  groups: number;              // 明滅の群数（層2は n と同数＝星ごと）
  sMin: number; sMax: number;  // 径レンジ（SIZE_K 適用前）
  oMin: number; oMax: number;  // 基輝度レンジ（P_BRIGHT 適用前）
  halo: number;                // 参照 box-shadow の径倍率（0=なし）
  haloRGB: string;             // ハロー色（'r,g,b'）
  haloA: number;               // ハロー色の α（参照 box-shadow の α）
};

const LAYERS: LayerSpec[] = [
  { n: N0, groups: 8,  sMin: 0.5, sMax: 1.0, oMin: 0.05, oMax: 0.16, halo: 0,   haloRGB: '',            haloA: 0 },
  { n: N1, groups: 12, sMin: 1.1, sMax: 1.7, oMin: 0.2,  oMax: 0.4,  halo: 1.3, haloRGB: '200,220,255', haloA: 0.35 },
  { n: N2, groups: N2, sMin: 2.0, sMax: 2.9, oMin: 0.42, oMax: 0.62, halo: 2.2, haloRGB: '200,230,250', haloA: 0.7 },
];

// 決定論ハッシュ（0..1）— NebulaBand と同方式
function hash(x: number): number {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}
const rnd = (seed: number, a: number, b: number) => a + hash(seed) * (b - a);

export type HaloDot = { x: number; y: number; r: number };

export type TwinkleGroup = {
  path: SkPath;      // 星本体（群でまとめて1パス）
  halos: HaloDot[];  // ハロー（星ごとのグラデ円。halo=0 の層は空）
  o0: number;        // 谷（keyframe 0%,100%）
  o1: number;        // 山（keyframe 50%）
  w: number;         // 角速度 = 2π/dur
  ph: number;        // 位相（参照の負 animation-delay 相当）
};

export type BuiltLayer = {
  spec: LayerSpec;
  groups: TwinkleGroup[];
};

export function buildLayers(W: number, H: number): BuiltLayer[] {
  const scale = W / REF_W;

  return LAYERS.map((spec, li) => {
    const seedL = (li + 1) * 101.7;

    // 群パラメータ（明滅は群で共有・径と位置は星ごと）
    const groups: TwinkleGroup[] = Array.from({ length: spec.groups }, (_, g) => {
      const sg = seedL + g * 47.3;
      const o0 = Math.min(rnd(sg + 1.1, spec.oMin, spec.oMax) * P_BRIGHT, 0.95);
      const o1 = Math.min(1, o0 * rnd(sg + 2.3, 1.8, 2.8));
      const dur = rnd(sg + 3.7, 2.2, 5.2) / P_TWINKLE;
      return {
        path: Skia.Path.Make(),
        halos: [],
        o0,
        o1,
        w: (Math.PI * 2) / dur,
        ph: rnd(sg + 5.9, 0, dur),
      };
    });

    // 星を配置（位置・径は星ごと・群へ振り分け）
    for (let i = 0; i < spec.n; i++) {
      const si = seedL + i * 13.9;
      const x = hash(si + 0.7) * W;
      const y = hash(si + 1.9) * H;
      const size = rnd(si + 3.1, spec.sMin, spec.sMax) * SIZE_K * SIZE_TUNE;
      const g = groups[i % spec.groups];
      g.path.addCircle(x, y, (size / 2) * scale);
      if (spec.halo > 0) {
        // box-shadow '0 0 Bpx'（B = size×halo）の視覚半径 ≈ 星半径 + B
        g.halos.push({ x, y, r: (size / 2 + size * spec.halo) * scale });
      }
    }

    return { spec, groups };
  });
}

// ── 1群（明滅を共有する星の集合） ──
const StarGroup: React.FC<{
  g: TwinkleGroup;
  spec: LayerSpec;
  clock: SharedValue<number>;
  stop: SharedValue<boolean>;
}> = ({ g, spec, clock, stop }) => {
  const opacity = useDerivedValue(() => {
    // 停止時は谷=基輝度で静止（参照の初期 style.opacity=o0 と同じ）
    if (stop.value) return g.o0;
    const t = clock.value / 1000;
    return g.o0 + (g.o1 - g.o0) * (0.5 - 0.5 * Math.cos((t + g.ph) * g.w));
  }, [clock]);

  const haloIn = `rgba(${spec.haloRGB},${(spec.haloA * HALO_TUNE).toFixed(3)})`;
  const haloOut = `rgba(${spec.haloRGB},0)`;

  return (
    <Group opacity={opacity}>
      {g.halos.map((h, i) => (
        <Circle key={i} cx={h.x} cy={h.y} r={h.r}>
          <RadialGradient c={vec(h.x, h.y)} r={h.r} colors={[haloIn, haloOut]} />
        </Circle>
      ))}
      <Path path={g.path} color={STAR_COLOR} />
    </Group>
  );
};

export type StarFieldProps = {
  /** 描画領域。省略時はウィンドウ全体 */
  width?: number;
  height?: number;
  paused?: boolean;
};

export const StarField: React.FC<StarFieldProps> = ({ width, height, paused = false }) => {
  const win = useWindowDimensions();
  const W = width ?? win.width;
  const H = height ?? win.height;

  // reduce-motion → 明滅停止
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      // @ts-ignore RN のバージョン差で remove の有無が変わる
      sub?.remove?.();
    };
  }, []);

  const clock = useClock();
  const stop = useSharedValue(paused || reduced);
  useEffect(() => {
    stop.value = paused || reduced;
  }, [paused, reduced, stop]);

  const layers = useMemo(() => buildLayers(W, H), [W, H]);

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width: W, height: H }]} pointerEvents="none">
      {/* 遠景 → 近景の順に重ねる（参照の DOM 生成順と同じ） */}
      {layers.map((l, li) =>
        l.groups.map((g, gi) => (
          <StarGroup key={`${li}-${gi}`} g={g} spec={l.spec} clock={clock} stop={stop} />
        )),
      )}
    </Canvas>
  );
};

export default StarField;
