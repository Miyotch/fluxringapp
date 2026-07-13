/**
 * StarSeal.tsx — 調律陣（Star Seal v85 準拠・高再現実装）
 * ------------------------------------------------------------------
 * 参照: star_seal_standalone（v98_FIX 原文切出し）。3層構成を Skia で移植:
 *   ① ink : 静的彫刻層（Canvas2D → Skia Path/Text）
 *       二重リング・外方波及帯（72目盛/232菱形/260点列/352複線/316点列/
 *       390目盛/435円/24放射/ローマ数字リング）・縄目帯・目盛144・十二芒星・
 *       放射24・モノコード弦＋比率目盛・2/1回帰弧・6弁ロゼット・頂点菱形・
 *       音階星四方点・銘文2帯・Λ数列・音階/倍音/シューマン ラベル
 *   ② glow: 発光層（WebGL screen合成 → Skia screen+Blur・呼吸 0.86+0.14sin）
 *       同心円3・六芒星6辺＋シューマン線・全ノード（主音のみシアン＋十字光条、
 *       他は白系）
 *   ③ sig : 信号層（通電表現）
 *       幾何路（同心円9・放射・六芒星辺・十二芒星弦・弦スポーク）を
 *       尾を引く光点が定速走行（速度・輝度は基準比-30%系の参照値）＋
 *       幾何上に明滅するスパーク
 *
 * 座標系: 参照実装の内部単位（K=2.07・カード幅188.59）をそのまま使い、
 *   s = cardWidth / 188.59 で実寸へ等倍スケール。中心はカード中心。
 * 全乱数は決定論ハッシュ（再レンダーで模様不変）。
 * paused / reduce-motion で動的要素停止（ink/glow は静的表示）。
 */

import React, { useMemo, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleProp, ViewStyle } from 'react-native';
import {
  Canvas,
  Group,
  Circle,
  Line,
  Path,
  Text as SkText,
  Paint,
  Blur,
  DashPathEffect,
  vec,
  useClock,
  matchFont,
  Skia,
  SkPath,
  SkFont,
} from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, SharedValue } from 'react-native-reanimated';

// ── 参照定数（内部単位） ──
const K = 2.07;
const R_TXT = 96.5 * K;
const R_IN = 93 * K;
const R_TICK = 89 * K;
const R_SCALE = 86 * K;
const R_HEX = R_IN / Math.sqrt(3);
const RATIO = [9 / 8, 5 / 4, 4 / 3, 3 / 2, 2];
const REF_CARD_W = 188.59; // 参照のカード幅（この比で実寸へスケール）
const CYAN = 'rgba(96,206,224,1)';
const N_SPARKS = 24;

const ink = (a: number) => `rgba(150,190,210,${a})`;
const lab = (a: number) => `rgba(178,198,216,${a})`;

