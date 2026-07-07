/**
 * CardBackdrop.tsx — 再生カード背後の発光・影レイヤー（Skia）
 * ------------------------------------------------------------------
 * カード直下に、下から順に3層を描く。カードのドラッグ(dragX)に追従する。
 *   ① card-halo  : 外周減光ハロ（発光面と暗背景の境界をなだらかに）
 *   ② card-ground: 接地影（カード下端の楕円ソフトシャドウ）
 *   ③ card-aura  : 色付きオーラ（v86 で -30% 調整済み）
 *
 * dragX / slideFade / aProg(裏返り進捗) / fore(表面度) は Reanimated の
 * SharedValue を購読（Skia は SharedValue を直接受け取れる）。
 * paused / reduce-motion 相当は親が shared value を止めることで対応。
 */

import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import {
  Canvas,
  Group,
  Circle,
  RoundedRect,
  RadialGradient,
  Blur,
  rrect,
  rect,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue, SharedValue } from 'react-native-reanimated';

export type CardBackdropProps = {
  /** キャンバスサイズ */
  width: number;
  height: number;
  /** カード中心（キャンバス座標） */
  centerX: number;
  centerY: number;
  /** 見かけのカード寸法 */
  cardW: number;
  cardH: number;
  /** オーラ色（作品ごと） */
  auraA?: string; // 内側（例 rgba(96,206,224,0.42)）
  auraB?: string; // 外側（例 rgba(70,132,224,0.16)）
  /** 追従・状態（SharedValue） */
  dragX: SharedValue<number>;
  slideFade: SharedValue<number>; // 0..1 スライドのフェード
  aProg: SharedValue<number>;     // 0..1 裏返り進捗
  fore: SharedValue<number>;      // 0..1 表面度（1=表, 0=裏）
  /** オーラ強度（0..1）。動的 blur/spread 計算に使用 */
  auraIntensity?: number;
  style?: StyleProp<ViewStyle>;
};

export const CardBackdrop: React.FC<CardBackdropProps> = ({
  width,
  height,
  centerX,
  centerY,
  cardW,
  cardH,
  auraA = 'rgba(96,206,224,0.42)',
  auraB = 'rgba(70,132,224,0.16)',
  dragX,
  slideFade,
  aProg,
  fore,
  auraIntensity = 1,
  style,
}) => {
  const aI = auraIntensity;

  // dragX 追従（横移動）
  const follow = useDerivedValue(() => [{ translateX: dragX.value }], [dragX]);

  // ── ① halo ──
  const haloW = cardW * 1.9;
  const haloH = cardH * 1.55;
  const haloOpacity = useDerivedValue(
    () => 0.9 * slideFade.value * (1 - aProg.value * 0.6),
    [slideFade, aProg],
  );

  // ── ② ground ──
  const groundW = cardW * 0.86;
  const groundH = cardH * 0.16;
  const groundCY = centerY + cardH * 0.42; // カード下端やや上
  const groundOpacity = useDerivedValue(
    () => 0.78 * slideFade.value * fore.value,
    [slideFade, fore],
  );

  // ── ③ aura（v86: 内 39/6・外 84/21 を基準。動的計算） ──
  // 内 blur=(32+aI*28) spread=(4+aI*7)、外 blur=(70+aI*42) spread=(15+aI*13)
  const inBlur = 32 + aI * 28;
  const inSpread = 4 + aI * 7;
  const outBlur = 70 + aI * 42;
  const outSpread = 15 + aI * 13;
  const auraOpacity = useDerivedValue(() => slideFade.value, [slideFade]);

  const radius = Math.round(cardW * 0.118);
  const left = centerX - cardW / 2;
  const top = centerY - cardH / 2;

  return (
    <Canvas style={[{ width, height }, style]} pointerEvents="none">
      <Group transform={follow}>
        {/* ① halo：暗い放射ハロ（楕円 62%x58% を scale で近似） */}
        <Group opacity={haloOpacity}>
          <Group
            transform={[
              { translateX: centerX },
              { translateY: centerY },
              { scaleY: haloH / haloW },
              { translateX: -centerX },
              { translateY: -centerY },
            ]}
          >
            <Circle cx={centerX} cy={centerY} r={haloW / 2}>
              <RadialGradient
                c={vec(centerX, centerY)}
                r={haloW / 2}
                positions={[0, 0.46, 0.72]}
                colors={['rgba(3,4,12,0.42)', 'rgba(3,4,12,0.24)', 'rgba(3,4,12,0)']}
              />
            </Circle>
          </Group>
        </Group>

        {/* ② ground：接地影（楕円ソフトシャドウ・blur 2） */}
        <Group opacity={groundOpacity}>
          <Group
            transform={[
              { translateX: centerX },
              { translateY: groundCY },
              { scaleY: groundH / groundW },
              { translateX: -centerX },
              { translateY: -groundCY },
            ]}
          >
            <Circle cx={centerX} cy={groundCY} r={groundW / 2}>
              <RadialGradient
                c={vec(centerX, groundCY)}
                r={groundW / 2}
                positions={[0, 0.4, 0.78]}
                colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.32)', 'rgba(0,0,0,0)']}
              />
              <Blur blur={2} />
            </Circle>
          </Group>
        </Group>

        {/* ③ aura：色付きグロー（内 auraA / 外 auraB・rim 光なし） */}
        <Group opacity={auraOpacity}>
          {/* 外側（広く薄い） */}
          <RoundedRect
            rect={rrect(
              rect(left - outSpread, top - outSpread, cardW + outSpread * 2, cardH + outSpread * 2),
              radius + outSpread,
              radius + outSpread,
            )}
            color={auraB}
          >
            <Blur blur={outBlur / 2} />
          </RoundedRect>
          {/* 内側（濃い） */}
          <RoundedRect
            rect={rrect(
              rect(left - inSpread, top - inSpread, cardW + inSpread * 2, cardH + inSpread * 2),
              radius + inSpread,
              radius + inSpread,
            )}
            color={auraA}
          >
            <Blur blur={inBlur / 2} />
          </RoundedRect>
        </Group>
      </Group>
    </Canvas>
  );
};

export default CardBackdrop;
