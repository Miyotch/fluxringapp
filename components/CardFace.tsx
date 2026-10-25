/**
 * CardFace.tsx — カード表面の静止表示（v99-tsubasa 準拠・軽量版）
 * ------------------------------------------------------------------
 * 参照の表面 = 角丸（0.085w）の作品画像そのまま（v93: ガラス効果なし）
 *   ＋ CardSurface（面内減光・金の内枠ヘアライン・下端の内側シャドウ）
 *   ＋ CardAura（黒3層の落影。v99-tsubasa で色付きグローは廃止）
 * ホームの非アクティブ面（スワイプ中の隣接カード）用。GL を使わないので軽い。
 */

import React from 'react';
import { View, Image } from 'react-native';
import { CardAura } from './CardAura';
import { CardSurface } from './CardSurface';

type Props = {
  homeFinish?: boolean;
  uri: string;
  width: number;
  height: number;
};

export const CardFace: React.FC<Props> = ({ uri, width, height, homeFinish = false }) => (
  <View style={{ width, height }}>
    <CardAura width={width} height={height} />
    <Image
      source={{ uri }}
      style={{ width, height, borderRadius: 0.085 * width }}
      resizeMode="cover"
    />
    <CardSurface width={width} height={height} homeFinish={homeFinish} />
  </View>
);

export default CardFace;