// 決定論ハッシュ（0..1）
function hash(x: number): number {
  'worklet';
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

// ══════ 幾何構築 ══════

type StrokeGroup = { path: SkPath; color: string; width: number; dash?: number[] };
type FillGroup = { path: SkPath; color: string };
type TxtItem = {
  text: string; x: number; y: number; rot: number;
  size: number; color: string; align: 'c' | 'l' | 'r'; voff: number;
};
type GlowCircle = { r: number; op: number };
type GlowSeg = { x1: number; y1: number; x2: number; y2: number; op: number };
type GlowNode = { x: number; y: number; r: number; main: boolean };
export type CarParam = {
  kind: 0 | 1;              // 0=円 1=線分
  cx: number; cy: number; r: number;          // 円
  x1: number; y1: number; x2: number; y2: number; // 線分
  t0: number; vn: number;   // 初期位相・正規化速度（周/秒・符号=向き）
  sz: number; al: number; tail: number;       // 見た目
};

type Geometry = {
  strokes: StrokeGroup[];
  fills: FillGroup[];
  texts: TxtItem[];
  glowCircles: GlowCircle[];
  glowSegs: GlowSeg[];
  glowNodes: GlowNode[];
  sparkPool: number[]; // [x,y,...]
  cars: CarParam[];
};

function buildGeometry(cx: number, cy: number, s: number, W: number, H: number): Geometry {
  const U = (v: number) => v * s;
  const pol = (r: number, deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [cx + U(r) * Math.cos(a), cy + U(r) * Math.sin(a)];
  };
  const D2 = Math.PI / 180;

  // ストローク/フィルは (色,太さ,破線) 単位で1本の SkPath にまとめる
  const strokeMap = new Map<string, StrokeGroup>();
  const fillMap = new Map<string, FillGroup>();
  const P = (alpha: number, width: number, dash?: number[]) => {
    const key = `${alpha}|${width}|${dash ? dash.join(',') : ''}`;
    let e = strokeMap.get(key);
    if (!e) {
      e = { path: Skia.Path.Make(), color: ink(alpha), width: U(width), dash: dash?.map((d) => U(d)) };
      strokeMap.set(key, e);
    }
    return e.path;
  };
  const F = (alpha: number) => {
    let e = fillMap.get(String(alpha));
    if (!e) {
      e = { path: Skia.Path.Make(), color: ink(alpha) };
      fillMap.set(String(alpha), e);
    }
    return e.path;
  };
  const seg = (a: [number, number], b: [number, number], alpha: number, w = 0.5) => {
    const p = P(alpha, w);
    p.moveTo(a[0], a[1]);
    p.lineTo(b[0], b[1]);
  };
  const circle = (r: number, alpha: number, w = 0.5, dash?: number[]) =>
    P(alpha, w, dash).addCircle(cx, cy, U(r));
  const arc = (x: number, y: number, r: number, a0deg: number, sweepdeg: number, alpha: number, w = 0.5) =>
    P(alpha, w).addArc(Skia.XYWHRect(x - U(r), y - U(r), U(r) * 2, U(r) * 2), a0deg, sweepdeg);
  const dotp = (x: number, y: number, r: number, alpha: number) => F(alpha).addCircle(x, y, U(r));

  const texts: TxtItem[] = [];
  const inBounds = (x: number, y: number, m = 8) =>
    x > -U(m) && x < W + U(m) && y > -U(m) && y < H + U(m);
  const ringText = (txt: string, rUnits: number, fs: number, alpha: number) => {
    const chars = txt.split('');
    const total = chars.length;
    for (let ci = 0; ci < total; ci++) {
      if (chars[ci] === ' ') continue;
      const ang = (ci / total) * Math.PI * 2 - Math.PI / 2;
      const x = cx + U(rUnits) * Math.cos(ang);
      const y = cy + U(rUnits) * Math.sin(ang);
      if (!inBounds(x, y)) continue;
      texts.push({
        text: chars[ci], x, y, rot: ang + Math.PI / 2,
        size: U(fs), color: ink(alpha), align: 'c', voff: U(fs) * 0.35,
      });
    }
  };

  // ── 音階（純正律8音） ──
  const SCALE = [432, 486, 540, 576, 648, 720, 810, 864].map((f, i) => {
    const ang = -90 + Math.log2(f / 432) * 360;
    const oct = i === 7;
    const r = oct ? R_SCALE / 2 : R_SCALE;
    const [x, y] = pol(r, ang);
    return { f, ang, r, x, y, main: i === 0, oct };
  });

  const VA: [number, number][] = [pol(R_IN, -90), pol(R_IN, 30), pol(R_IN, 150)];
  const VB: [number, number][] = [pol(R_IN, 90), pol(R_IN, 210), pol(R_IN, 330)];
  const VTX = VA.concat(VB);
  // シューマン点（参照の絶対座標 [140,704]・中心 (189.96,367.77) を相対換算）
  const SCHU: [number, number] = [cx + U(-49.96), cy + U(336.23)];

  const TETRA: [number, number][] = [];
  {
    const rowY = [-43, -14.5, 14.5, 43];
    const sp = 29;
    for (let r0 = 0; r0 < 4; r0++) {
      const n = r0 + 1;
      for (let k = 0; k < n; k++) TETRA.push([cx + U((k - (n - 1) / 2) * sp), cy + U(rowY[r0])]);
    }
  }
  const OVERT = [
    { f: 1296, R: 232 }, { f: 4752, R: 260 }, { f: 2592, R: 352 }, { f: 9504, R: 390 },
  ].map((o) => {
    const ang = -90 + (Math.log2(o.f / 432) % 1) * 360;
    const [x, y] = pol(o.R, ang);
    return { ...o, ang, x, y };
  });

  // ═══ ① 彫刻層 ═══

  circle(R_IN + 2.9, 0.24, 0.45);
  circle(R_IN - 2.4, 0.16, 0.4);

  // 外方波及帯
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * 360 - 90;
    seg(pol(210.5, a), pol(213, a), 0.16, 0.45);
  }
  circle(232, 0.16, 0.45, [4, 3, 1, 3]);
  for (let i = 0; i < 8; i++) {
    const ad = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const px = cx + U(232) * Math.cos(ad), py = cy + U(232) * Math.sin(ad);
    if (!inBounds(px, py, 6)) continue;
    const rx = Math.cos(ad), ry = Math.sin(ad), nx = -ry, ny = rx;
    const p = P(0.26, 0.5);
    p.moveTo(px + rx * U(2.6), py + ry * U(2.6));
    p.lineTo(px + nx * U(1.5), py + ny * U(1.5));
    p.lineTo(px - rx * U(2.6), py - ry * U(2.6));
    p.lineTo(px - nx * U(1.5), py - ny * U(1.5));
    p.close();
  }
  circle(260, 0.14, 0.45, [3, 5]);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 - Math.PI / 2;
    const px = cx + U(260) * Math.cos(a), py = cy + U(260) * Math.sin(a);
    if (inBounds(px, py, 3)) dotp(px, py, 0.7, 0.18);
  }
  circle(352, 0.14, 0.45, [3, 5]);
  for (let i = 0; i < 12; i++) {
    const ad = (i / 12) * Math.PI * 2 - Math.PI / 2;
    for (const off of [-1.6, 1.6]) {
      const rr = 352 + off;
      const px = cx + U(rr) * Math.cos(ad + 0.008), py = cy + U(rr) * Math.sin(ad + 0.008);
      const qx = cx + U(rr) * Math.cos(ad - 0.008), qy = cy + U(rr) * Math.sin(ad - 0.008);
      if (inBounds(px, py, 4)) seg([qx, qy], [px, py], 0.22, 0.5);
    }
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const px = cx + U(316) * Math.cos(a), py = cy + U(316) * Math.sin(a);
    if (inBounds(px, py, 3)) dotp(px, py, 0.9, 0.22);
  }
  circle(435, 0.16, 0.5);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * 360 - 90;
    seg(pol(R_IN + 6, a), pol(300, a), 0.16, 0.45);
    seg(pol(300, a), pol(470, a), 0.15, 0.5);
  }
  {
    const rt = 'I · II · III · IIII · VIII · IX · XXVII · ';
    ringText(rt + rt + rt + rt, 243, 7.5, 0.18);
  }
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * 360 - 90;
    const [px, py] = pol(390, a);
    if (!inBounds(px, py, 6)) continue;
    seg(pol(385.5, a), [px, py], 0.2, 0.5);
  }
  circle(390, 0.14, 0.5);

  // 縄目帯
  {
    const n = 36, rb = (R_TICK + R_SCALE) / 2 + 1.2, amp = 3.4;
    const p = P(0.26, 0.5);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      const steps = 8;
      for (let s2 = 0; s2 <= steps; s2++) {
        const t = a0 + (a1 - a0) * (s2 / steps);
        const w = Math.sin((s2 / steps) * Math.PI);
        const r2 = rb + (i % 2 ? 1 : -1) * amp * w;
        const x = cx + U(r2) * Math.cos(t), y = cy + U(r2) * Math.sin(t);
        if (s2 === 0) p.moveTo(x, y);
        else p.lineTo(x, y);
      }
    }
  }

  // 目盛144
  for (let i = 0; i < 144; i++) {
    const a = (i / 144) * 360 - 90;
    const major = i % 12 === 0;
    seg(pol(R_TICK - (major ? 6.5 : 3), a), pol(R_TICK, a), 0.3, major ? 0.7 : 0.5);
  }

  // 十二芒星
  const P12: [number, number][] = [];
  for (let i = 0; i < 12; i++) P12.push(pol(R_SCALE, -90 + i * 30));
  for (let i = 0; i < 12; i++) seg(P12[i], P12[(i + 5) % 12], 0.24, 0.5);

  // 放射24（内側）
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * 360 - 90;
    seg(pol(R_HEX + 4, a), pol(R_SCALE - 4, a), 0.12, 0.45);
  }

  // スポーク＝モノコードの弦＋比率目盛
  SCALE.forEach((sc) => {
    const end = sc.oct ? R_SCALE / 2 : R_SCALE;
    seg(pol(R_HEX, sc.ang), pol(end, sc.ang), 0.28, 0.5);
    const dx = Math.cos(sc.ang * D2), dy = Math.sin(sc.ang * D2);
    const nx = -dy, ny = dx;
    RATIO.forEach((q) => {
      const rq = R_SCALE / q;
      if (rq > R_HEX + 2 && rq < end - 2) {
        const px = cx + U(rq) * dx, py = cy + U(rq) * dy;
        seg([px - nx * U(3), py - ny * U(3)], [px + nx * U(3), py + ny * U(3)], 0.3, 0.5);
      }
    });
  });

  // 2/1 回帰弧
  {
    const s864 = SCALE[7];
    arc(cx, cy, R_SCALE / 2, s864.ang - 22, 44, 0.3, 0.5);
    [s864.ang - 22, s864.ang + 22].forEach((adeg) => {
      const aa = adeg * D2;
      const px = cx + U(R_SCALE / 2) * Math.cos(aa), py = cy + U(R_SCALE / 2) * Math.sin(aa);
      const rx = Math.cos(aa), ry = Math.sin(aa);
      seg([px - rx * U(2.4), py - ry * U(2.4)], [px + rx * U(2.4), py + ry * U(2.4)], 0.3, 0.5);
    });
  }

  // 6弁ロゼット
  for (let k = 0; k < 6; k++) {
    const ct = pol(R_HEX, k * 60);
    const base = k * 60 + 180;
    arc(ct[0], ct[1], R_HEX, base - 60, 120, 0.3, 0.5);
  }
  circle(R_HEX, 0.2, 0.45);
  circle(R_HEX - 1.8, 0.14, 0.4);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    dotp(cx + U(R_HEX) * Math.cos(a), cy + U(R_HEX) * Math.sin(a), 0.9, 0.34);
  }

  // 頂点菱形
  VTX.forEach((v) => {
    const ang = Math.atan2(v[1] - cy, v[0] - cx);
    const rx = Math.cos(ang), ry = Math.sin(ang), nx = -ry, ny = rx;
    const L1 = U(4.6), L2 = U(2.7);
    const p = P(0.32, 0.5);
    p.moveTo(v[0] + rx * L1, v[1] + ry * L1);
    p.lineTo(v[0] + nx * L2, v[1] + ny * L2);
    p.lineTo(v[0] - rx * L1, v[1] - ry * L1);
    p.lineTo(v[0] - nx * L2, v[1] - ny * L2);
    p.close();
  });

  // 音階星の四方点
  SCALE.forEach((sc) => {
    const dd = U(5.4);
    ([[dd, 0], [-dd, 0], [0, dd], [0, -dd]] as [number, number][]).forEach((o) => {
      dotp(sc.x + o[0], sc.y + o[1], 0.65, 0.3);
    });
  });

  // 銘文2帯
  const dia = 'DIAPASON · DIAPENTE · DIATESSARON · DITONVS · SEMIDITONVS · TONVS · HARMONIA · ';
  ringText(dia + dia, R_TXT, 8.5, 0.26);
  const rr2 = '1/1 · 9/8 · 5/4 · 4/3 · 3/2 · 5/3 · 15/8 · 2/1 · ';
  ringText(rr2 + rr2 + rr2 + rr2, R_SCALE - 7, 7, 0.22);

  // Λ数列
  {
    const sp = 29, rowY = [-43, -14.5, 14.5, 43];
    const lam = (t: string, x: number, y: number) =>
      texts.push({ text: t, x, y, rot: 0, size: U(8), color: ink(0.3), align: 'c', voff: U(8) * 0.35 });
    lam('1', cx, cy - U(64));
    ([['2', 1], ['4', 2], ['8', 3]] as [string, number][]).forEach(([t, r]) =>
      lam(t, cx - U((r * sp) / 2 + 16), cy + U(rowY[r])));
    ([['3', 1], ['9', 2], ['27', 3]] as [string, number][]).forEach(([t, r]) =>
      lam(t, cx + U((r * sp) / 2 + 16), cy + U(rowY[r])));
  }

  // 音階星ラベル
  SCALE.forEach((sc) => {
    const a = sc.main ? 0.42 : 0.24;
    const fs = sc.main ? 9.5 : 8;
    const dy = Math.sin(sc.ang * D2);
    const inward = sc.x < cx ? 1 : -1;
    let align: 'l' | 'r' | 'c' = inward > 0 ? 'l' : 'r';
    let px = sc.x + inward * U(11);
    let voff = U(fs) * 0.35;
    if (dy < -0.7) voff = -U(6) - U(fs) * 0.1;
    else if (dy > 0.7) voff = U(6) + U(fs) * 0.8;
    let py = sc.y;
    if (Math.abs(sc.x - cx) < U(30)) { align = 'c'; px = sc.x; }
    texts.push({ text: `${sc.f} Hz`, x: px, y: py, rot: 0, size: U(fs), color: lab(a), align, voff });
  });
  // 7.83 Hz
  texts.push({
    text: '7.83 Hz', x: SCHU[0] + U(8), y: SCHU[1], rot: 0,
    size: U(8), color: lab(0.24), align: 'l', voff: U(8) * 0.35,
  });
  // 倍音星の四方点＋ラベル
  OVERT.forEach((o) => {
    if (!inBounds(o.x, o.y, 10)) return;
    const dd = U(4.6);
    ([[dd, 0], [-dd, 0], [0, dd], [0, -dd]] as [number, number][]).forEach((f2) => {
      dotp(o.x + f2[0], o.y + f2[1], 0.6, 0.26);
    });
    const inward = o.x < cx ? 1 : -1;
    texts.push({
      text: `${o.f} Hz`, x: o.x + inward * U(10), y: o.y, rot: 0,
      size: U(7.5), color: lab(0.22), align: inward > 0 ? 'l' : 'r', voff: U(7.5) * 0.35,
    });
  });

  // ═══ ② 発光層データ ═══
  const glowCircles: GlowCircle[] = [
    { r: U(R_IN), op: 0.34 }, { r: U(300), op: 0.15 }, { r: U(435), op: 0.15 },
  ];
  const glowSegs: GlowSeg[] = [];
  const hexPairs: [[number, number], [number, number]][] = [
    [VA[0], VA[1]], [VA[1], VA[2]], [VA[2], VA[0]],
    [VB[0], VB[1]], [VB[1], VB[2]], [VB[2], VB[0]],
  ];
  hexPairs.forEach(([a, b]) => glowSegs.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], op: 0.38 }));
  glowSegs.push({ x1: pol(R_IN, 90)[0], y1: pol(R_IN, 90)[1], x2: SCHU[0], y2: SCHU[1], op: 0.09 });

  const glowNodes: GlowNode[] = [];
  SCALE.forEach((sc) => glowNodes.push({ x: sc.x, y: sc.y, r: U(sc.main ? 2.6 : 1.6), main: sc.main }));
  VTX.forEach((v) => glowNodes.push({ x: v[0], y: v[1], r: U(1.2), main: false }));
  [0, 60, 120, 180, 240, 300].forEach((a) => {
    const p = pol(R_HEX, a);
    glowNodes.push({ x: p[0], y: p[1], r: U(1.0), main: false });
  });
  TETRA.forEach((p) => glowNodes.push({ x: p[0], y: p[1], r: U(0.9), main: false }));
  OVERT.forEach((o) => glowNodes.push({ x: o.x, y: o.y, r: U(1.4), main: false }));
  glowNodes.push({ x: SCHU[0], y: SCHU[1], r: U(1.5), main: false });

  // ═══ ③ 信号層データ ═══

  // スパーク出現候補（参照 randPointOnGeometry の分布を決定論で近似）
  const sparkPool: number[] = [];
  for (let j = 0; j < 140; j++) {
    const pick = hash(j * 1.93 + 0.31);
    let pt: [number, number];
    if (pick < 0.18) {
      pt = pol(R_IN, hash(j * 3.7) * 360);
    } else if (pick < 0.34) {
      const RR = [213, 232, 260, 300, 316, 352, 435][Math.floor(hash(j * 5.1) * 7)];
      pt = pol(RR, hash(j * 7.3) * 360);
    } else if (pick < 0.52) {
      const k = Math.floor(hash(j * 9.7) * 6);
      const ct = pol(R_HEX, k * 60);
      const base = (k * 60 + 180) * D2;
      const a2 = base + (hash(j * 11.3) * 2 - 1) * (Math.PI / 3);
      pt = [ct[0] + U(R_HEX) * Math.cos(a2), ct[1] + U(R_HEX) * Math.sin(a2)];
    } else if (pick < 0.78) {
      const i = Math.floor(hash(j * 13.9) * 12);
      const A = P12[i], B = P12[(i + 5) % 12];
      const t = hash(j * 17.1);
      pt = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
    } else if (pick < 0.95) {
      const [a, b] = hexPairs[Math.floor(hash(j * 19.3) * 6)];
      const t = hash(j * 23.7);
      pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    } else {
      const n = glowNodes[Math.floor(hash(j * 29.1) * glowNodes.length)];
      pt = [n.x, n.y];
    }
    if (inBounds(pt[0], pt[1], 4)) sparkPool.push(pt[0], pt[1]);
  }

  // 光の車（尾を引く光点）: 参照 PATHS の縮約セット
  const cars: CarParam[] = [];
  let seed = 0;
  const addCar = (
    kind: 0 | 1,
    geom: { r?: number; a?: [number, number]; b?: [number, number] },
  ) => {
    seed++;
    const vpx = (8.4 + hash(seed * 3.3 + 1.1) * 12.6) * s; // px/秒
    const dir = hash(seed * 5.7 + 2.9) < 0.5 ? 1 : -1;
    const len = kind === 0
      ? Math.PI * 2 * (geom.r ?? 1)
      : Math.hypot((geom.b![0] - geom.a![0]), (geom.b![1] - geom.a![1]));
    cars.push({
      kind,
      cx, cy, r: geom.r ?? 0,
      x1: geom.a?.[0] ?? 0, y1: geom.a?.[1] ?? 0,
      x2: geom.b?.[0] ?? 0, y2: geom.b?.[1] ?? 0,
      t0: hash(seed * 7.9 + 4.3),
      vn: (vpx / Math.max(len, 1)) * dir,
      sz: 0.9 + hash(seed * 11.1 + 6.1) * 0.4,
      al: 0.3 + hash(seed * 13.7 + 8.7) * 0.15,
      tail: Math.min(16 * s, Math.max(6 * s, vpx * 0.28)),
    });
  };
  // 同心円（参照 cap を縮約: 27台）
  ([[R_HEX, 3], [R_SCALE, 5], [R_IN, 5], [232, 3], [260, 3], [300, 2], [352, 2], [390, 2], [435, 2]] as
    [number, number][]).forEach(([r, cap]) => {
    for (let k = 0; k < cap; k++) addCar(0, { r: U(r) });
  });
  // 六芒星の辺（6台）
  hexPairs.forEach(([a, b]) => addCar(1, { a, b }));
  // 放射（R_HEX+4 → 470）から6本
  for (let i = 0; i < 24; i++) {
    if (i % 4 !== 1) continue;
    const a = (i / 24) * 360 - 90;
    addCar(1, { a: pol(R_HEX + 4, a), b: pol(470, a) });
  }
  // 十二芒星の弦から3本
  for (let i = 0; i < 12; i += 4) addCar(1, { a: P12[i], b: P12[(i + 5) % 12] });
  // 弦スポークから3本
  [0, 3, 5].forEach((i) => {
    const sc = SCALE[i];
    addCar(1, { a: pol(R_HEX, sc.ang), b: pol(sc.oct ? R_SCALE / 2 : R_SCALE, sc.ang) });
  });

  return {
    strokes: [...strokeMap.values()],
    fills: [...fillMap.values()],
    texts,
    glowCircles,
    glowSegs,
    glowNodes,
    sparkPool,
    cars,
  };
}

