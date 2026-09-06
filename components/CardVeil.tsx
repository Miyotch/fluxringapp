/**
 * CardVeil.tsx — カードを開いたときに背景を沈める幕（参照 .ca-veil）
 * ------------------------------------------------------------------
 * 参照 fr_v98_FIX-cardaction.html 2877行:
 *
 *   .ca-veil{inset:0;z-index:4;opacity:0;
 *     background:radial-gradient(ellipse at 50% 44%,
 *       rgba(5,7,20,.08) 10%, rgba(4,5,18,.56) 59%, rgba(3,4,13,.82) 100%);
 *     transition:opacity .8s cubic-bezier(.2,.7,.2,1)}
 *   .device.ca-detail .ca-veil{opacity:1}
 *
 * 参照は z-index 4 ＝ .stage(3) より上だが、あちらはカードを別レイヤー
 * （#deckStage）へ持ち上げてから幕を敷く。こちらはカードが .stage に居たまま
 * 裏返るので、**カードより下・調律陣より上** に置く。暗くなるのは背景だけで、
 * カード自身は沈まない。
 *
 * この Canvas には SharedValue を一切持ち込まない（BackdropVeil と同じ規律）。
 * 濃さの出し入れは呼び出し側がラッパの opacity でやる＝ネイティブの合成だけで
 * 済み、幕そのものは一度ラスタライズされたきり塗り直されない。
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Group, RadialGradient, Rect, vec } from '@shopify/react-native-skia';

export type CardVeilProps = {
  width: number;
  height: number;
};

const CardVeilImpl: React.FC<CardVeilProps> = ({ width: W, height: H }) => {
  // CSS の radial-gradient(ellipse at 50% 44%) は既定が farthest-corner。
  // 楕円なので rx = 遠いほうの横距離、ry = 遠いほうの縦距離。
  const cx = W * 0.5;
  const cy = H * 0.44;
  const rx = W * 0.5;
  const ry = H * 0.56;

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width: W, height: H }]} pointerEvents="none">
      {/* 正円のグラデを縦へ引き伸ばして楕円にする（BackdropSky の .bgbase と同手） */}
      <Group
        transform={[
          { translateX: cx },
          { translateY: cy },
          { scaleY: ry / rx },
          { translateX: -cx },
          { translateY: -cy },
        ]}
      >
        <Rect x={cx - rx * 2} y={cy - rx * 2} width={rx * 4} height={rx * 4}>
          <RadialGradient
            c={vec(cx, cy)}
            r={rx}
            colors={[
              'rgba(5,7,20,0.08)',
              'rgba(5,7,20,0.08)',
              'rgba(4,5,18,0.56)',
              'rgba(3,4,13,0.82)',
            ]}
            positions={[0, 0.1, 0.59, 1]}
          />
        </Rect>
      </Group>
    </Canvas>
  );
};

export const CardVeil = React.memo(CardVeilImpl);

export default CardVeil;
