/**
 * HeroGlow.tsx — FLUX RING ヒーロー発光（蛍の明滅）の参照実装
 * ------------------------------------------------------------------
 * 何を: ArtworkCard の画像領域の上に screen 合成で重ねる、ゆっくり明滅する発光。
 *       「蛍がふっと明るくなって落ちる」呼吸を、作品の主要色(シアン既定)で表現する。
 *
 * なぜ Skia + reanimated か: 明滅は時間ベースのアニメーション。reanimated の SharedValue を
 *       Skia の opacity に直接渡し、UI スレッドだけで滑らかに駆動する（JS を跨がない）。
 *
 * 対応資料: トンマナ仕様 V2「ヒーロー発光（蛍の明滅）」。
 *
 * 実機調整ポイント:
 *   - peak: 一番明るい瞬間の不透明度。強すぎると作品が白飛びする。既定 0.5。
 *   - period: 1呼吸の長さ(ms)。長いほど落ち着く。既定 2600。
 *   - range: 明滅の下限/上限。min を上げると常時うっすら光る。
 *
 * 依存: @shopify/react-native-skia, react-native-reanimated
 */

import React, { useEffect } from 'react';
import {
  Group,
  RoundedRect,
  rrect,
  rect,
  RadialGradient,
  vec,
  Blur,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useDerivedValue,
  cancelAnimation,
} from 'react-native-reanimated';

/** 明滅の不透明度レンジ（0..1）。min=最も暗い瞬間 / max=最も明るい瞬間 */
export type HeroRange = { min: number; max: number };

export type HeroGlowProps = {
  /** 画像領域（ArtworkCard の imgX/imgY/imgW/imgH/imgRadius） */
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  /** false の間はアニメーションを止めて非表示にする */
  enabled?: boolean;
  /** 一番明るい瞬間の不透明度（既定 0.5） */
  peak?: number;
  /** 1呼吸の長さ ms（既定 2600） */
  period?: number;
  /** 明滅の下限/上限。未指定なら {min:0.12, max:peak} */
  range?: HeroRange;
  /** 発光の色（作品主要色）。既定はシアン #60CEE0 */
  color?: string;
};

export const HeroGlow: React.FC<HeroGlowProps> = ({
  x,
  y,
  w,
  h,
  radius,
  enabled = true,
  peak = 0.5,
  period = 2600,
  range,
  color = 'rgba(96,206,224,1)',
}) => {
  const min = range?.min ?? 0.12;
  const max = range?.max ?? peak;

  // 0→1→0 を往復する位相。withRepeat の reverse=true で滑らかに折り返す。
  const phase = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(phase);
    if (!enabled) {
      phase.value = 0;
      return;
    }
    phase.value = 0;
    phase.value = withRepeat(
      withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }),
      -1, // 無限
      true // 折り返し（明→暗→明）
    );
    return () => cancelAnimation(phase);
  }, [enabled, period, phase]);

  // 位相→不透明度。SharedValue のまま Skia の opacity に渡す（UIスレッド駆動）。
  const opacity = useDerivedValue(() => {
    'worklet';
    return min + (max - min) * phase.value;
  }, [min, max]);

  if (!enabled) return null;

  const clip = rrect(rect(x, y, w, h), radius, radius);
  const cx = x + w / 2;
  // 蛍は「やや下から立ち上がる」イメージ。中心を少し下に置くと自然。
  const cy = y + h * 0.62;

  return (
    <Group blendMode="screen" clip={clip} opacity={opacity}>
      <RoundedRect rect={clip}>
        <RadialGradient
          c={vec(cx, cy)}
          r={Math.max(w, h) * 0.62}
          colors={[color, 'rgba(96,206,224,0)']}
          positions={[0, 1]}
        />
        {/* 縁をやわらかく溶かして“にじむ光”にする */}
        <Blur blur={6} />
      </RoundedRect>
    </Group>
  );
};
