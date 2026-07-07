/**
 * Card3D.tsx — 指でなぞって360°回転するカード（厚みつき）
 * ------------------------------------------------------------------
 * 再生画面（プレイヤー）専用。横方向のドラッグで Y 軸まわりに回転し、
 * 何周でも回せる。指を離すと慣性つきで最寄りの面（表/裏）にスナップ。
 *
 * 入力方式（v3・スクロール駆動）:
 *   gesture-handler（v1）→ PanResponder（v2）のどちらもビルドによって
 *   ドラッグが拾えない事例があったため、透明な横スクロール ScrollView を
 *   カードに重ね、そのスクロール量から回転角を導出する方式へ変更。
 *   スクロールはリストと同じ OS ネイティブのタッチ処理なので、
 *   どのビルドでも必ず反応する。snapToInterval=半回転で、離すと
 *   ネイティブの減速→表/裏スナップが自動で得られる。
 *
 * 描画: Reanimated の transform（perspective + rotateY）。RN の transform
 *   は GPU（iOS=Metal / Android=OpenGL）で合成される。
 *
 * RN は CSS の preserve-3d を持たないため、各面/側面に個別の rotateY を与え、
 * カメラを向いている面だけ opacity=1 にする擬似3D。側面は上白→シアンの
 * ベゼルグラデーション（component_catalog の「ガラスの縁」語彙）。
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
const TURNS = 20; // 中央から左右に取れる半回転の数（偶数にする: 初期位置=表）

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

  // 各面：rotateY(rot+offset)。カメラを向く（cos>0）ときだけ表示。
  const faceFront = useAnimatedStyle(() => {
    const a = (initialX - scrollX.value) * SENS;
    return {
      opacity: Math.cos((a * Math.PI) / 180) > 0.04 ? 1 : 0,
      transform: [{ perspective: 1000 }, { rotateY: `${a}deg` }],
    };
  });
  const faceBack = useAnimatedStyle(() => {
    const a = (initialX - scrollX.value) * SENS + 180;
    return {
      opacity: Math.cos((a * Math.PI) / 180) > 0.04 ? 1 : 0,
      transform: [{ perspective: 1000 }, { rotateY: `${a}deg` }],
    };
  });
  // 側面A：rot≈270 で正面（裏が横向きの瞬間）。面に向くにつれ滑らかに現れる。
  const edgeA = useAnimatedStyle(() => {
    const rot = (initialX - scrollX.value) * SENS;
    const c = Math.cos(((rot + 90) * Math.PI) / 180);
    return {
      opacity: Math.max(0, Math.min(1, c * 2.4)),
      transform: [{ perspective: 1000 }, { rotateY: `${rot + 90}deg` }],
    };
  });
  // 側面B：rot≈90 で正面（表が横向きの瞬間）
  const edgeB = useAnimatedStyle(() => {
    const rot = (initialX - scrollX.value) * SENS;
    const c = Math.cos(((rot + 270) * Math.PI) / 180);
    return {
      opacity: Math.max(0, Math.min(1, c * 2.4)),
      transform: [{ perspective: 1000 }, { rotateY: `${rot + 270}deg` }],
    };
  });

  return (
    <View style={[styles.stage, { width, height }]}>
      {/* 表（描画のみ。タッチは最前面の ScrollView が受ける） */}
      <Animated.View style={[styles.centered, faceFront]} pointerEvents="none">{front}</Animated.View>
      {/* 裏 */}
      <Animated.View style={[styles.centered, faceBack]} pointerEvents="none">{back}</Animated.View>
      {/* 側面（厚み） */}
      <Animated.View style={[styles.centered, edgeA]} pointerEvents="none">
        <Edge thickness={thickness} height={height} />
      </Animated.View>
      <Animated.View style={[styles.centered, edgeB]} pointerEvents="none">
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
    backfaceVisibility: 'hidden',
  },
  handle: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});

export default Card3D;
