/**
 * TabGlow.tsx — フッターのアクティブタブ上端に添える金色インジケータ（v99 fr_v99_tsubasa 準拠）
 * ------------------------------------------------------------------
 * モックの CSS:
 *   .tb.on::before{
 *     top:-1px; left:50%; transform:translateX(-50%);
 *     width:26px; height:2px;
 *     background:linear-gradient(90deg,transparent,var(--gold),transparent);
 *     box-shadow:0 0 8px rgba(233,200,121,.55)
 *   }
 * RN に CSS の box-shadow/::before は無いため、Skia の Blur で再現する
 * （芯の2pxバーの上に、広いにじみ（σ4）と狭いにじみ（σ2）を重ねて
 * 「中心が明るく端がすっと消える」見え方にする）。
 * isActive の切り替えで 250ms（CSS の transition と同じ長さ）フェードする。
 *
 * アイコン自体の金の発光（.tb.on svg drop-shadow 相当）は、RN では
 * View の shadowColor/shadowRadius（アルファ形状に沿う影）で代替する方が
 * SVG の細線に馴染むため、Footer.tsx 側でネイティブ shadow として実装する
 * （このファイルの担当ではない）。
 *
 * VIP タブは常時シアン（Footer.tsx 側の既存仕様）で、この金インジケータとは無関係。
 */

import React, { useEffect } from 'react';
import { Canvas, Rect, LinearGradient, Blur, vec } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withTiming, Easing } from 'react-native-reanimated';

const GOLD = '#e9c879';
const GOLD_ZERO = 'rgba(233,200,121,0)';
const FADE_MS = 250;

function useActiveFade(active: boolean) {
  const t = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    t.value = withTiming(active ? 1 : 0, { duration: FADE_MS, easing: Easing.out(Easing.quad) });
  }, [active, t]);
  return t;
}

/**
 * タブ上端の金インジケータ（棒＋光暈）。フッターの `bar` 直下（各タブの
 * 幅を再現した専用スロット）に絶対配置する想定。canvas 自体は
 * `top:-M` で、芯の2pxバーがスロットの上端（＝フッター上端）にちょうど
 * 乗るように配置する（モックの `top:-1px` に相当）。
 */
export const TabTopIndicator: React.FC<{ active: boolean }> = ({ active }) => {
  const t = useActiveFade(active);
  const barOpacity = useDerivedValue(() => t.value);
  const wideGlowOpacity = useDerivedValue(() => t.value * 0.55); // rgba(...,.55)
  const tightGlowOpacity = useDerivedValue(() => t.value * 0.55);

  const W = 26;
  const H = 2;
  const M = 16; // にじみの余白（σ4 の広い光暈が切れないよう十分に確保）
  const canvasW = W + M * 2;
  const canvasH = H + M * 2;

  return (
    <Canvas
      style={{
        position: 'absolute',
        top: -M,
        width: canvasW,
        height: canvasH,
      }}
      pointerEvents="none"
    >
      {/* 広い光暈: box-shadow 0 0 8px rgba(233,200,121,.55) 相当（Skia sigma≒4） */}
      <Rect x={M} y={M} width={W} height={H} opacity={wideGlowOpacity}>
        <LinearGradient start={vec(M, 0)} end={vec(M + W, 0)} colors={[GOLD_ZERO, GOLD, GOLD_ZERO]} />
        <Blur blur={4} />
      </Rect>
      {/* 狭い光暈: 中心付近を明るく締める（σ2） */}
      <Rect x={M} y={M} width={W} height={H} opacity={tightGlowOpacity}>
        <LinearGradient start={vec(M, 0)} end={vec(M + W, 0)} colors={[GOLD_ZERO, GOLD, GOLD_ZERO]} />
        <Blur blur={2} />
      </Rect>
      {/* 芯の棒: linear-gradient(90deg,transparent,gold,transparent) */}
      <Rect x={M} y={M} width={W} height={H} opacity={barOpacity}>
        <LinearGradient start={vec(M, 0)} end={vec(M + W, 0)} colors={[GOLD_ZERO, GOLD, GOLD_ZERO]} />
      </Rect>
    </Canvas>
  );
};

export default TabTopIndicator;
