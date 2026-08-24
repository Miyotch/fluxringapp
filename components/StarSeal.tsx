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
import { AccessibilityInfo, Platform, PixelRatio, StyleProp, ViewStyle } from 'react-native';
import {
  Canvas,
  Group,
  Circle,
  Line,
  Path,
  Text as SkText,
  Image as SkiaImage,
  Paint,
  Blur,
  DashPathEffect,
  PaintStyle,
  vec,
  matchFont,
  TileMode,
  BlendMode,
  StrokeCap,
  Skia,
  SkPath,
  SkFont,
  SkImage,
} from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, SharedValue } from 'react-native-reanimated';
import { cachedImage } from '../lib/skiaSprites';
import { useBackdropClock } from '../lib/usePausableClock';

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

// ── 発熱対策: 信号層の密度 ──────────────────────────────
// 走る光点は 1本につき毎フレーム derived value 2（head/tail）＋描画2
// （Line/Circle）を消費し、さらに screen 合成＋Blur のレイヤー内にあるため
// 塗り面積がそのまま GPU 負荷になる。実機が熱くなる件への対応として、
// 本数を 1/3（45→15）へ、尾の長さを半分へ落とす。
const PULSE_KEEP_EVERY = 3;   // 生成後に何本おきに残すか（3 = 1/3）
const PULSE_TAIL_SCALE = 0.5; // 尾の長さ倍率

// 交点のシャープ層。旧値（光条長5.5・光条0.55・コア0.95）は参照より強く、
// 交点が大きな十字星になっていた。参照は小さな芯＋淡い裾なので抑える。
// 2026-08-18 画素比較2回目: それでも全交点が白い星として目立っていたため
// さらに絞る（参照の交点は「点」であって「星」ではない）。
const NODE_SPIKE_LEN = 2.8;
const NODE_SPIKE_OPACITY = 0.2;
const NODE_CORE_OPACITY = 0.5;

// ── 六芒星の線（デザイン修正）────────────────────────────────
// ① 色  : DESIGN.md のアクセント シアン #60CEE0（= rgba(96,206,224) と同値）
// ② 太さ: 1.0（参照単位・実寸は ×s）。従来は 1.3 で、しかも blur 4px の
//         発光層だけで描いていたため線が白くにじんで太く見えていた。
// ③ 種類: 実線・丸キャップ。ブラーなしのシャープ層を主役にし、
//         発光層は薄いハロー（太め・低不透明）に降格して二枚重ねにする。
//         破線にする場合は HEX_DASH に [4,3] のような配列を入れる。
// 参照の芯を実測した色 RGB(112,131,177) を、加算合成で沈むぶん明るめに寄せた銀青。
// 旧値 #60CEE0 は彩度が高すぎて線だけシアンに浮いていた。
const HEX_COLOR = '#9FB8DC';
const HEX_WIDTH = 1.0;
const HEX_DASH = null as number[] | null;

