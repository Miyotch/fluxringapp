/**
 * CardGround.tsx — カードの接地影（v99-tsubasa `.card-ground`）
 * ------------------------------------------------------------------
 * 参照: fr_v99_tsubasa.html 33行（見た目）/ 708行（フロート連動）
 *
 *   gw      = w * 0.86 * (1 - lift*0.07)
 *   gh      = h * 0.16 * (1 - lift*0.05)
 *   top     = カード中心 + h*0.5 - gh*0.2   ← 要素の「上端」。marginTop は無い
 *   opacity = 0.78 * fade * (1 + lift*0.14)
 *
 * top が上端指定である点に注意（marginLeft:-gw/2 はあるが marginTop は無い）。
 * つまり楕円の中心はカード下端の *下* gh*0.3 で、カードに重なるのは上側 gh*0.2
 * ぶんだけ——しかもそこは放射グラデの外周でほぼ透明。実DOMで検算済み。
 * 影はカードのフロートに追従しない（床に留まる）ので centerY は静止時の中心。
 *   塗り    = radial rgba(0,0,0,.62) 0% → .40 30% → .18 54% → 0 76%
 *             ※ アプリでは黒帯に見えたため COLORS で減光済み（下のコメント）
 *   ぼかし  = filter: blur(3px)  ← filter の値は σ そのもの（box-shadow の 2σ とは別）
 *
 * lift はフロート量 floatY/3.0（-1..1）。**影自体は床に留めてフロートさせない**。
 * 代わりにフロートと逆相で反応させる——浮く(lift<0)と薄く広く、沈むと濃く狭く。
 * これが「カードが浮いている」ことの視覚的裏付けになる。カードと一緒に影まで
 * 動かすと、ただ絵全体が上下しているようにしか見えない。
 */

import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Canvas, Group, Circle, RadialGradient, Blur, vec } from '@shopify/react-native-skia';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';

/** 参照実装のカード幅（CSS の px 値はこの幅で定義されている） */
const REF_W = 188.6;

/**
 * .card-ground の radial-gradient 階調。
 *
 * 参照値は 0.62 / 0.40 / 0.18 / 0 ＋ BASE_OPACITY 0.78 で、カード下端の
 * すぐ下がアルファ 0.48 の黒になる。楕円の中心がカード下端の 15px 下・
 * 高さがカード高の 16% あるため、実機ではこれが「カードの背景に黒い画面が
 * ある」と見える幅 0.86w・高さ 40px 級の黒帯になっていた。
 * 接地の手がかりは残したいので、消さずに濃さを約 1/3（ピーク 0.16）まで
 * 落とす。形・位置・フロート連動は参照のまま。
 */
const COLORS = ['rgba(0,0,0,0.26)', 'rgba(0,0,0,0.16)', 'rgba(0,0,0,0.07)', 'rgba(0,0,0,0)'];
const STOPS = [0, 0.3, 0.54, 0.76];
/** filter: blur(3px) — filter の値は σ そのもの */
const SIGMA = 3;
/** 基準不透明度（参照 0.78 → 黒帯に見えたため減光） */
const BASE_OPACITY = 0.6;

export type CardGroundProps = {
  /** キャンバス寸法 */
  width: number;
  height: number;
  /** カード中心（キャンバス座標） */
  centerX: number;
  centerY: number;
  /** 見かけのカード寸法 */
  cardW: number;
  cardH: number;
  /** 不透明度係数（slideFade × fore 等）。既定 1 */
  fade?: SharedValue<number>;
  /** フロート量 lift = floatY/3.0（-1..1・負が浮上）。既定 0 */
  lift?: SharedValue<number>;
  /** カードの横ドラッグ追従(px)。既定 0 */
  dragX?: SharedValue<number>;
  /**
   * カード本体の表示倍率への追従。既定 1。
   * 3D（裏返し）でカードが一回り縮むため、影だけ元の大きさで残ると
   * カードより広い影になって浮きが嘘になる。
   */
  scale?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
};

