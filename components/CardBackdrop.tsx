/**
 * CardBackdrop.tsx — 再生カード背後の影レイヤー（Skia）
 * ------------------------------------------------------------------
 * カード直下に、下から順に2層を描く。カードのドラッグ(dragX)に追従する。
 *   ① card-ground: 接地影（カード下端の楕円ソフトシャドウ）
 *   ② card-aura  : 落影（v99-tsubasa: 黒3層。色付きグローは廃止）
 *
 * v90 にあった halo（外周減光）は v99 では削除済み（参照 HTML に .card-halo は
 * 1 件も存在しない）。残すとカード周りが二重に沈んで滲むため取り除いた。
 *
 * ── 単位変換（HTML → Skia）──────────────────────────────
 * CSS の「ぼかし」は 2 系統あって、同じ数値でも意味が違う:
 *   ・filter: blur(N)          … N が標準偏差 σ そのもの  → Skia に N
 *   ・box-shadow の blur-radius … σ の 2 倍              → Skia に blur/2
 * ground は filter: blur(3px) なので σ=3（旧実装は 2 で 33% シャープだった）。
 * aura は box-shadow なので blur/2。
 *
 * dragX / slideFade / aProg(裏返り進捗) / fore(表面度) は Reanimated の
 * SharedValue を購読（Skia は SharedValue を直接受け取れる）。
 * paused / reduce-motion 相当は親が shared value を止めることで対応。
 */

import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Canvas, Group, RoundedRect, Blur, rrect, rect } from '@shopify/react-native-skia';
import { useDerivedValue, SharedValue } from 'react-native-reanimated';
import { CardGround } from './CardGround';

/** 参照実装のカード幅（CSS の px 値はこの幅で定義されている） */
const REF_W = 188.6;

/** .card-aura の落影3層 [dy, blur-radius(=2σ), color]（参照 709行） */
const SHADOWS: [number, number, string][] = [
  [4, 10, 'rgba(0,0,0,0.55)'],
  [16, 34, 'rgba(0,0,0,0.44)'],
  [34, 66, 'rgba(0,0,0,0.34)'],
];
/** .card-aura { border-radius: 22px } */
const AURA_RADIUS = 22;

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
  /** 追従・状態（SharedValue） */
  dragX: SharedValue<number>;
  slideFade: SharedValue<number>; // 0..1 スライドのフェード
  aProg: SharedValue<number>;     // 0..1 裏返り進捗
  fore: SharedValue<number>;      // 0..1 表面度（1=表, 0=裏）
  /** アイドルフロート量 lift = floatY/3.0（-1..1・負が浮上）。接地影が逆相で反応する */
  lift?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
};

export const CardBackdrop: React.FC<CardBackdropProps> = ({
  width,
  height,
  centerX,
  centerY,
  cardW,
  cardH,
  dragX,
  slideFade,
  aProg,
  fore,
  lift,
  style,
}) => {
  const s = cardW / REF_W;

  // dragX 追従（横移動）
  const follow = useDerivedValue(() => [{ translateX: dragX.value }], [dragX]);

  // ── ① ground：接地影（CardGround に委譲・不透明度は slideFade × fore） ──
  const groundFade = useDerivedValue(
    () => slideFade.value * fore.value,
    [slideFade, fore],
  );

  // ── ② aura：黒3層の落影（裏返り中は面がつぶれるので横に縮む） ──
  const auraR = AURA_RADIUS * s;
  const left = centerX - cardW / 2;
  const top = centerY - cardH / 2;
  const auraTransform = useDerivedValue(
    () => [
      { translateX: centerX },
      { scaleX: Math.max(0.02, fore.value) },
      { translateX: -centerX },
    ],
    [fore],
  );
  const auraOpacity = useDerivedValue(() => slideFade.value, [slideFade]);

  return (
    <>
      {/* ① ground：接地影。dragX 追従のため同じ移動量を transform で与える */}
      <CardGround
        width={width}
        height={height}
        centerX={centerX}
        centerY={centerY}
        cardW={cardW}
        cardH={cardH}
        fade={groundFade}
        lift={lift}
        dragX={dragX}
        style={style}
      />

      {/* ② aura：黒3層（広い環境影 → 中景 → 接触の順に重ねる） */}
      <Canvas style={[{ width, height }, style]} pointerEvents="none">
        <Group transform={follow}>
          <Group opacity={auraOpacity} transform={auraTransform}>
            {[...SHADOWS].reverse().map(([dy, blur, color], i) => (
              <RoundedRect
                key={i}
                rect={rrect(rect(left, top + dy * s, cardW, cardH), auraR, auraR)}
                color={color}
              >
                <Blur blur={(blur / 2) * s} />
              </RoundedRect>
            ))}
          </Group>
        </Group>
      </Canvas>
    </>
  );
};

export default CardBackdrop;
