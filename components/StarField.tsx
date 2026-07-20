/**
 * StarField.tsx — ホーム背景の星（v99 `.bgstars` 準拠・高再現実装）
 * ------------------------------------------------------------------
 * 参照: fr_v99_tsubasa.html `buildStars()`（596-612行）/ `@keyframes tw`（23行）。
 * 参照は DOM div ×479 を CSS keyframe で明滅させる実装。それを Skia へ移植する。
 *
 * 遠近3層（参照の n0/n1/n2 をそのまま計算）:
 *   層0 遠景 317個: 径 rand(0.5,1.0)×0.8 / 基輝度 rand(.05,.16)×1.6 / blur 0.4px / ハロー無し
 *   層1 中景 126個: 径 rand(1.1,1.7)×0.8 / 基輝度 rand(.20,.40)×1.6 / ハロー 1.3× rgba(200,220,255,.35)
 *   層2 近景  36個: 径 rand(2.0,2.9)×0.8 / 基輝度 rand(.42,.62)×1.6 / ハロー 2.2× rgba(200,230,250,.7)
 *
 * 明滅: 参照は `tw` keyframe（0%,100%=o0 / 50%=o1・ease-in-out・周期 rand(2.2,5.2)/2.5
 *   = 0.88〜2.08秒）を負の delay で位相をバラつかせる。ease-in-out の2点補間は
 *   余弦と実質同形なので o(t) = o0 + (o1-o0)·(0.5-0.5·cos(2π(t+ph)/dur)) で置換。
 *
 * 移植ノート:
 *   ・乱数は決定論ハッシュ（NebulaBand と同方式。再レンダーで模様が変わらない）
 *   ・明滅は群に量子化して Path をまとめ、derived value 数を抑える
 *     （479個 → 8+12+36 = 56群。層2は目立つので星ごと＝1星1群）
 *   ・ハローは参照の box-shadow の代替。CSS の blur 半径 B に対し σ=B/2 で近似し、
 *     層内の平均径で1つの σ に丸める（層内の径のばらつきは小さい）
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
  Group,
  Path,
  Blur,
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

const REF_W = 380;                          // 参照の内部座標幅（デバイス枠）
const STAR_COLOR = 'rgb(238,243,255)';      // #eef3ff
const SIZE_K = Math.max(P_SIZE, 0.5) * 1.6; // = 0.8（径への共通係数）

// 参照の層別個数: 317 / 126 / 36（計479）
const N0 = Math.round(P_COUNT * 0.58 * 1.3 * 1.4);
const N1 = Math.round(P_COUNT * 0.3 * 1.4);
const N2 = Math.round(P_COUNT * 0.12);

type LayerSpec = {
  n: number;
  groups: number;              // 明滅の群数（層2は n と同数＝星ごと）
  sMin: number; sMax: number;  // 径レンジ（SIZE_K 適用前）
  oMin: number; oMax: number;  // 基輝度レンジ（P_BRIGHT 適用前）
  blur: number;                // 参照 filter:blur(px)
  halo: number;                // 参照 box-shadow の径倍率（0=なし）
  haloColor: string;
};

const LAYERS: LayerSpec[] = [
  { n: N0, groups: 8,  sMin: 0.5, sMax: 1.0, oMin: 0.05, oMax: 0.16, blur: 0.4, halo: 0,   haloColor: '' },
  { n: N1, groups: 12, sMin: 1.1, sMax: 1.7, oMin: 0.2,  oMax: 0.4,  blur: 0,   halo: 1.3, haloColor: 'rgba(200,220,255,0.35)' },
  { n: N2, groups: N2, sMin: 2.0, sMax: 2.9, oMin: 0.42, oMax: 0.62, blur: 0,   halo: 2.2, haloColor: 'rgba(200,230,250,0.7)' },
];

// 決定論ハッシュ（0..1）— NebulaBand と同方式
function hash(x: number): number {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}
const rnd = (seed: number, a: number, b: number) => a + hash(seed) * (b - a);

type TwinkleGroup = {
  path: SkPath;
  o0: number;  // 谷（keyframe 0%,100%）
  o1: number;  // 山（keyframe 50%）
  w: number;   // 角速度 = 2π/dur
  ph: number;  // 位相（参照の負 animation-delay 相当）
};

type BuiltLayer = {
  spec: LayerSpec;
  groups: TwinkleGroup[];
  blurSigma: number;  // filter:blur 相当
  haloSigma: number;  // box-shadow blur 相当（層内平均径で丸め）
};

function buildLayers(W: number, H: number): BuiltLayer[] {
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
      const size = rnd(si + 3.1, spec.sMin, spec.sMax) * SIZE_K;
      groups[i % spec.groups].path.addCircle(x, y, (size / 2) * scale);
    }

    // ハローは層内の平均径で σ を1つに丸める（CSS box-shadow blur B → σ=B/2）
    const meanSize = ((spec.sMin + spec.sMax) / 2) * SIZE_K;
    return {
      spec,
      groups,
      blurSigma: spec.blur * scale,
      haloSigma: ((meanSize * spec.halo) / 2) * scale,
    };
  });
}

// ── 1群（明滅を共有する星の集合） ──
const StarGroup: React.FC<{
  g: TwinkleGroup;
  blurSigma: number;
  haloSigma: number;
  haloColor: string;
  clock: SharedValue<number>;
  stop: SharedValue<boolean>;
}> = ({ g, blurSigma, haloSigma, haloColor, clock, stop }) => {
  const opacity = useDerivedValue(() => {
    // 停止時は谷=基輝度で静止（参照の初期 style.opacity=o0 と同じ）
    if (stop.value) return g.o0;
    const t = clock.value / 1000;
    return g.o0 + (g.o1 - g.o0) * (0.5 - 0.5 * Math.cos((t + g.ph) * g.w));
  }, [clock]);

  return (
    <Group opacity={opacity}>
      {haloSigma > 0 && (
        <Path path={g.path} color={haloColor}>
          <Blur blur={haloSigma} />
        </Path>
      )}
      <Path path={g.path} color={STAR_COLOR}>
        {blurSigma > 0 && <Blur blur={blurSigma} />}
      </Path>
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
          <StarGroup
            key={`${li}-${gi}`}
            g={g}
            blurSigma={l.blurSigma}
            haloSigma={l.haloSigma}
            haloColor={l.spec.haloColor}
            clock={clock}
            stop={stop}
          />
        )),
      )}
    </Canvas>
  );
};

export default StarField;
