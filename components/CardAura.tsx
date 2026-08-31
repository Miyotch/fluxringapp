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
 * ※ 実機ではこの 3 層がカードを黒く縁取って見えたため、下の SHADOWS で
 *   2 層へ落としてある（理由は SHADOWS のコメント）。
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

/**
 * [dy, blur-radius(=2σ), color]
 *
 * 参照 709行は 3 層（[4,10,.55] [16,34,.44] [34,66,.34]）だが、実機では
 * 「カードの左上から右下まで影が回り込んでいる／背景に黒い板がある」と
 * 見えていた。原因は 3 層目の blur 66px（σ=33）で、下方向のオフセット 34px
 * より広がりが大きいため、影が上・左・右へも 30px 以上はみ出して
 * カードを黒い輪で縁取っていたこと。3 層が重なる真下は合成アルファ 0.83 で
 * ほぼ黒板になる。
 *
 * ブラウザの参照は背景が一様に暗いので目立たないが、アプリの実機は
 * カード周りが調律陣で明るいため輪郭がはっきり出る。そこで
 *   ・広がりすぎる 3 層目を撤去
 *   ・残る 2 層も「dy > σ」を守る値まで blur を詰める（＝影が下に留まる）
 *   ・合成アルファを 0.83 → 0.41 へ
 * とし、輪郭ではなく「下に落ちる影」だけが残るようにした。
 * 影を完全に消したい場合はこの配列を空にする（CardGround の接地影は残る）。
 */
const SHADOWS: [number, number, string][] = [
  [3, 8, 'rgba(0,0,0,0.28)'],
  [8, 18, 'rgba(0,0,0,0.18)'],
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
  // いちばん外へ出る影が切れないだけの余白（dy + blur + 予備16px）。
  // SHADOWS から導くので、層を足し引きしても余白がズレない
  const M = Math.ceil(
    (SHADOWS.reduce((m, [dy, blur]) => Math.max(m, dy + blur), 0) + 16) * s,
  );

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
