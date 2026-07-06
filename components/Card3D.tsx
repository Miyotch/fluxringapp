/**
 * Card3D.tsx — 指でなぞって360°回転するカード（厚みつき）
 * ------------------------------------------------------------------
 * 再生画面（プレイヤー）専用。横方向のドラッグで Y 軸まわりに回転し、
 * 一周（360°）できる。指を離すと最寄りの面（表/裏）にスナップ。
 * 表・裏の2面に加え、側面（厚み）を出して「薄い紙」に見えないようにする。
 *
 * RN は CSS の preserve-3d を持たないため、各面/側面に個別の rotateY を与え、
 * カメラを向いている面だけ opacity=1 にする擬似3D。側面は上白→シアンの
 * ベゼルグラデーション（component_catalog の「ガラスの縁」語彙）。
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

const SENS = 0.7; // 1px ドラッグあたりの回転角（度）

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
  const rot = useSharedValue(0); // 回転角（度・連続）
  const base = useSharedValue(0);
  const lifted = useSharedValue(false); // ドロップ後の古いフレーム副作用ガード

  const pan = Gesture.Pan()
    .onBegin(() => {
      lifted.value = false;
      base.value = rot.value;
    })
    .onUpdate((e) => {
      if (lifted.value) return; // 指を離した後の遅延フレームは無視
      rot.value = base.value + e.translationX * SENS;
      if (rotationOut) rotationOut.value = rot.value;
      if (dragXOut) dragXOut.value = e.translationX;
    })
    .onEnd((e) => {
      lifted.value = true;
      // 慣性を少し足して最寄りの面（180°の倍数）へスナップ
      const projected = rot.value + e.velocityX * SENS * 0.06;
      const snapped = Math.round(projected / 180) * 180;
      rot.value = withSpring(snapped, { damping: 15, stiffness: 90, mass: 0.6 });
      if (rotationOut) rotationOut.value = withSpring(snapped, { damping: 15, stiffness: 90, mass: 0.6 });
      if (dragXOut) dragXOut.value = withSpring(0, { damping: 16, stiffness: 120 });
    });

  // 各面：rotateY(rot+offset)。カメラを向く（cos>0）ときだけ表示。
  const faceFront = useAnimatedStyle(() => {
    const a = rot.value;
    return {
      opacity: Math.cos((a * Math.PI) / 180) > 0.04 ? 1 : 0,
      transform: [{ perspective: 1000 }, { rotateY: `${a}deg` }],
    };
  });
  const faceBack = useAnimatedStyle(() => {
    const a = rot.value + 180;
    return {
      opacity: Math.cos((a * Math.PI) / 180) > 0.04 ? 1 : 0,
      transform: [{ perspective: 1000 }, { rotateY: `${a}deg` }],
    };
  });
  // 側面A：rot≈270 で正面（裏が横向きの瞬間）。面に向くにつれ滑らかに現れる。
  const edgeA = useAnimatedStyle(() => {
    const c = Math.cos(((rot.value + 90) * Math.PI) / 180);
    return {
      opacity: Math.max(0, Math.min(1, c * 2.4)),
      transform: [{ perspective: 1000 }, { rotateY: `${rot.value + 90}deg` }],
    };
  });
  // 側面B：rot≈90 で正面（表が横向きの瞬間）
  const edgeB = useAnimatedStyle(() => {
    const c = Math.cos(((rot.value + 270) * Math.PI) / 180);
    return {
      opacity: Math.max(0, Math.min(1, c * 2.4)),
      transform: [{ perspective: 1000 }, { rotateY: `${rot.value + 270}deg` }],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.stage}>
        {/* 表（front がコンテナサイズを決める） */}
        <Animated.View style={[styles.face, faceFront]}>{front}</Animated.View>
        {/* 裏 */}
        <Animated.View style={[styles.centered, faceBack]}>{back}</Animated.View>
        {/* 側面（厚み） */}
        <Animated.View style={[styles.centered, edgeA]}>
          <Edge thickness={thickness} height={height} />
        </Animated.View>
        <Animated.View style={[styles.centered, edgeB]}>
          <Edge thickness={thickness} height={height} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center' },
  face: { backfaceVisibility: 'hidden' },
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
});

export default Card3D;