// ── 2026-08-18: 実測に基づく再調整 ────────────────────────────
// 一度「参照はぼかした発光層だけ」と判断してシャープ層を全部切ったが、
// 実機と参照の同倍率スクリーンショットを画素比較したところ振りすぎだった。
//
//   六芒星の辺（水平線）の局所ピーク  参照 +27.0 / +21.5   アプリ +4.8 / +4.1
//   ＝参照の 1/5〜1/6 しか出ておらず、実質消えていた。
//   （雲は 中央帯 平均 参照102.3 / アプリ105.6、上位1% 135.9 / 137.4 で一致）
//
// 参照の線を実測した断面（1画素≒0.5CSSpx）:
//   芯 RGB(112,131,177) 輝度130 → 直近背景 76 で +116（最大時）
//   輝度は芯から ±4px でなだらかに落ちる ＝「細い芯 ＋ 広い裾」の二重構造。
// つまり参照は「ぼかしだけ」でも「硬い実線だけ」でもなく、両方を重ねている。
// シャープ層を戻し、色は実測どおり彩度を落とした銀青へ、強度は中間に置く。
/** true = 六芒星に芯となる実線を重ねる（参照の断面に芯があるため必要） */
const HEX_SHARP_LAYER = true;
/** true = 交点にブラーなしのコア＋十字光条を重ねる */
const NODE_SHARP_LAYER = true;
/** 発光層で描く六芒星の線幅・不透明度 */
const HEX_GLOW_WIDTH = 1.3;
// 2026-08-18 画素比較2回目: 芯の色・明るさは参照と一致（差+163/+95 vs +148/+96）。
// ただ帯積分（線の総エネルギー）が 1.7〜1.8 倍で、余剰は裾にある。
// 芯（HEX_WIDTH/HEX_COLOR）は触らず、発光層とハローだけ絞って
// 参照のピーク +27/+21.5 へ寄せる。
// 2026-08-18 画素比較3回目: ピーク +32.6/+26.1 vs 参照 +27.0/+21.5（残差+21%）。
// 収束の最終トリム。推移: +4.8(消滅) → +49.5(過剰) → +32.6 → ここで挟み込む。
const HEX_OPACITY = 0.28;
/** シャープ層を使うときのハロー（裾を作る層） */
const HEX_HALO_WIDTH = 2.6;
const HEX_HALO_OPACITY = 0.12;

const ink = (a: number) => `rgba(150,190,210,${a})`;
const lab = (a: number) => `rgba(178,198,216,${a})`;

// 彫刻層を焼くときの最大 DPR。3x 機では全画面 RGBA が約 10MB になるため上限を置く。
// 髪の毛のような細線が主体なので 2 未満へ落とすと目に見えて甘くなる。
const INK_BAKE_MAX_DPR = 3;

// 発光層を焼くときの最大 DPR。ぼかし側だけなら 1.5 で足りるが、同じ画像へ
// シャープ層（0.6*s の十字光条・小さな白コア）も焼くので彫刻層と同じ上限にする。
const GLOW_BAKE_MAX_DPR = 3;

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
  /** 六芒星の6辺（専用の実線レイヤーで描く） */
  hexSegs: GlowSeg[];
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
  // 六芒星の6辺は専用レイヤー（シャープ層＋ハロー）で描くので glowSegs には入れない
  const hexSegs: GlowSeg[] = hexPairs.map(([a, b]) => ({
    x1: a[0], y1: a[1], x2: b[0], y2: b[1], op: HEX_OPACITY,
  }));
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
      // クランプ後に倍率を掛ける（実効 3*s〜8*s）。
      // 「速い光点ほど尾が長い」という参照の性質はそのまま残る
      tail: Math.min(16 * s, Math.max(6 * s, vpx * 0.28)) * PULSE_TAIL_SCALE,
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
    hexSegs,
    glowNodes,
    sparkPool,
    // 光点は族ごと（同心円→六芒星→放射→十二芒星→弦スポーク）に連続生成
    // されているので、一定間隔で間引けば族の比率を保ったまま総数だけが 1/3 に
    // なる（同心円 27→9・六芒星 6→2・放射 6→2・十二芒星 3→1・スポーク 3→1）。
    // 生成ループ自体は触らないこと: addCar の呼び出し回数を減らすと seed の
    // 進み方が変わり、hash 由来の速度・向き・輝度・サイズが全部ずれてしまう。
    // 生成してから捨てるので、残った 15 本は今までと同じ軌道を同じ速さで走る。
    cars: cars.filter((_, i) => i % PULSE_KEEP_EVERY === 0),
  };
}

