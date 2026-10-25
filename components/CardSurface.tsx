/**
 * CardSurface.tsx — カード表面の重厚化オーバーレイ（v99-tsubasa `.face.front::after`）
 * ------------------------------------------------------------------
 * 参照: fr_v99_tsubasa.html 66-68行。作品画像の上に 1 枚重ねて
 * 「上から照らされた重い金属板」に見せる層。3 要素からなる:
 *
 *   (a) 面内減光グラデ（180deg）
 *       rgba(255,255,255,.05) 0% → transparent 34%
 *       → rgba(3,5,14,.12) 76% → rgba(3,5,14,.26) 100%
 *       上が明るく下が重い＝上方光源下の質量の見え。
 *   (b) 内枠の二重ヘアライン
 *       inset 0 0 0 1px   rgba(233,200,121,.30)  ← 金（--gold #e9c879）
 *       inset 0 0 0 2.5px rgba(8,10,22,.34)      ← その外の暗い縁
 *       CSS は先に書いた影が上に載るので、暗い縁を先に塗って金を上へ。
 *   (c) 下端の内側シャドウ
 *       inset 0 -18px 30px rgba(3,5,14,.22)
 *
 * ── 単位変換（HTML → Skia）──────────────────────────────
 * CSS の「ぼかし」は 2 系統あり、同じ数値でも意味が違う:
 *   ・box-shadow の blur-radius = 2σ  → Skia には blur/2 を渡す
 *   ・filter: blur(N)          = σ そのもの → Skia には N をそのまま渡す
 * (c) は box-shadow なので 30px → σ=15。
 *
 * 寸法は参照のカード幅 188.6px 基準。実カード幅へ等倍スケールする。
 */

import React from 'react';
import {
  Canvas,
  Group,
  Path,
  Rect,
  RoundedRect,
  LinearGradient,
  Blur,
  Skia,
  FillType,
  rrect,
  rect,
  vec,
} from '@shopify/react-native-skia';
import type { StyleProp, ViewStyle } from 'react-native';

/** 参照実装のカード幅（この幅で CSS の px 値が定義されている） */
const REF_W = 188.6;
/** 角丸 --cr = 0.085 × カード幅 */
const CORNER_RATIO = 0.085;

// (a) 面内減光グラデ
const FACE_COLORS = [
  'rgba(255,255,255,0.05)',
  'rgba(3,5,14,0)',
  'rgba(3,5,14,0.12)',
  'rgba(3,5,14,0.26)',
];
const FACE_STOPS = [0, 0.34, 0.76, 1];

// (b) 内枠ヘアライン
const GOLD_LINE = 'rgba(233,200,121,0.30)'; // --gold #e9c879
const GOLD_W = 1;
const DARK_LINE = 'rgba(8,10,22,0.34)';
const DARK_W = 2.5;

// (c) 下端の内側シャドウ（inset 0 -18px 30px）
const INNER_DY = -18;
const INNER_BLUR = 30; // box-shadow 記法 = 2σ
const INNER_COLOR = 'rgba(3,5,14,0.22)';

export type CardSurfaceProps = {
  homeFinish?: boolean;
  width: number;
  height: number;
  /** 全体の不透明度（フリップ中のフェード等に使う） */
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

export const CardSurface: React.FC<CardSurfaceProps> = ({
  width,
  height,
  opacity = 1,
  homeFinish = false,
  style,
}) => {
  const lineColor = homeFinish ? 'rgba(210,227,244,0.85)' : GOLD_LINE;
  const lineWidth = homeFinish ? 1.5 : GOLD_W;
  const s = width / REF_W;
  const r = CORNER_RATIO * width;
  const card = rrect(rect(0, 0, width, height), r, r);

  // (c) 内側シャドウ = 「カード全体」から「dy ぶんずらした角丸」を抜いた形を
  //     ぼかし、カード形状でクリップする（CSS inset box-shadow と同じ作図）。
  const dy = INNER_DY * s;
  const pad = (INNER_BLUR + Math.abs(INNER_DY)) * s + r;
  const innerShadowPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    p.addRect(rect(-pad, -pad, width + pad * 2, height + pad * 2));
    p.addRRect(rrect(rect(0, dy, width, height), r, r));
    p.setFillType(FillType.EvenOdd);
    return p;
  }, [width, height, r, dy, pad]);

  return (
    <Canvas
      style={[{ position: 'absolute', left: 0, top: 0, width, height, opacity }, style]}
      pointerEvents="none"
    >
      <Group clip={card}>
        {/* (a) 面内減光 */}
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={FACE_COLORS}
            positions={FACE_STOPS}
          />
        </Rect>

        {/* (c) 下端の内側シャドウ（σ = blur/2） */}
        <Path path={innerShadowPath} color={INNER_COLOR}>
          <Blur blur={(INNER_BLUR / 2) * s} />
        </Path>
      </Group>

      {/* (b) 内枠の二重ヘアライン。暗い縁 → 金の順に重ねる（CSS の重ね順） */}
      <RoundedRect
        rect={rrect(
          rect((DARK_W * s) / 2, (DARK_W * s) / 2, width - DARK_W * s, height - DARK_W * s),
          r - (DARK_W * s) / 2,
          r - (DARK_W * s) / 2,
        )}
        color={DARK_LINE}
        style="stroke"
        strokeWidth={DARK_W * s}
      />
      <RoundedRect
        rect={rrect(
          rect((lineWidth * s) / 2, (lineWidth * s) / 2, width - lineWidth * s, height - lineWidth * s),
          r - (lineWidth * s) / 2,
          r - (lineWidth * s) / 2,
        )}
        color={lineColor}
        style="stroke"
        strokeWidth={lineWidth * s}
      />
    </Canvas>
  );
};

export default CardSurface;