// ══════ 動的部品 ══════

// 尾を引く光点（1台）
const Car: React.FC<{
  p: CarParam;
  s: number;
  clock: SharedValue<number>;
  stop: SharedValue<boolean>;
}> = ({ p, s, clock, stop }) => {
  const head = useDerivedValue(() => {
    if (stop.value) return vec(-9999, -9999);
    const u = p.t0 + (clock.value / 1000) * p.vn;
    const t = u - Math.floor(u);
    if (p.kind === 0) {
      const a = t * Math.PI * 2;
      return vec(p.cx + p.r * Math.cos(a), p.cy + p.r * Math.sin(a));
    }
    return vec(p.x1 + (p.x2 - p.x1) * t, p.y1 + (p.y2 - p.y1) * t);
  }, [clock]);
  const tail = useDerivedValue(() => {
    if (stop.value) return vec(-9999, -9999);
    const u = p.t0 + (clock.value / 1000) * p.vn;
    const t = u - Math.floor(u);
    let tx: number, ty: number, hx: number, hy: number;
    if (p.kind === 0) {
      const a = t * Math.PI * 2;
      hx = p.cx + p.r * Math.cos(a); hy = p.cy + p.r * Math.sin(a);
      const sg = p.vn >= 0 ? 1 : -1;
      tx = -Math.sin(a) * sg; ty = Math.cos(a) * sg;
    } else {
      hx = p.x1 + (p.x2 - p.x1) * t; hy = p.y1 + (p.y2 - p.y1) * t;
      const L = Math.hypot(p.x2 - p.x1, p.y2 - p.y1) || 1;
      const sg = p.vn >= 0 ? 1 : -1;
      tx = ((p.x2 - p.x1) / L) * sg; ty = ((p.y2 - p.y1) / L) * sg;
    }
    return vec(hx - tx * p.tail, hy - ty * p.tail);
  }, [clock]);

  return (
    <>
      <Line
        p1={tail}
        p2={head}
        color={`rgba(178,230,243,${(p.al * 0.55).toFixed(3)})`}
        style="stroke"
        strokeWidth={1.1 * s}
        strokeCap="round"
      />
      <Circle c={head} r={p.sz * 1.7 * s} color="#E4F6FC" opacity={Math.min(0.31, p.al * 0.7)} />
    </>
  );
};