/**
 * ②発光層 ＋ ②'シャープ層を 1 枚の SkImage へ焼く。
 * ------------------------------------------------------------------
 * この 2 層は「全体の呼吸（glowOpacity）」以外まったく動かない静止画なのに、
 * 宣言的に置くと毎フレーム再合成されていた。RN Skia は Canvas 単位でしか
 * 描画を無効化できないため、同じ Canvas にいる信号層（光点・スパーク）が
 * 動く限り、この 228 プリミティブも全画面 saveLayer 2 枚＋ガウシアン
 * Blur(4*s) ごと毎秒 60 回焼き直される。参照 fr_v98-2_FIX は同じ絵を
 * WebGL の全画面三角形 1 枚（draw call 1 回・ぼかしなし）で出しており、
 * 発熱差の主因がここだった。
 *
 * 焼いたあとの実行時は「screen＋呼吸の透過で画像を 1 枚描く」だけになる。
 *
 * 合成の等価性:
 *   元は screen レイヤー 2 枚を背景へ順に重ねていた。screen は乗算前提の
 *   r = s + d - s*d なので結合的（screen(D,screen(G,S)) = screen(screen(D,G),S)）、
 *   透明地へ同じ順で焼いてから screen で 1 枚重ねてよい。
 *   厳密には呼吸の α が「レイヤーごと」から「合成後まとめて」へ移るぶん、
 *   2 層が重なる画素だけ α² が α になる差が出るが、α は 0.86〜1.0 の範囲しか
 *   動かないので目に見えない。
 */
function bakeGlowImage(
  geo: Geometry, W: number, H: number, cx: number, cy: number, s: number, dpr: number,
): SkImage | null {
  const surface = Skia.Surface.MakeOffscreen(Math.ceil(W * dpr), Math.ceil(H * dpr));
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.scale(dpr, dpr);

  // 宣言版の color + opacity と同じ意味のペイントを作る（width 指定でストローク）
  const mk = (color: string, alpha: number, width?: number, round = false) => {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(color));
    paint.setAlphaf(alpha);
    if (width != null) {
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(width);
      if (round) paint.setStrokeCap(StrokeCap.Round);
    }
    return paint;
  };

  // ═ ② 発光層: ぼかしをレイヤーへ 1 回だけ掛けて焼く ═
  const blurPaint = Skia.Paint();
  blurPaint.setImageFilter(Skia.ImageFilter.MakeBlur(4 * s, 4 * s, TileMode.Decal, null));
  canvas.saveLayer(blurPaint);

  for (const c of geo.glowCircles) {
    canvas.drawCircle(cx, cy, c.r, mk(CYAN, c.op, 1.3 * s));
  }
  for (const sg of geo.glowSegs) {
    canvas.drawLine(sg.x1, sg.y1, sg.x2, sg.y2, mk(CYAN, sg.op, 1.3 * s));
  }
  for (const sg of geo.hexSegs) {
    canvas.drawLine(
      sg.x1, sg.y1, sg.x2, sg.y2,
      mk(
        HEX_SHARP_LAYER ? HEX_COLOR : CYAN,
        HEX_SHARP_LAYER ? HEX_HALO_OPACITY : sg.op,
        (HEX_SHARP_LAYER ? HEX_HALO_WIDTH : HEX_GLOW_WIDTH) * s,
      ),
    );
  }
  for (const n of geo.glowNodes) {
    const col = n.main ? CYAN : '#F3F8FF';
    canvas.drawCircle(n.x, n.y, n.r * 1.9, mk(col, 0.85));
    canvas.drawCircle(n.x, n.y, n.r * 4.6, mk(col, 0.12));
    if (n.main) {
      const cross = mk(CYAN, 0.3, 0.8 * s);
      canvas.drawLine(n.x - n.r * 7, n.y, n.x + n.r * 7, n.y, cross);
      canvas.drawLine(n.x, n.y - n.r * 7, n.x, n.y + n.r * 7, cross);
    }
  }
  canvas.restore();

  // ═ ②' シャープ層: 元も独立した screen レイヤーだったので、層の中は
  //    srcOver・層自体を screen で重ねる、という構造をそのまま焼く ═
  if (HEX_SHARP_LAYER || NODE_SHARP_LAYER) {
    const screenPaint = Skia.Paint();
    screenPaint.setBlendMode(BlendMode.Screen);
    canvas.saveLayer(screenPaint);

    if (HEX_SHARP_LAYER) {
      for (const sg of geo.hexSegs) {
        const paint = mk(HEX_COLOR, sg.op, HEX_WIDTH * s, true);
        if (HEX_DASH) paint.setPathEffect(Skia.PathEffect.MakeDash(HEX_DASH.map((d) => d * s)));
        canvas.drawLine(sg.x1, sg.y1, sg.x2, sg.y2, paint);
      }
    }
    if (NODE_SHARP_LAYER) {
      for (const n of geo.glowNodes) {
        const col = n.main ? CYAN : '#FFFFFF';
        const spike = Math.max(n.r * NODE_SPIKE_LEN, 4 * s); // 十字光条の長さ
        const line = mk(col, NODE_SPIKE_OPACITY, 0.6 * s, true);
        canvas.drawLine(n.x - spike, n.y, n.x + spike, n.y, line);
        canvas.drawLine(n.x, n.y - spike, n.x, n.y + spike, line);
        canvas.drawCircle(n.x, n.y, Math.max(n.r * 0.85, 0.9 * s), mk('#FFFFFF', NODE_CORE_OPACITY));
        canvas.drawCircle(n.x, n.y, Math.max(n.r * 1.6, 1.7 * s), mk(col, 0.3));
      }
    }
    canvas.restore();
  }

  // GPU バックドのスナップショットはそのままでは描画スレッドで無視される
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  return snapshot.makeNonTextureImage() ?? snapshot;
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

