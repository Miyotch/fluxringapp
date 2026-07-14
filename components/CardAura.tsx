/**
 * CardAura.tsx — カードのオーラ（card_parts v98 の .card-aura 準拠）
 * ------------------------------------------------------------------
 * 参照CSS:
 *   box-shadow: 0 0 39px 6px  var(--auraA, rgba(96,206,224,.42)),
 *               0 0 84px 21px var(--auraB, rgba(70,132,224,.16)),
 *               0 20px 46px   rgba(0,0,0,.5)
 * を Skia の RoundedRect + Blur で移植（CSS blur radius ≒ 2σ）。
 * 数値は参照のカード幅 188.6 を基準に実カード幅へ等倍スケール。
 */

import React from 'react';
import {
  Canvas,
  RoundedRect,
  Blur,
  rrect,
  rect,
} from '@shopify/react-native-skia';

const REF_W = 188.6;

type Props = {
  width: number;   // カードの見かけ幅(px)
  height: number;
  auraA?: string;
  auraB?: string;
  opacity?: number;
};

export const CardAura: React.FC<Props> = ({
  width,
  height,
  auraA = 'rgba(96,206,224,0.42)',
  auraB = 'rgba(70,132,224,0.16)',
  opacity = 1,
}) => {
  const s = width / REF_W;
  const M = Math.ceil((84 + 21 + 40) * s); // 最大グロー(84+21)＋余白
  const r = 0.085 * width;
  const cw = width + M * 2;
  const ch = height + M * 2;

  const layer = (spread: number, blur: number, color: string, dy = 0, key?: string) => (
    <RoundedRect
      key={key}
      rect={rrect(
        rect(M - spread * s, M - spread * s + dy * s, width + spread * 2 * s, height + spread * 2 * s),
        r + spread * s,
        r + spread * s,
      )}
      color={color}
    >
      <Blur blur={(blur / 2) * s} />
    </RoundedRect>
  );

  return (
    <Canvas
      style={{ position: 'absolute', left: -M, top: -M, width: cw, height: ch, opacity }}
      pointerEvents="none"
    >
      {/* 落影（0 20px 46px 黒50%）を最下層に */}
      {layer(0, 46, 'rgba(0,0,0,0.5)', 20, 'shadow')}
      {/* 外側の広いオーラ（0 0 84px 21px auraB） */}
      {layer(21, 84, auraB, 0, 'b')}
      {/* 内側の濃いオーラ（0 0 39px 6px auraA） */}
      {layer(6, 39, auraA, 0, 'a')}
    </Canvas>
  );
};

export default CardAura;
