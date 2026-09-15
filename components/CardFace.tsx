/**
 * CardFace.tsx — カード表面の静止表示（v99-tsubasa 準拠・軽量版）
 * ------------------------------------------------------------------
 * 参照の表面 = 角丸（0.085w）の作品画像そのまま（v93: ガラス効果なし）
 *   ＋ CardSurface（面内減光・金の内枠ヘアライン・下端の内側シャドウ）
 *   ＋ CardAura（黒3層の落影。v99-tsubasa で色付きグローは廃止）
 * ホームの非アクティブ面（スワイプ中の隣接カード）用。GL を使わないので軽い。
 *
 * ── 隣の札が黒く／半透明に見える件（2026-09-15）──
 * 以前は <Image source={uri}> 1 枚だけで、札を送るたびに uri が変わって
 * 読み込み直しになっていた。Android の Image は既定で 300ms かけてフェードイン
 * するので、送った直後にもう一度スワイプすると、絵がまだ出ていない隣の札
 * （落影と面内減光だけ＝黒い半透明の板）が中央へ滑り込んでいた。
 *   ・fadeDuration={0} でフェードをなくす
 *   ・layerUris の絵を opacity 0 で先に載せておき、uri が変わっても
 *     ビューを作り直さず不透明度を入れ替えるだけにする（CardGL の表面と同じ方式）
 */

import React, { useMemo } from 'react';
import { View, Image } from 'react-native';
import { CardAura } from './CardAura';
import { CardSurface } from './CardSurface';

type Props = {
  uri: string;
  width: number;
  height: number;
  /** 先に読み込んでおく絵（次に uri になりうるもの）。uri と重複してよい */
  layerUris?: string[];
};

const CardFaceImpl: React.FC<Props> = ({ uri, width, height, layerUris }) => {
  // 並びは uri の出入りで変わるが、key が uri なのでビューは作り直されない
  const layers = useMemo(() => {
    const list = [uri, ...(layerUris ?? [])];
    return list.filter((u, i) => !!u && list.indexOf(u) === i);
  }, [uri, layerUris]);

  return (
    <View style={{ width, height }}>
      <CardAura width={width} height={height} />
      <View style={{ width, height }}>
        {layers.map((u) => (
          <Image
            key={u}
            source={{ uri: u }}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width,
              height,
              borderRadius: 0.085 * width,
              opacity: u === uri ? 1 : 0,
            }}
            resizeMode="cover"
            fadeDuration={0}
          />
        ))}
      </View>
      <CardSurface width={width} height={height} />
    </View>
  );
};


// React.memo で包む。DiscoverScreen が再レンダーすると、素の FC のままでは
// children の要素ツリーが作り直され、RN Skia の Canvas が
// stopMapper → recorder 再構築 → 全ノード再 push（sksg/Container.native.ts）
// を丸ごとやり直す。フリップの開始・終了はまさにその瞬間なので、
// 一番引っかかってほしくないタイミングで最大のコストが乗っていた。
export const CardFace = React.memo(CardFaceImpl);

export default CardFace;
