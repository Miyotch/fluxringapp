/**
 * PurchaseCardGlow.tsx — 購入確定時、カード（またはボタン）の縁が光るエフェクト
 * ------------------------------------------------------------------
 * 指定のシャドウ:
 *   box-shadow: 0 0 10px rgba(96,206,224,1), 0 0 26px rgba(96,206,224,.55)
 * を、Skia の RoundedRect + Blur 2層で再現する。
 *
 *   ・芯（core）: CSS blur 10px 相当・不透明度 1.0   → 縁のすぐ外に強い光
 *   ・傘（halo）: CSS blur 26px 相当・不透明度 0.55  → 遠くまで淡く拡散
 *   ・縁線      : 発光ピークで 1.5px のシアンのライン
 *
 * CSS の blur-radius と Skia の blur は尺度が違う（Skia は σ）。
 * σ ≒ radius / 2 で見た目が合うため、10px → σ5 / 26px → σ13 とする。
 *
 * glow（0=通常, 1=発光ピーク）は呼び出し側（DiscoverScreen）が withSequence で
 * 駆動する共有値。breathing=true のときは、その上にゆっくりした脈動（Breath）を
 * 重ねて「一定時間 脈打ってから静まる」動きにする。
 */

import React from 'react';
import { Canvas, RoundedRect, rrect, rect, Blur, useClock } from '@shopify/react-native-skia';
import { useDerivedValue, SharedValue } from 'react-native-reanimated';

const CYAN = 'rgb(96,206,224)';

// CSS blur-radius → Skia の σ（およそ半分）
const CORE_SIGMA = 5;   // box-shadow 0 0 10px
const HALO_SIGMA = 13;  // box-shadow 0 0 26px
const HALO_ALPHA = 0.55; // rgba(96,206,224,.55)

// 外光のにじみ分の余白。σ13 のガウスは約3σ=39px 先まで届くので、
// キャンバスを切らないよう余裕をもって確保する。
const M = 52;

// 脈動（Breath）: 1秒あたりの回数と深さ
const BREATH_HZ = 1.6;
const BREATH_DEPTH = 0.18;

type Props = {
  width: number;
  height: number;
  radius: number;
  /** 0..1（0=通常, 1=発光ピーク）。呼び出し側が withSequence で駆動する */
  glow: SharedValue<number>;
  /** 発光中にゆっくり脈打たせる（既定 true） */
  breathing?: boolean;
};

export const PurchaseCardGlow: React.FC<Props> = ({
  width,
  height,
  radius,
  glow,
  breathing = true,
}) => {
  const clock = useClock();

  // 脈動を乗せた実効的な発光量。glow が 0 の間は 0 のままなので、
  // 「光っているあいだだけ脈打ち、収束すると静かに消える」動きになる。
  const level = useDerivedValue(() => {
    if (!breathing) return glow.value;
    const b = 1 - BREATH_DEPTH + BREATH_DEPTH * Math.sin((clock.value / 1000) * BREATH_HZ * Math.PI * 2);
    return glow.value * b;
  });

  const coreOpacity = useDerivedValue(() => level.value);
  const haloOpacity = useDerivedValue(() => level.value * HALO_ALPHA);
  const edgeOpacity = useDerivedValue(() => level.value);
  // 縁線は 0 → 1.5px へ育つ
  const edgeWidth = useDerivedValue(() => 0.4 + glow.value * 1.1);

  const box = rrect(rect(M, M, width, height), radius, radius);

  return (
    <Canvas
      style={{
        position: 'absolute',
        left: -M,
        top: -M,
        width: width + M * 2,
        height: height + M * 2,
      }}
      pointerEvents="none"
    >
      {/* 傘: 遠くまで届く淡い拡散光（0 0 26px rgba(...,.55)） */}
      <RoundedRect rect={box} color={CYAN} opacity={haloOpacity}>
        <Blur blur={HALO_SIGMA} />
      </RoundedRect>

      {/* 芯: 縁のすぐ外に出る強い光（0 0 10px rgba(...,1)） */}
      <RoundedRect rect={box} color={CYAN} opacity={coreOpacity}>
        <Blur blur={CORE_SIGMA} />
      </RoundedRect>

      {/* 縁のシアンライン */}
      <RoundedRect
        rect={box}
        style="stroke"
        strokeWidth={edgeWidth}
        color={CYAN}
        opacity={edgeOpacity}
      />
    </Canvas>
  );
};

export default PurchaseCardGlow;
