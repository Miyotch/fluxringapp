/**
 * StarSeal.tsx — 調律陣（Star Seal）背景装飾
 * ------------------------------------------------------------------
 * 純正律を可視化した発光する幾何の魔法陣。カード背後の背景レイヤーに常時表示。
 * 単一 Skia <Canvas> を 3層（Group）で構成:
 *   ① ink : 静的な骨格線画（細い白線）
 *   ② glow: ノード/線のグロー（screen 合成 + Blur）
 *   ③ sig : 幾何の線上を走る光点（最大36・シムシティの車のように、
 *           六芒星の辺・同心円・シューマン線からランダムに道を選んで移動）
 *
 * 幾何はすべて中心 (CX,CY) を原点に極座標で算出（useMemo・中心変化時のみ再計算）。
 * アニメは useClock（breath とスパーク）。paused / reduce-motion で停止（静的表示）。
 *
 * トーン（v86/v88）: 縁の強い光なし・ノードグローは控えめ・寒色系のみ。
 */

import React, { useMemo, useEffect, useState } from 'react';
import { AccessibilityInfo, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';
import {
  Canvas,
  Group,
  Circle,
  Line,
  Paint,
  Blur,
  vec,
  useClock,
} from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, SharedValue } from 'react-native-reanimated';

// ── 寒色パレット（rgb 0-1 → rgba 文字列） ──
const CYAN = 'rgba(96,206,224,1)';   // rgb(0.376,0.808,0.878)
const BLUE = 'rgba(69,133,224,1)';   // rgb(0.27,0.52,0.88)
const PURPLE = 'rgba(125,97,214,1)'; // rgb(0.49,0.38,0.84)
const INK = 'rgba(237,242,248,0.3)';

// ── スケール定数 ──
const K = 2.07;
const R_IN = 93 * K;
const R_SCALE = 86 * K;
const R_HEX = R_IN / Math.SQRT2 / Math.sqrt(1.5); // = R_IN/√3
const NODE_SCALE = 1.9; // ノード素半径→描画半径の倍率（実機調整ポイント）
const SPARK_COUNT = 36;

type Node = { x: number; y: number; r: number; color: string };

type Geometry = {
  hexEdges: number[][]; // [x1,y1,x2,y2]
  circles: { r: number; opacity: number }[];
  schu: number[]; // [x1,y1,x2,y2]
  nodes: Node[];
  // 光点が走る「道」: 線分（六芒星の辺＋シューマン線）と円（同心円）
  roadSegs: number[];  // flat [x1,y1,x2,y2, ...]
  roadCircs: number[]; // flat [cx,cy,r, ...]
};

