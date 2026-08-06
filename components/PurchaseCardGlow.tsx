/**
 * PurchaseCardGlow.tsx — 購入確定時、カードに一瞬だけ添えるシアンの発光
 * ------------------------------------------------------------------
 * 「購入する」確定タップ直後、中央のカードの縁にシアンの細いラインと
 * 外光がふわっと浮かび、少し経つと元の透明感ある状態へ静まる。
 * glow（0=通常, 1=発光ピーク）は呼び出し側（DiscoverScreen）が
 * withSequence で駆動する共有値。
 *
 *   borderWidth  : 0     → 1.5
 *   shadowOpacity: 0.1   → 0.85
 *   shadowRadius : 8     → 24（Skiaのblurはcssのradiusの約半分＝4→12）
 */

import React from 'react';
import { Canvas, RoundedRect, rrect, rect, Blur } from '@shopify/react-native-skia';
import { useDerivedValue, SharedValue } from 'react-native-reanimated';

const CYAN = '#60CEE0';
const M = 40; // 外光のにじみ分の余白

type Props = {
  width: number;
  height: number;
  radius: number;
  /** 0..1（0=通常, 1=発光ピーク）。呼び出し側が withSequence で駆動する */
  glow: SharedValue<number>;
};

export const PurchaseCardGlow: React.FC<Props> = ({ width, height, radius, glow }) => {
  const shadowOpacity = useDerivedValue(() => 0.1 + glow.value * 0.75);
  const shadowBlur = useDerivedValue(() => 4 + glow.value * 8); // shadowRadius 8→24 の半分
  const borderOpacity = useDerivedValue(() => glow.value);

  return (
    <Canvas
      style={{ position: 'absolute', left: -M, top: -M, width: width + M * 2, height: height + M * 2 }}
      pointerEvents="none"
    >
      {/* 外光（shadow相当） */}
      <RoundedRect rect={rrect(rect(M, M, width, height), radius, radius)} color={CYAN} opacity={shadowOpacity}>
        <Blur blur={shadowBlur} />
      </RoundedRect>
      {/* 縁のシアンライン */}
      <RoundedRect
        rect={rrect(rect(M, M, width, height), radius, radius)}
        style="stroke"
        strokeWidth={1.5}
        color={CYAN}
        opacity={borderOpacity}
      />
    </Canvas>
  );
};

export default PurchaseCardGlow;