const StarSealImpl: React.FC<StarSealProps> = ({
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

  // ── ① 彫刻層は静的なので 1 枚の SkImage へ焼く ──
  // 参照HTML の #frSealInk は Canvas2D へ初期化時に一度だけ描かれ、描画ループ
  // frame() からは一切触られない（ループ内にインク側コンテキストの呼び出しは
  // 0 箇所）。アプリ側は宣言的に置いていたため、同じ Canvas にある発光層の
  // 呼吸（毎フレーム変化）に巻き込まれ、二重リング・232菱形・260点列・352複線・
  // 316点列・390目盛・435円…と 2,000 を超えるプリミティブが毎フレーム
  // 再ラスタライズされていた。焼けば毎フレームはテクスチャ 1 枚の転送で済む。
  //
  // MakeOffscreen が null を返す環境では従来どおり宣言的に描く（フォールバック）。
  const inkImage = useMemo(() => {
    if (W <= 0 || H <= 0) return null;
    const dpr = Math.min(PixelRatio.get(), INK_BAKE_MAX_DPR);
    // ホームへ戻るたび焼き直さないようモジュールキャッシュに載せる
    return cachedImage(`sealInk|${W}|${H}|${cx}|${cy}|${s}|${dpr}`, () => {
    const surface = Skia.Surface.MakeOffscreen(Math.ceil(W * dpr), Math.ceil(H * dpr));
    if (!surface) return null;
    const canvas = surface.getCanvas();
    canvas.scale(dpr, dpr);

    for (const g of geo.strokes) {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(g.width);
      paint.setColor(Skia.Color(g.color));
      if (g.dash) paint.setPathEffect(Skia.PathEffect.MakeDash(g.dash));
      canvas.drawPath(g.path, paint);
    }
    for (const g of geo.fills) {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setColor(Skia.Color(g.color));
      canvas.drawPath(g.path, paint);
    }
    for (const t of geo.texts) {
      // フォント未解決の字は宣言版（font={null}）でも描かれないので揃える
      const font = fonts.get(Math.round(t.size * 10)) ?? null;
      if (!font) continue;
      const w = estWidth(t.text, t.size, font);
      const dx = t.align === 'c' ? -w / 2 : t.align === 'r' ? -w : 0;
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setColor(Skia.Color(t.color));
      canvas.save();
      canvas.translate(t.x, t.y);
      // 宣言版の transform rotate はラジアン / imperative の rotate は度
      if (t.rot) canvas.rotate((t.rot * 180) / Math.PI, 0, 0);
      canvas.drawText(t.text, dx, t.voff, paint, font);
      canvas.restore();
    }
    surface.flush();
    // GPU バックドのスナップショットは生成時の GL コンテキストに紐づくため、
    // そのまま <Image> へ渡しても描画スレッド側では無視されて透明になる。
    // makeNonTextureImage() でラスタ画像へ落としてから返すこと。
    const snapshot = surface.makeImageSnapshot();
    return snapshot.makeNonTextureImage() ?? snapshot;
    });
    // estWidth は毎レンダー再生成される純関数なので依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, fonts, W, H, cx, cy, s]);

  // ── ②＋②' 発光層も 1 枚の SkImage へ焼く（bakeGlowImage のコメント参照） ──
  const glowImage = useMemo(() => {
    if (W <= 0 || H <= 0) return null;
    const dpr = Math.min(PixelRatio.get(), GLOW_BAKE_MAX_DPR);
    return cachedImage(
      `sealGlow|${W}|${H}|${cx}|${cy}|${s}|${dpr}`,
      () => bakeGlowImage(geo, W, H, cx, cy, s, dpr),
    );
  }, [geo, W, H, cx, cy, s]);

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

  // 参照レポート②: 背面でも回り続けるループが発熱・電池消耗の直接原因。
  // 非アクティブ時はフレームコールバックごと外して完全に止める。
  const { clock } = useBackdropClock(paused || reduced);
  const stopSV = useSharedValue<boolean>(false);
  useEffect(() => {
    // paused（フリップ中の一時停止）では「止まった見た目」へ切り替えない。
    // stop=true にすると雲も星も t=0 の姿へ飛び、光点は画面外へ退避するため、
    // 止めた瞬間と再開した瞬間の両方でガクッと切り替わって見える。
    // 時計が止まっていれば値は最後の状態で凍るので、それで十分。
    // ここを立てるのは reduce-motion（意図的に動きを消す設定）のときだけ。
    stopSV.value = reduced;
  }, [reduced, stopSV]);

  // 呼吸（0.86+0.14·sin 周期6s）
  const glowOpacity = useDerivedValue(() => {
    if (stopSV.value) return 0.93;
    const t = clock.value / 1000;
    const breath = 0.5 + 0.5 * Math.sin((t / 3) * Math.PI * 2);
    return 0.86 + 0.14 * breath;
  }, [clock]);

  return (
    <Canvas style={[{ width: W, height: H }, style]} pointerEvents="none">
      {/* ═ ① 彫刻層（静的・SkImage へ焼き込み済み） ═
          参照 #frSealInk と同じ「一度描いたら触らない」層。
          焼けなかった環境（MakeOffscreen が null）だけ従来の宣言的描画へ落とす */}
      {inkImage ? (
        <SkiaImage image={inkImage} x={0} y={0} width={W} height={H} fit="fill" />
      ) : (
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
      )}

      {/* ═ ②＋②' 発光層（静的・SkImage へ焼き込み済み） ═
          呼吸（0.86+0.14sin）以外は動かない 228 プリミティブを 1 枚へ焼き、
          実行時は screen 合成＋呼吸の透過で画像を 1 枚描くだけにする。
          毎フレームの全画面 saveLayer 2 枚とガウシアン Blur(4*s) が消える。
          焼けなかった環境（MakeOffscreen が null）だけ従来の 2 レイヤーへ落とす */}
      {glowImage ? (
        <Group blendMode="screen" opacity={glowOpacity}>
          <SkiaImage image={glowImage} x={0} y={0} width={W} height={H} fit="fill" />
        </Group>
      ) : (
        <>
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
          {/* 六芒星の6辺。参照はこの「ぼかした発光層」だけで描く。
              シャープ層を使う場合のみ、ここは太く薄いハローへ降格する */}
          {geo.hexSegs.map((sg, i) => (
            <Line
              key={`hh${i}`}
              p1={vec(sg.x1, sg.y1)}
              p2={vec(sg.x2, sg.y2)}
              color={HEX_SHARP_LAYER ? HEX_COLOR : CYAN}
              style="stroke"
              strokeWidth={(HEX_SHARP_LAYER ? HEX_HALO_WIDTH : HEX_GLOW_WIDTH) * s}
              opacity={HEX_SHARP_LAYER ? HEX_HALO_OPACITY : sg.op}
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

        {/* ═ ②' シャープ層（参照には無い・既定で無効） ═
            発光層は全体に Blur がかかるため交点までにじむ。それを嫌って
            ブラーなしのコア＋十字光条を重ねていたが、参照 fr_v98-2_FIX は
            この層を持たず、六芒星も交点もぼかした発光だけで描いている。
            実機比較で「はっきりしすぎ」の主因だったため既定で切る。
            視認性を優先したい場合は HEX_SHARP_LAYER / NODE_SHARP_LAYER を true へ */}
        {(HEX_SHARP_LAYER || NODE_SHARP_LAYER) && (
          <Group opacity={glowOpacity} layer={<Paint blendMode="screen" />}>
            {HEX_SHARP_LAYER &&
              geo.hexSegs.map((sg, i) => (
                <Line
                  key={`hx${i}`}
                  p1={vec(sg.x1, sg.y1)}
                  p2={vec(sg.x2, sg.y2)}
                  color={HEX_COLOR}
                  style="stroke"
                  strokeWidth={HEX_WIDTH * s}
                  strokeCap="round"
                  opacity={sg.op}
                >
                  {HEX_DASH ? <DashPathEffect intervals={HEX_DASH.map((d) => d * s)} /> : null}
                </Line>
              ))}
            {NODE_SHARP_LAYER &&
              geo.glowNodes.map((n, i) => {
                const col = n.main ? CYAN : '#FFFFFF';
                const spike = Math.max(n.r * NODE_SPIKE_LEN, 4 * s); // 十字光条の長さ
                return (
                  <React.Fragment key={`sn${i}`}>
                    <Line
                      p1={vec(n.x - spike, n.y)} p2={vec(n.x + spike, n.y)}
                      color={col} style="stroke" strokeWidth={0.6 * s} strokeCap="round" opacity={NODE_SPIKE_OPACITY}
                    />
                    <Line
                      p1={vec(n.x, n.y - spike)} p2={vec(n.x, n.y + spike)}
                      color={col} style="stroke" strokeWidth={0.6 * s} strokeCap="round" opacity={NODE_SPIKE_OPACITY}
                    />
                    {/* シャープな白コア＋ごく薄い縁 */}
                    <Circle cx={n.x} cy={n.y} r={Math.max(n.r * 0.85, 0.9 * s)} color="#FFFFFF" opacity={NODE_CORE_OPACITY} />
                    <Circle cx={n.x} cy={n.y} r={Math.max(n.r * 1.6, 1.7 * s)} color={col} opacity={0.3} />
                  </React.Fragment>
                );
              })}
          </Group>
        )}
        </>
      )}

      {/* ═ ③ 信号層（通電・光の車＋スパーク） ═
          参照 fr_v98-2_FIX の信号層はぼかしを持たない（頭部は 16px スプライトへ
          焼いた放射グラデ自体がぼけの役目で、合成も lighter だけ）。こちらは
          layer={<Paint blendMode="screen"><Blur/></Paint>} にしていたため、
          全画面 saveLayer の確保とガウシアン 1 本を毎フレーム払っていた。
          光点を 45→15 に間引いても発熱が下がりきらなかったのはこれが層あたりの
          固定費だったから。screen 合成だけを継承させ、saveLayer は発行しない */}
      <Group blendMode="screen">
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


// React.memo で包む。DiscoverScreen が再レンダーすると、素の FC のままでは
// children の要素ツリーが作り直され、RN Skia の Canvas が
// stopMapper → recorder 再構築 → 全ノード再 push（sksg/Container.native.ts）
// を丸ごとやり直す。フリップの開始・終了はまさにその瞬間なので、
// 一番引っかかってほしくないタイミングで最大のコストが乗っていた。
export const StarSeal = React.memo(StarSealImpl);

export default StarSeal;
