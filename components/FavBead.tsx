/**
 * FavBead.tsx — カードの右下の角に乗るお気に入り（ウィッシュリスト）ボタン
 * ------------------------------------------------------------------
 * 参照: 岡さんの試作 fr_home_fav_orbitstar_v3.html（2026-09-24 採用）の `.bead`
 *       「角に乗る」版。
 *
 *   ・44px の当たり判定の中に、28px の濃紺の丸（縁 1px）と 13px の星
 *   ・未登録は線だけ（#9AA0C8）、登録済みは白で塗る
 *   ・押すと星が 1.3 倍に弾む。登録したときだけ、角の下に「ウィッシュリストに追加」を
 *     1.4 秒出して onAdded を呼ぶ（光の粒をタブへ飛ばすのは親の仕事）
 *
 * 位置（カードの角）と、カードと一緒に動くこと・裏返し中に消えることは親
 * （DiscoverScreen の★の層）が持つ。この部品は見た目と押したときの動きだけ。
 */

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useT } from '../lib/i18n';

/** 当たり判定の一辺。中心をカードの角に合わせるので、親は角から BEAD_HIT/2 引いて置く */
export const BEAD_HIT = 44;
const DISC = 28;
const STAR = 13;
const TOAST_MS = 1400;

const MUTE = '#9AA0C8';
const INK = '#ECEEF7';

type Props = {
  filled: boolean;
  onToggle: () => void;
  /** 登録したときだけ呼ぶ。引数は押した位置（画面座標）＝光の粒の出発点 */
  onAdded?: (from: { x: number; y: number }) => void;
};

const STAR_PATH =
  'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z';

export const FavBead: React.FC<Props> = React.memo(({ filled, onToggle, onAdded }) => {
  const t = useT();
  const pop = useSharedValue(1);
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beadRef = useRef<View>(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const starStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const onPress = (_e: GestureResponderEvent) => {
    const adding = !filled;
    // 試作: transform .25s cubic-bezier(.3,1.6,.5,1) で 1.3 倍 → 戻す
    pop.value = withSequence(
      withTiming(1.3, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 200, easing: Easing.bezier(0.3, 1.6, 0.5, 1) }),
    );
    onToggle();
    if (!adding) return;
    setToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(false), TOAST_MS);
    beadRef.current?.measureInWindow((x, y, w, h) => {
      onAdded?.({ x: x + w / 2, y: y + h / 2 });
    });
  };

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable
        ref={beadRef}
        onPress={onPress}
        style={styles.hit}
        accessibilityRole="button"
        accessibilityState={{ selected: filled }}
        accessibilityLabel={filled ? t('fav.remove') : t('fav.add')}
      >
        {({ pressed }) => (
          <View style={[styles.disc, pressed && { transform: [{ scale: 0.9 }] }]}>
            <Animated.View style={starStyle}>
              <Svg width={STAR} height={STAR} viewBox="0 0 24 24">
                <Path
                  d={STAR_PATH}
                  fill={filled ? INK : 'none'}
                  stroke={filled ? INK : MUTE}
                  strokeWidth={1.3 * (24 / STAR)}
                  strokeLinejoin="round"
                />
              </Svg>
            </Animated.View>
          </View>
        )}
      </Pressable>
      {/* 試作 .toast: カードの右下の角から右端を揃えて、角の 22px 下 */}
      <Text style={[styles.toast, !toast && styles.hidden]} numberOfLines={1} pointerEvents="none">
        {t('fav.added')}
      </Text>
    </View>
  );
});

/**
 * 光の粒（試作の `.flydot`）。★からフッターのプレイリストタブへ 0.75 秒で飛び、
 * 着いたら onDone（親がタブを脈打たせる）。座標は親の View の中の座標。
 */
export const FlyDot: React.FC<{
  from: { x: number; y: number };
  to: { x: number; y: number };
  onDone: () => void;
}> = ({ from, to, onDone }) => {
  const k = useSharedValue(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    // 試作: transform .75s cubic-bezier(.5,0,.6,1), opacity → .2, scale → .6
    k.value = withTiming(1, { duration: 750, easing: Easing.bezier(0.5, 0, 0.6, 1) });
    const t = setTimeout(() => doneRef.current(), 760);
    return () => clearTimeout(t);
  }, [k]);
  const st = useAnimatedStyle(() => ({
    opacity: 1 - 0.8 * k.value,
    transform: [
      { translateX: from.x - 3 + (to.x - from.x) * k.value },
      { translateY: from.y - 3 + (to.y - from.y) * k.value },
      { scale: 1 - 0.4 * k.value },
    ],
  }));
  return <Animated.View pointerEvents="none" style={[styles.dot, st]} />;
};

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: INK,
    shadowColor: INK,
    shadowOpacity: 1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  root: { width: BEAD_HIT, height: BEAD_HIT },
  hit: { width: BEAD_HIT, height: BEAD_HIT, alignItems: 'center', justifyContent: 'center' },
  // 試作 .bead b: 28px・#0f0e2a・縁 1px rgba(236,238,247,.22)・外に暗いにじみ
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: '#0F0E2A',
    borderWidth: 1,
    borderColor: 'rgba(236,238,247,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A0A1E',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  toast: {
    position: 'absolute',
    top: BEAD_HIT,
    right: BEAD_HIT / 2,
    fontSize: 10,
    letterSpacing: 2.2,
    color: '#B4B8D6',
  },
  hidden: { opacity: 0 },
});

export default FavBead;