function buildGeometry(cx: number, cy: number): Geometry {
  const pol = (r: number, deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const nodes: Node[] = [];

  // 純正律スケール8音（基準432Hz=1/1）
  const freqs = [432, 486, 540, 576, 648, 720, 810, 864];
  freqs.forEach((f, i) => {
    const ang = -90 + Math.log2(f / 432) * 360;
    const isOct = i === 7;
    const rr = isOct ? R_SCALE / 2 : R_SCALE;
    const [x, y] = pol(rr, ang);
    const baseR = i === 0 ? 2.6 : 1.6;
    nodes.push({ x, y, r: baseR, color: i === 0 ? CYAN : isOct ? BLUE : CYAN });
  });

  // 六芒星（2つの正三角形）
  const A: [number, number][] = [pol(R_IN, -90), pol(R_IN, 30), pol(R_IN, 150)];
  const B: [number, number][] = [pol(R_IN, 90), pol(R_IN, 210), pol(R_IN, 330)];
  const hexEdges: number[][] = [];
  const triEdges = (t: [number, number][]) => {
    for (let i = 0; i < 3; i++) {
      const p = t[i];
      const q = t[(i + 1) % 3];
      hexEdges.push([p[0], p[1], q[0], q[1]]);
    }
  };
  triEdges(A);
  triEdges(B);

  // 内接六角形ノード
  [0, 60, 120, 180, 240, 300].forEach((a) => {
    const [x, y] = pol(R_HEX, a);
    nodes.push({ x, y, r: 1.0, color: BLUE });
  });

  // テトラクティス（4段の三角点群）
  const rowY = [-43, -14.5, 14.5, 43];
  const sp = 29;
  for (let r0 = 0; r0 < 4; r0++) {
    const n = r0 + 1;
    for (let k = 0; k < n; k++) {
      const x = cx + (k - (n - 1) / 2) * sp;
      const y = cy + rowY[r0];
      nodes.push({ x, y, r: 0.9, color: PURPLE });
    }
  }

  // 倍音星（外周へ昇る）
  const harm = [
    { f: 1296, R: 232 },
    { f: 4752, R: 260 },
    { f: 2592, R: 352 },
    { f: 9504, R: 390 },
  ];
  harm.forEach(({ f, R }) => {
    const ang = -90 + ((Math.log2(f / 432)) % 1) * 360;
    const [x, y] = pol(R, ang);
    nodes.push({ x, y, r: 1.4, color: CYAN });
  });

  // シューマン共振ノード（中心の下方へ。原 spec の (140,704) を中心相対に換算）
  const [sx, sy] = pol(305, 108);
  nodes.push({ x: sx, y: sy, r: 1.5, color: BLUE });
  // 内側 pol(R_IN,90) から SCHU へ細線
  const [ix, iy] = pol(R_IN, 90);
  const schu = [ix, iy, sx, sy];

  // 同心円3本
  const circles = [
    { r: R_IN, opacity: 0.34 },
    { r: 300, opacity: 0.15 },
    { r: 435, opacity: 0.15 },
  ];

  // 光点の「道」: 六芒星の6辺 ＋ シューマン線（線分）と、同心円3本（円弧）
  const roadSegs: number[] = [];
  hexEdges.forEach((e) => roadSegs.push(e[0], e[1], e[2], e[3]));
  roadSegs.push(schu[0], schu[1], schu[2], schu[3]);
  const roadCircs: number[] = [];
  circles.forEach((c) => roadCircs.push(cx, cy, c.r));

  return { hexEdges, circles, schu, nodes, roadSegs, roadCircs };
}

// 決定論的ハッシュ（0..1）
function hash(x: number): number {
  'worklet';
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

type SparkParam = { i: number; speed: number; phase: number; color: string };

/**
 * 道上の光点の位置（x/y 共通の計算・worklet）。
 * 1サイクル = 1本の道（線分 or 円弧）を端から端まで走る。
 * サイクルごとに hash で「どの道か・向き・（円は）開始角と弧の長さ」を決める
 * ＝シムシティの車のように、毎回ちがう道をランダムに巡回する。
 */
function roadPos(
  i: number,
  u: number,
  segs: number[],
  circ: number[],
  axis: 0 | 1, // 0=x, 1=y
): number {
  'worklet';
  const nSeg = segs.length / 4;
  const nCirc = circ.length / 3;
  const total = nSeg + nCirc;
  if (total === 0) return -1000;
  const cyc = Math.floor(u);
  const frac = u - cyc;
  const ri = Math.floor(hash(i * 7.13 + cyc * 3.7) * total) % total;
  if (ri < nSeg) {
    // 線分: 向きは半々でランダム
    const t = hash(i * 1.7 + cyc * 2.3) < 0.5 ? frac : 1 - frac;
    const o = ri * 4 + axis;
    return segs[o] + (segs[o + 2] - segs[o]) * t;
  }
  // 円弧: 開始角・回転方向・弧の長さ（周の 22〜48%）をランダムに
  const ci = (ri - nSeg) * 3;
  const a0 = hash(i * 4.1 + cyc * 5.9) * Math.PI * 2;
  const dir = hash(i * 3.3 + cyc * 1.9) < 0.5 ? 1 : -1;
  const arc = (0.22 + hash(i * 6.7 + cyc * 4.3) * 0.26) * Math.PI * 2;
  const a = a0 + dir * frac * arc;
  return axis === 0 ? circ[ci] + circ[ci + 2] * Math.cos(a) : circ[ci + 1] + circ[ci + 2] * Math.sin(a);
}

// ── 1つの光点（共有クロックから自分の走行位置を導出） ──
const Spark: React.FC<{
  p: SparkParam;
  clock: SharedValue<number>;
  segsSV: SharedValue<number[]>;
  circsSV: SharedValue<number[]>;
  stopSV: SharedValue<boolean>;
}> = ({ p, clock, segsSV, circsSV, stopSV }) => {
  const { i, speed, phase } = p;

  const cx = useDerivedValue(() => {
    if (stopSV.value) return -1000;
    const u = (clock.value / 1000) * speed + phase;
    return roadPos(i, u, segsSV.value, circsSV.value, 0);
  }, [clock]);

  const cy = useDerivedValue(() => {
    if (stopSV.value) return -1000;
    const u = (clock.value / 1000) * speed + phase;
    return roadPos(i, u, segsSV.value, circsSV.value, 1);
  }, [clock]);

  const opacity = useDerivedValue(() => {
    if (stopSV.value) return 0;
    const u = (clock.value / 1000) * speed + phase;
    const frac = u - Math.floor(u);
    // 走り始め/終わりでフェード（道の乗り換えを目立たせない）
    const env = Math.min(frac / 0.12, 1, (1 - frac) / 0.12);
    return Math.max(0, env) * 0.85;
  }, [clock]);

  return <Circle cx={cx} cy={cy} r={1.8} color={p.color} opacity={opacity} />;
};

// ─────────────────────────────────────────────

export type StarSealProps = {
  centerX?: number;
  centerY?: number;
  paused?: boolean;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export const StarSeal: React.FC<StarSealProps> = ({
  centerX,
  centerY,
  paused = false,
  width,
  height,
  style,
}) => {
  const win = useWindowDimensions();
  const W = width ?? win.width;
  const H = height ?? win.height;
  const CX = centerX ?? W / 2;
  const CY = centerY ?? H / 2;

  const geo = useMemo(() => buildGeometry(CX, CY), [CX, CY]);

  // reduce-motion
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      // @ts-ignore RN の戻り値は EmitterSubscription
      sub?.remove?.();
    };
  }, []);

  const clock = useClock();
  const stopSV = useSharedValue<boolean>(paused || reduced);
  const segsSV = useSharedValue<number[]>(geo.roadSegs);
  const circsSV = useSharedValue<number[]>(geo.roadCircs);
  useEffect(() => {
    stopSV.value = paused || reduced;
  }, [paused, reduced, stopSV]);
  useEffect(() => {
    segsSV.value = geo.roadSegs;
    circsSV.value = geo.roadCircs;
  }, [geo.roadSegs, geo.roadCircs, segsSV, circsSV]);

  // breath → グロー層の全体明度に br を掛ける
  const glowOpacity = useDerivedValue(() => {
    if (stopSV.value) return 0.93;
    const t = clock.value / 1000;
    const breath = 0.5 + 0.5 * Math.sin((t / 3) * Math.PI * 2);
    return 0.86 + 0.14 * breath;
  }, [clock]);

  // 光点のパラメータ（36個）。speed はサイクル/秒（1本の道を 3〜8 秒で走る）
  const sparks = useMemo<SparkParam[]>(() => {
    const colors = [CYAN, BLUE, PURPLE];
    return Array.from({ length: SPARK_COUNT }, (_, i) => ({
      i,
      speed: 0.12 + hash(i * 2.3) * 0.18,
      phase: hash(i * 9.1),
      color: colors[i % 3],
    }));
  }, []);

  return (
    <Canvas style={[{ width: W, height: H }, style]} pointerEvents="none">
      {/* ① ink：静的な骨格線画 */}
      <Group>
        {geo.hexEdges.map((e, i) => (
          <Line key={`h${i}`} p1={vec(e[0], e[1])} p2={vec(e[2], e[3])} color={INK} style="stroke" strokeWidth={1} />
        ))}
        {geo.circles.map((c, i) => (
          <Circle
            key={`c${i}`}
            cx={CX}
            cy={CY}
            r={c.r}
            style="stroke"
            strokeWidth={1}
            color={`rgba(237,242,248,${c.opacity})`}
          />
        ))}
        <Line
          p1={vec(geo.schu[0], geo.schu[1])}
          p2={vec(geo.schu[2], geo.schu[3])}
          color="rgba(237,242,248,0.09)"
          style="stroke"
          strokeWidth={1}
        />
      </Group>

      {/* ② glow：ノード/線のグロー（screen 合成 + Blur・breath で明度） */}
      <Group
        opacity={glowOpacity}
        layer={
          <Paint blendMode="screen">
            <Blur blur={5} />
          </Paint>
        }
      >
        {/* 線のグロー（六芒星を薄く） */}
        {geo.hexEdges.map((e, i) => (
          <Line
            key={`gh${i}`}
            p1={vec(e[0], e[1])}
            p2={vec(e[2], e[3])}
            color="rgba(96,206,224,0.28)"
            style="stroke"
            strokeWidth={1.5}
          />
        ))}
        {/* ノードのグロー */}
        {geo.nodes.map((n, i) => (
          <Circle key={`n${i}`} cx={n.x} cy={n.y} r={n.r * NODE_SCALE} color={n.color} opacity={0.9} />
        ))}
      </Group>

      {/* ③ sig：幾何の線上を走る光点（screen 合成 + Blur） */}
      <Group
        layer={
          <Paint blendMode="screen">
            <Blur blur={3} />
          </Paint>
        }
      >
        {sparks.map((p) => (
          <Spark key={p.i} p={p} clock={clock} segsSV={segsSV} circsSV={circsSV} stopSV={stopSV} />
        ))}
      </Group>
    </Canvas>
  );
};

export default StarSeal;
