/**
 * EqBars.tsx — 再生中/試聴中の EQ バー（component_catalog: audio.on）
 * ディスカバーの試聴・プレイヤーの再生中、どちらからも使う共有部品。
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLOR } from '../constants/design-tokens';

type Props = { active: boolean };

export const EqBars: React.FC<Props> = ({ active }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = active
      ? withRepeat(withSequence(
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 500, easing: Easing.inOut(Easing.sin) }),
        ), -1, false)
      : withTiming(0, { duration: 200 });
  }, [active, p]);

  // フックは常に同数・同順で呼ぶ（条件分岐やループ内で呼ばない）
  const s0 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + p.value * 0.5 }] }));
  const s1 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + p.value * 1.0 }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + p.value * 0.7 }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + p.value * 1.0 }] }));

  if (!active) return null;
  const bars = [s0, s1, s2, s3];
  return (
    <View style={styles.eq}>
      {bars.map((st, i) => (
        <Animated.View key={i} style={[styles.eqBar, { height: 5 + i * 2 }, st]} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  eq: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 },
  eqBar: { width: 2, borderRadius: 1, backgroundColor: COLOR.auraCyan },
});

export default EqBars;
