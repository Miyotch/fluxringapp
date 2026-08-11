/**
 * CardAura.tsx — カード背後の落影（v99-tsubasa `.card-aura`）
 * ------------------------------------------------------------------
 * v98 まではシアン/青の色付きグロー 2 層だったが、v99-tsubasa は
 * layout() が毎フレーム box-shadow を上書きして色を消している
 * （fr_v99_tsubasa.html 709行）:
 *
 *   box-shadow: 0  4px 10px rgba(0,0,0,.55)   ← 接触（濃く狭い）
 *               0 16px 34px rgba(0,0,0,.44)   ← 中景
 *               0 34px 66px rgba(0,0,0,.34)   ← 広い環境影
 *
 * 設計思想は「光と質量の分離」。光はカード面側（CardSurface の金ヘアライン
 * と上部ハイライト）で表現し、この層は影に専念する。色付きオーラを残すと
 * 面の金と背後のシアンが競合して、参照の重さが出ない。
 *
 * ── 単位変換（HTML → Skia）──────────────────────────────
 * box-shadow の blur-radius は σ の 2 倍と定義されている（CSS Backgrounds 仕様）。
 * Skia の <Blur blur={}> は σ を取るので blur/2 を渡す。
 * 同じファイル内の filter: blur(N) は N が σ そのものなので変換不要——
 * 数値をそのまま写すと片方だけズレる。
 *
 * 角丸は .card-aura の border-radius:22px（カード本体の 0.085w とは別値）。
 * 寸法は参照のカード幅 188.6px 基準で実カード幅へ等倍スケール。
 */

import React from 'react';
import { Canvas, RoundedRect, Blur, rrect, rect } from '@shopify/react-native-skia';
import type { StyleProp, ViewStyle } from 'react-native';

const REF_W = 188.6;
/** .card-aura { border-radius: 22px } */
const AURA_RADIUS = 22;

/** [dy, blur-radius(=2σ), color] — 参照 709行の3層 */
const SHADOWS: [number, number, string][] = [
  [4, 10, 'rgba(0,0,0,0.55)'],
  [16, 34, 'rgba(0,0,0,0.44)'],
  [34, 66, 'rgba(0,0,0,0.34)'],
];

type Props = {
  /** カードの見かけ幅(px) */
  width: number;
  height: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

export const CardAura: React.FC<Props> = ({ width, height, opacity = 1, style }) => {
  const s = width / REF_W;
  const r = AURA_RADIUS * s;
  // 最大の影（dy34 + blur66）が切れないだけの余白
  const M = Math.ceil((66 + 34 + 16) * s);

  return (
    <Canvas
      style={[
        { position: 'absolute', left: -M, top: -M, width: width + M * 2, height: height + M * 2, opacity },
        style,
      ]}
      pointerEvents="none"
    >
      {/* 広い環境影 → 中景 → 接触 の順（薄く広いものを下に） */}
      {[...SHADOWS].reverse().map(([dy, blur, color], i) => (
        <RoundedRect
          key={i}
          rect={rrect(rect(M, M + dy * s, width, height), r, r)}
          color={color}
        >
          <Blur blur={(blur / 2) * s} />
        </RoundedRect>
      ))}
    </Canvas>
  );
};

export default CardAura;
