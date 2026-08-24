/**
 * PurchaseGlow.tsx — 購入トランジションの「シアンの呼吸」
 * ------------------------------------------------------------------
 * DESIGN.md「PURCHASE — 購入トランジション」②シアンの呼吸 の実装値をそのまま写す:
 *
 *   box-shadow:
 *     0 0 66px  16px rgba(120,232,255,.78)   ← 内側の靄（濃い・狭い）
 *     0 0 124px 34px rgba(96,206,224,.5)     ← 外側の靄（薄い・広い）
 *     inset 0 0 0 1px rgba(120,232,255,.5)   ← カード枠（内側1px）
 *   transition: box-shadow .55s ease-in-out ／ 立ち上がり約0.6秒・約700msで戻す
 *
 * 2 層に分けて描く。カードは GL キャンバスで描かれるため、
 *   layer='haze'  … 外周の靄。カードより背面に置く
 *   layer='frame' … 内側1pxの枠。カード面・表面オーバーレイより前面に置く
 *
 * ── 単位変換（CSS box-shadow → Skia）────────────────────────
 * box-shadow の blur-radius は σ の 2 倍（CSS Backgrounds 仕様）。
 * Skia の <Blur blur={}> は σ を取るので blur/2 を渡す。
 * spread は矩形をその分だけ外へ膨らませる（角丸も同量増える）。
 *
 * 寸法は参照のカード幅 188.6px 基準。実カード幅へ等倍スケールする。
 */

import React from 'react';
import { Canvas, RoundedRect, Blur, rrect, rect } from '@shopify/react-native-skia';
import { useDerivedValue, SharedValue } from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';

const REF_W = 188.6;
/** 角丸 --cr = 0.085 × カード幅（カード本体と同一） */
const CORNER_RATIO = 0.085;

/** [spread, blur-radius(=2σ), color] — DESIGN.md の外周2層 */
const HAZE: [number, number, string][] = [
  [16, 66, 'rgba(120,232,255,0.78)'],
  [34, 124, 'rgba(96,206,224,0.5)'],
];

/** inset 0 0 0 1px rgba(120,232,255,.5) */
const FRAME_W = 1;
const FRAME_COLOR = 'rgba(120,232,255,0.5)';

export type PurchaseGlowProps = {
  /** 'haze' = 外周の靄（背面）/ 'frame' = 内側1pxの枠（前面） */
  layer: 'haze' | 'frame';
  /** カードの見かけ幅・高さ(px) */
  width: number;
  height: number;
  /** 0=平常 / 1=呼吸のピーク */
  progress: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
};

export const PurchaseGlow: React.FC<PurchaseGlowProps> = ({
  layer,
  width,
  height,
  progress,
  style,
}) => {
  const s = width / REF_W;
  const r = CORNER_RATIO * width;
  const opacity = useDerivedValue(() => progress.value, [progress]);

  if (layer === 'frame') {
    const w = FRAME_W * s;
    return (
      <Canvas
        style={[{ position: 'absolute', left: 0, top: 0, width, height }, style]}
        pointerEvents="none"
      >
        <RoundedRect
          rect={rrect(rect(w / 2, w / 2, width - w, height - w), r - w / 2, r - w / 2)}
          color={FRAME_COLOR}
          style="stroke"
          strokeWidth={w}
          opacity={opacity}
        />
      </Canvas>
    );
  }

  // 最大の靄（spread34 + blur124）が切れないだけの余白
  const M = Math.ceil((34 + 124) * s);

  return (
    <Canvas
      style={[
        {
          position: 'absolute',
          left: -M,
          top: -M,
          width: width + M * 2,
          height: height + M * 2,
        },
        style,
      ]}
      pointerEvents="none"
    >
      {/* 薄く広いものを下に（外側 → 内側の順で重ねる） */}
      {[...HAZE].reverse().map(([spread, blur, color], i) => {
        const sp = spread * s;
        return (
          <RoundedRect
            key={i}
            rect={rrect(
              rect(M - sp, M - sp, width + sp * 2, height + sp * 2),
              r + sp,
              r + sp,
            )}
            color={color}
            opacity={opacity}
          >
            <Blur blur={(blur / 2) * s} />
          </RoundedRect>
        );
      })}
    </Canvas>
  );
};

export default PurchaseGlow;