// 幾何上に明滅するスパーク
const Spark: React.FC<{
  i: number;
  s: number;
  pool: number[];
  clock: SharedValue<number>;
  stop: SharedValue<boolean>;
}> = ({ i, s, pool, clock, stop }) => {
  const speed = 0.5 + hash(i * 2.3) * 0.55;
  const phase = hash(i * 9.1) * 10;
  const N = pool.length / 2;

  const pt = useDerivedValue(() => {
    if (stop.value || N === 0) return vec(-9999, -9999);
    const u = (clock.value / 1000) * speed + phase;
    const cyc = Math.floor(u);
    const idx = Math.floor(hash(i * 7.13 + cyc * 3.7) * N) % N;
    return vec(pool[idx * 2], pool[idx * 2 + 1]);
  }, [clock]);
  const op = useDerivedValue(() => {
    if (stop.value) return 0;
    const u = (clock.value / 1000) * speed + phase;
    const frac = u - Math.floor(u);
    const DUTY = 0.42;
    if (frac > DUTY) return 0;
    return Math.sin((frac / DUTY) * Math.PI) * 0.5;
  }, [clock]);

  return <Circle c={pt} r={2.1 * s} color="#EAF7FC" opacity={op} />;
};

// ══════ 本体 ══════

export type StarSealProps = {
  width: number;
  height: number;
  centerX?: number;
  centerY?: number;
  /** 実カード幅(px)。参照カード幅 188.59 との比で全体をスケール */
  cardWidth?: number;
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const StarSeal: React.FC<StarSealProps> = ({
  width: W,
  height: H,
  centerX,
  centerY,
  cardWidth,
  paused = false,
  style,
}) => {
  const cx = centerX ?? W / 2;
  const cy = centerY ?? H / 2;
  const s = (cardWidth ?? REF_CARD_W) / REF_CARD_W;

  const geo = useMemo(() => buildGeometry(cx, cy, s, W, H), [cx, cy, s, W, H]);

  // フォント（出現サイズぶんキャッシュ・serif 系）
  const fontFamily = Platform.select({ ios: 'Georgia', default: 'serif' });
  const fonts = useMemo(() => {
    const m = new Map<number, SkFont | null>();
    geo.texts.forEach((t) => {
      const key = Math.round(t.size * 10);
      if (!m.has(key)) {
        try {
          m.set(key, matchFont({ fontFamily, fontSize: t.size, fontStyle: 'normal', fontWeight: '400' }));
        } catch {
          m.set(key, null);
        }
      }
    });
    return m;
  }, [geo.texts, fontFamily]);

  const estWidth = (text: string, size: number, font: SkFont | null) => {
    if (font) {
      try {
        const mt = font.measureText(text);
        if (mt && mt.width > 0) return mt.width;
      } catch {}
    }
    let w = 0;
    for (const ch of text) w += ch === '·' || ch === ' ' ? size * 0.3 : /[0-9]/.test(ch) ? size * 0.52 : size * 0.55;
    return w;
  };

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
      // @ts-ignore
      sub?.remove?.();
    };
  }, []);

  const clock = useClock();
  const stopSV = useSharedValue<boolean>(paused || reduced);
  useEffect(() => {
    stopSV.value = paused || reduced;
  }, [paused, reduced, stopSV]);

  // 呼吸（0.86+0.14·sin 周期6s）
  const glowOpacity = useDerivedValue(() => {
    if (stopSV.value) return 0.93;
    const t = clock.value / 1000;
    const breath = 0.5 + 0.5 * Math.sin((t / 3) * Math.PI * 2);
    return 0.86 + 0.14 * breath;
  }, [clock]);

  return (
    <Canvas style={[{ width: W, height: H }, style]} pointerEvents="none">
      {/* ═ ① 彫刻層（静的） ═ */}
      <Group>
        {geo.strokes.map((g, i) => (
          <Path key={`s${i}`} path={g.path} color={g.color} style="stroke" strokeWidth={g.width}>
            {g.dash ? <DashPathEffect intervals={g.dash} /> : null}
          </Path>
        ))}
        {geo.fills.map((g, i) => (
          <Path key={`f${i}`} path={g.path} color={g.color} />
        ))}
        {geo.texts.map((t, i) => {
          const font = fonts.get(Math.round(t.size * 10)) ?? null;
          const w = estWidth(t.text, t.size, font);
          const dx = t.align === 'c' ? -w / 2 : t.align === 'r' ? -w : 0;
          return (
            <Group key={`t${i}`} transform={[{ translateX: t.x }, { translateY: t.y }, { rotate: t.rot }]}>
              <SkText text={t.text} x={dx} y={t.voff} font={font} color={t.color} />
            </Group>
          );
        })}
      </Group>

      {/* ═ ② 発光層（screen 合成＋呼吸） ═ */}
      <Group
        opacity={glowOpacity}
        layer={
          <Paint blendMode="screen">
            <Blur blur={4 * s} />
          </Paint>
        }
      >
        {geo.glowCircles.map((c, i) => (
          <Circle key={`gc${i}`} cx={cx} cy={cy} r={c.r} style="stroke" strokeWidth={1.3 * s} color={CYAN} opacity={c.op} />
        ))}
        {geo.glowSegs.map((sg, i) => (
          <Line
            key={`gs${i}`}
            p1={vec(sg.x1, sg.y1)}
            p2={vec(sg.x2, sg.y2)}
            color={CYAN}
            style="stroke"
            strokeWidth={1.3 * s}
            opacity={sg.op}
          />
        ))}
        {geo.glowNodes.map((n, i) => (
          <React.Fragment key={`gn${i}`}>
            <Circle cx={n.x} cy={n.y} r={n.r * 1.9} color={n.main ? CYAN : '#F3F8FF'} opacity={0.85} />
            <Circle cx={n.x} cy={n.y} r={n.r * 4.6} color={n.main ? CYAN : '#F3F8FF'} opacity={0.12} />
            {n.main && (
              <>
                <Line
                  p1={vec(n.x - n.r * 7, n.y)} p2={vec(n.x + n.r * 7, n.y)}
                  color={CYAN} style="stroke" strokeWidth={0.8 * s} opacity={0.3}
                />
                <Line
                  p1={vec(n.x, n.y - n.r * 7)} p2={vec(n.x, n.y + n.r * 7)}
                  color={CYAN} style="stroke" strokeWidth={0.8 * s} opacity={0.3}
                />
              </>
            )}
          </React.Fragment>
        ))}
      </Group>

      {/* ═ ③ 信号層（通電・光の車＋スパーク） ═ */}
      <Group
        layer={
          <Paint blendMode="screen">
            <Blur blur={1.2 * s} />
          </Paint>
        }
      >
        {geo.cars.map((p, i) => (
          <Car key={`car${i}`} p={p} s={s} clock={clock} stop={stopSV} />
        ))}
        {Array.from({ length: N_SPARKS }, (_, i) => (
          <Spark key={`sp${i}`} i={i} s={s} pool={geo.sparkPool} clock={clock} stop={stopSV} />
        ))}
      </Group>
    </Canvas>
  );
};

export default StarSeal;
