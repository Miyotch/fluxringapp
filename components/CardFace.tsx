/**
 * CardFace.tsx — カード表面の静止表示（card_parts v98 準拠・軽量版）
 * ------------------------------------------------------------------
 * 参照の表面 = 角丸（0.085w）の作品画像そのまま（v93: ガラス効果なし）
 * ＋ card-aura（2層グロー＋落影）。
 * ホームの非アクティブ面（スワイプ中の隣接カード）用。GL を使わないので軽い。
 */

import React from 'react';
import { View, Image } from 'react-native';
import { CardAura } from './CardAura';

type Props = {
  uri: string;
  width: number;
  height: number;
  auraA?: string;
  auraB?: string;
};

export const CardFace: React.FC<Props> = ({ uri, width, height, auraA, auraB }) => (
  <View style={{ width, height }}>
    <CardAura width={width} height={height} auraA={auraA} auraB={auraB} />
    <Image
      source={{ uri }}
      style={{ width, height, borderRadius: 0.085 * width }}
      resizeMode="cover"
    />
  </View>
);

export default CardFace;
