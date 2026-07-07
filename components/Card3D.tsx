/**
 * Card3D.tsx — 指でなぞって360°回転するカード（厚みつき）
 * ------------------------------------------------------------------
 * 再生画面（プレイヤー）専用。横方向のドラッグで Y 軸まわりに回転し、
 * 何周でも回せる。指を離すと慣性つきで最寄りの面（表/裏）にスナップ。
 *
 * 入力（スクロール駆動）:
 *   透明な横スクロール ScrollView をカードに重ね、スクロール量から回転角を
 *   導出する。リストと同じ OS ネイティブのタッチ処理なので必ず反応する。
 *   snapToInterval=半回転で、離すとネイティブの減速→表/裏スナップ。
 *
 * 描画（v4・2D変換のみ）:
 *   以前は perspective + rotateY + backfaceVisibility の擬似3Dだったが、
 *   iPad（New Architecture）で 0° 以外の角度になると画面の半分が
 *   描画されなくなる致命的な不具合を起こした（iOS の 3D 透視変換の
 *   レイヤー合成バグ）。そのため 3D 変換を全廃し、横方向の圧縮
 *   scaleX = |cos θ| で回転を表現する古典的カードフリップに変更。
 *   2D 変換のみなのでどの環境でも安全に描画される。
 *   90°/270° 付近では側面（厚みのベゼル）が現れ、立体感を補う。
 */

import React, { useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useAnimatedRef,
  scrollTo,
  SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

const SENS = 0.7; // 1px ドラッグあたりの回転角（度）
const HALF_TURN_PX = 180 / SENS; // 半回転（表↔裏）に必要なスクロール量 ≈ 257px
const TURNS = 4; // 中央から左右に取れる半回転の数（偶数にする: 初期位置=表）

type Props = {
  front: React.ReactNode;
  back: React.ReactNode;
  /** 見かけのカード幅・高さ（側面の寸法に使う） */
  width: number;
  height: number;
  /** 厚み（側面の幅）。既定 14 */
  thickness?: number;
  /** 背面レイヤー追従用に、回転角・ドラッグ量を外部の SharedValue へ出力（任意） */
  rotationOut?: SharedValue<number>;
  dragXOut?: SharedValue<number>;
};

// 側面（厚み）— ベゼルの縦グラデーション
const Edge: React.FC<{ thickness: number; height: number }> = ({ thickness, height }) => (
  <Svg width={thickness} height={height}>
    <Defs>
      <LinearGradient id="edge" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#E6F2FF" />
        <Stop offset="0.26" stopColor="#9FB2C8" />
        <Stop offset="0.52" stopColor="#57697F" />
        <Stop offset="0.82" stopColor="#4FB5C9" />
        <Stop offset="1" stopColor="#6FCFE0" />
      </LinearGradient>
    </Defs>
    <Rect x="0" y="0" width={thickness} height={height} rx={thickness / 2} fill="url(#edge)" />
  </Svg>
);

export const Card3D: React.FC<Props> = ({
  front,
  back,
  width,
  height,
  thickness = 14,
  rotationOut,
  dragXOut,
}) => {
  const initialX = TURNS * HALF_TURN_PX; // コンテンツ中央（=回転 0°。TURNS が偶数なので表）
  const scrollX = useSharedValue(initialX);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const centered = useRef(false);

  // コンテンツが敷かれたら一度だけ中央へ（iOS/Android 共通で確実な方法）
  const onContentSizeChange = useCallback(() => {
    if (centered.current) return;
    centered.current = true;
    scrollRef.current?.scrollTo({ x: initialX, animated: false });
  }, [initialX, scrollRef]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const x = e.contentOffset.x;
      scrollX.value = x;
      const delta = initialX - x; // 右ドラッグ（offset減）で正 = 従来の向き
      if (rotationOut) rotationOut.value = delta * SENS;
      if (dragXOut) {
        // スナップ位置でちょうど 0 に戻る鋸歯（背面レイヤーの追従用）
        dragXOut.value = delta - Math.round(delta / HALF_TURN_PX) * HALF_TURN_PX;
      }
    },
    // 静止したら同じ見た目の角度（360°周期）の中央寄り位置へ瞬間移動
    // ＝レールの端に到達せず、何周でも回し続けられる
    onMomentumEnd: (e) => {
      const x = e.contentOffset.x;
      const period = HALF_TURN_PX * 2; // 一回転
      const delta = initialX - x;
      if (Math.abs(delta) >= period) {
        const eq = delta % period;
        const nx = initialX - eq;
        scrollX.value = nx;
        scrollTo(scrollRef, nx, 0, false);
      }
    },
  });

  // 表: cos>0 の間だけ表示。横圧縮 |cos| で回転を表現（2D のみ）
  const faceFront = useAnimatedStyle(() => {
    const a = ((initialX - scrollX.value) * SENS * Math.PI) / 180;
    const c = Math.cos(a);
    return {
      opacity: c > 0.02 ? 1 : 0,
      transform: [{ scaleX: Math.max(Math.abs(c), 0.001) }],
    };
  });
  // 裏: cos<0 の間だけ表示
  const faceBack = useAnimatedStyle(() => {
    const a = ((initialX - scrollX.value) * SENS * Math.PI) / 180;
    const c = Math.cos(a);
    return {
      opacity: c < -0.02 ? 1 : 0,
      transform: [{ scaleX: Math.max(Math.abs(c), 0.001) }],
    };
  });
  // 側面（厚み）: 90°/270° 付近（面がほぼ潰れた時）にだけ現れる
  const edgeStyle = useAnimatedStyle(() => {
    const a = ((initialX - scrollX.value) * SENS * Math.PI) / 180;
    const c = Math.abs(Math.cos(a));
    return {
      opacity: Math.max(0, Math.min(1, (0.28 - c) * 6)),
    };
  });

  return (
    <View style={[styles.stage, { width, height }]}>
      {/* 表（描画のみ。タッチは最前面の ScrollView が受ける） */}
      <Animated.View style={[styles.centered, faceFront]} pointerEvents="none">{front}</Animated.View>
      {/* 裏 */}
      <Animated.View style={[styles.centered, faceBack]} pointerEvents="none">{back}</Animated.View>
      {/* 側面（厚み） */}
      <Animated.View style={[styles.centered, edgeStyle]} pointerEvents="none">
        <Edge thickness={thickness} height={height} />
      </Animated.View>

      {/* 透明の回転ハンドル（横スクロール量 → 回転角） */}
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.handle}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        decelerationRate="fast"
        snapToInterval={HALF_TURN_PX}
        disableIntervalMomentum={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={onContentSizeChange}
        contentOffset={{ x: initialX, y: 0 }}
      >
        <View style={{ width: width + TURNS * 2 * HALF_TURN_PX, height: '100%' }} />
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center' },
  centered: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});

export default Card3D;