const CardGroundImpl: React.FC<CardGroundProps> = ({
  centerX,
  centerY,
  cardW,
  cardH,
  fade,
  lift,
  dragX,
  scale,
  style,
}) => {
  const s = cardW / REF_W;

  // lift=0 のときの基準寸法・位置
  // 楕円中心 = 上端(centerY + h*0.5 - gh*0.2) + gh/2 = centerY + h*0.5 + gh*0.3
  const gw0 = cardW * 0.86;
  const gh0 = cardH * 0.16;
  const cy0 = centerY + cardH * 0.5 + gh0 * 0.3;

  // ── Canvas を楕円のタイトボックスまで縮める ──────────────────────
  // 全画面（screenW × slideH）で持つ必要はまったく無い。3x 機だと 2.86Mpx =
  // 11.4MB の Metal drawable を、幅 0.86w・高さ 0.16h の楕円ひとつのために
  // 確保していた。ぼかしの裾ぶん（4σ）だけ余白を取れば足りる。
  // 箱の中心がちょうど楕円の中心 (centerX, cy0) になるように取るのが要点で、
  // これで下の RN transform のピボット（ビュー中心）が Skia 版のピボットと
  // 一致し、変換式が単純な平行移動＋拡縮に落ちる。
  const m = Math.ceil(SIGMA * s * 4) + 2;
  const bw = gw0 + m * 2;
  const bh = gh0 + m * 2;
  const bx = centerX - bw / 2;
  const by = cy0 - bh / 2;

  // ── 動くものは全部 Skia の外（RN のコンポジタ）へ ────────────────
  // 以前は opacity と transform を Skia の <Group> に渡していたが、RN Skia は
  // Canvas 単位でしか再描画できないため、値が変わるたびに全画面 Canvas が
  // clear + ガウシアン込みで塗り直されていた。アイドル時ですら useIdleFloat の
  // ±3px がこれを毎フレーム誘発していた（60〜120fps）。
  //
  // opacity は単なるアルファ乗算、transform は「中心ピボットの拡縮 ＋ 平行移動」
  // で、どちらも RN の Animated.View で 1:1 に書ける。移すと Canvas 配下の
  // SharedValue がゼロになり、sksg/Container の startMapper が張られない＝
  // マウント時に 1 回描いて以降は一切再ラスタライズしない。
  //
  // 元の Skia 版 CTM:
  //   T(dragX) · T(centerX) · T(0, cy0 - k·l) · S(sx,sy) · T(-centerX) · T(0,-cy0)
  // ＝ ピボット (centerX, cy0) まわりの拡縮 → (dragX, -k·l) の平行移動。
  // ビュー中心が (centerX, cy0) なので、RN 側は拡縮と平行移動を並べるだけでよい。
  const animStyle = useAnimatedStyle(() => {
    const l = lift?.value ?? 0;
    const sc = scale?.value ?? 1;
    return {
      opacity: BASE_OPACITY * (fade?.value ?? 1) * (1 + l * 0.14),
      transform: [
        { translateX: dragX?.value ?? 0 },
        // gh の変化で中心も動く: cy = ... + gh*0.3 なので Δcy = -gh0 * 0.015 * lift
        { translateY: -gh0 * 0.015 * l },
        { scaleX: (1 - l * 0.07) * sc },
        { scaleY: (1 - l * 0.05) * sc },
      ],
    };
  }, [fade, lift, dragX, scale]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[style, { position: 'absolute', left: bx, top: by, width: bw, height: bh }, animStyle]}
    >
      <Canvas style={{ width: bw, height: bh }} pointerEvents="none">
        {/* 箱をずらしたぶんの平行移動。ここが平行移動「だけ」であることが重要で、
            拡縮を混ぜると CTM 経由で <Blur> の σ まで写像されてぼかしが変わる。 */}
        <Group transform={[{ translateX: -bx }, { translateY: -by }]}>
          {/* 正円を縦へ潰して楕円化（Skia の RadialGradient は円のみ） */}
          <Group
            transform={[
              { translateX: centerX },
              { translateY: cy0 },
              { scaleY: gh0 / gw0 },
              { translateX: -centerX },
              { translateY: -cy0 },
            ]}
          >
            <Circle cx={centerX} cy={cy0} r={gw0 / 2}>
              <RadialGradient
                c={vec(centerX, cy0)}
                r={gw0 / 2}
                positions={STOPS}
                colors={COLORS}
              />
              <Blur blur={SIGMA * s} />
            </Circle>
          </Group>
        </Group>
      </Canvas>
    </Animated.View>
  );
};


// React.memo で包む。DiscoverScreen が再レンダーすると、素の FC のままでは
// children の要素ツリーが作り直され、RN Skia の Canvas が
// stopMapper → recorder 再構築 → 全ノード再 push（sksg/Container.native.ts）
// を丸ごとやり直す。フリップの開始・終了はまさにその瞬間なので、
// 一番引っかかってほしくないタイミングで最大のコストが乗っていた。
export const CardGround = React.memo(CardGroundImpl);

export default CardGround;
