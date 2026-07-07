/**
 * FlipCard.tsx — タップで表↔裏を反転するカード
 * ------------------------------------------------------------------
 * タップすると横に反転しながら少し前へ（scale up＋上へ）浮き、
 * 裏面（説明）が現れる。もう一度タップで表へ戻る。
 * active=false（別の曲へスワイプ）になったら自動で表に戻す。
 *
 * 描画は 2D 変換のみ（scaleX = |cos θ| の横圧縮で回転を表現）。
 * perspective + rotateY の 3D 変換は iPad（New Architecture）で
 * 画面の半分が描画されなくなる不具合を起こすため使用しない。
 *
 * front は ArtworkCard（Skia Canvas・オーラ余白ぶん大きい）を想定し、
 * それがコンテナサイズを決める。back はその上に中央重ねする。
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type Props = {
  front: React.ReactNode;
  back: React.ReactNode;
  active: boolean;
};

export const FlipCard: React.FC<Props> = ({ front, back, active }) => {
  const flip = useSharedValue(0); // 0=表 / 1=裏

  // 非アクティブ化で表へ戻す
  useEffect(() => {
    if (!active) flip.value = withTiming(0, { duration: 200 });
  }, [active, flip]);

  const toggle = () => {
    flip.value = withTiming(flip.value > 0.5 ? 0 : 1, {
      duration: 520,
      easing: Easing.inOut(Easing.cubic),
    });
  };

  const frontStyle = useAnimatedStyle(() => {
    const c = Math.cos(flip.value * Math.PI); // 1 → -1
    return {
      opacity: flip.value < 0.5 ? 1 : 0, // 中点で表裏を切替
      transform: [
        { scaleX: Math.max(Math.abs(c), 0.001) },
        { scale: 1 + flip.value * 0.08 },
        { translateY: -flip.value * 24 },
      ],
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const c = Math.cos(flip.value * Math.PI);
    return {
      opacity: flip.value < 0.5 ? 0 : 1,
      transform: [
        { scaleX: Math.max(Math.abs(c), 0.001) },
        { scale: 1 + flip.value * 0.08 },
        { translateY: -flip.value * 24 },
      ],
    };
  });

  return (
    <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel="カードを裏返す">
      <Animated.View style={[styles.face, frontStyle]}>{front}</Animated.View>
      <Animated.View style={[styles.faceBack, backStyle]}>{back}</Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  face: {},
  faceBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default FlipCard;
