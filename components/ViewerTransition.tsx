/**
 * ViewerTransition.tsx — カードを眺める画面の開き方・閉じ方（2026-10-13）
 * ------------------------------------------------------------------
 * 以前は画面を丸ごと差し替えていたので、開くのも閉じるのも一瞬で切り替わり、
 * 戻ると元のリストが作り直されて先頭へ戻っていた。
 *
 *   ・下の画面（プレイリスト）は消さずに残し、その上にこの画面を重ねる
 *   ・origin あり（リストの札を押した）… 押した札の位置から画面いっぱいへ大きくなる。
 *     閉じるときは同じ札の位置へ縮んで帰る（iPhone の写真アプリと同じ型）
 *   ・origin なし（再生バナーを押した）… 下からせり上がる。閉じるときは下へ（Spotify と同じ）
 *   ・裏の画面は開くにつれて暗くなる
 *   ・Android の戻るボタンでも閉じる
 *
 * children に close() を渡す。画面の「戻る」はこれを呼ぶ（動き終わってから onClosed）。
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  Extrapolation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { CardOrigin } from './CardAfterimage';

type Props = {
  origin?: CardOrigin;
  onClosed: () => void;
  children: (close: () => void) => React.ReactNode;
};

const OPEN_MS = 360;
const CLOSE_MS = 280;

export const ViewerTransition: React.FC<Props> = ({ origin, onClosed, children }) => {
  const { width: W, height: H } = useWindowDimensions();
  const p = useSharedValue(0);
  const closing = useRef(false);

  useEffect(() => {
    p.value = withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
  }, [p]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    p.value = withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) }, (fin) => {
      if (fin) runOnJS(onClosed)();
    });
  }, [p, onClosed]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  // 札の中心・大きさ（UI スレッドで読むので数値にしておく）
  const ox = origin ? origin.x + origin.width / 2 : 0;
  const oy = origin ? origin.y + origin.height / 2 : 0;
  // 画面全体を札の大きさまで縮めた状態から始める（縦横は札の高さに合わせる）
  const s0 = origin ? Math.max(0.08, Math.min(1, origin.height / H)) : 1;
  const hasOrigin = !!origin;

  const sheet = useAnimatedStyle(() => {
    const v = p.value;
    if (hasOrigin) {
      return {
        opacity: interpolate(v, [0, 0.18], [0, 1], Extrapolation.CLAMP),
        borderRadius: interpolate(v, [0, 1], [28, 0]),
        transform: [
          { translateX: (ox - W / 2) * (1 - v) },
          { translateY: (oy - H / 2) * (1 - v) },
          { scale: s0 + (1 - s0) * v },
        ],
      };
    }
    return {
      opacity: interpolate(v, [0, 0.12], [0, 1], Extrapolation.CLAMP),
      borderRadius: interpolate(v, [0, 1], [24, 0]),
      transform: [{ translateY: H * 0.92 * (1 - v) }],
    };
  });
  const scrim = useAnimatedStyle(() => ({ opacity: 0.6 * p.value }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.scrim, scrim]} pointerEvents="none" />
      <Animated.View style={[styles.sheet, sheet]}>{children(close)}</Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#05040C' },
  sheet: { flex: 1, overflow: 'hidden' },
});

export default ViewerTransition;
