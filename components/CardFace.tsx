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
  uri: string;
  width: number;
  height: number;
};

const CardFaceImpl: React.FC<Props> = ({ uri, width, height }) => (
  <View style={{ width, height }}>
    <CardAura width={width} height={height} />
    <Image
      source={{ uri }}
      style={{ width, height, borderRadius: 0.085 * width }}
      resizeMode="cover"
    />
    <CardSurface width={width} height={height} />
  </View>
);


// React.memo で包む。DiscoverScreen が再レンダーすると、素の FC のままでは
// children の要素ツリーが作り直され、RN Skia の Canvas が
// stopMapper → recorder 再構築 → 全ノード再 push（sksg/Container.native.ts）
// を丸ごとやり直す。フリップの開始・終了はまさにその瞬間なので、
// 一番引っかかってほしくないタイミングで最大のコストが乗っていた。
export const CardFace = React.memo(CardFaceImpl);

export default CardFace;
