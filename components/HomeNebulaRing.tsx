import React, { useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import type { SharedValue } from 'react-native-reanimated';
import { useOrbitPreview } from '../lib/homeOrbitPreview';
import { useHomeAmbientMotion, useNativeAmbientCycle } from '../lib/useHomeAmbientMotion';

/** Open, tapered arcs. Paths are static; only their cached native layers drift. */
export const HomeNebulaRing = React.memo(function HomeNebulaRing({ width, height, cardWidth, cardHeight, centerY, paused }: {
  width: number; height: number; cardWidth: number; cardHeight: number; centerY: number; paused: SharedValue<boolean>;
}) {
  const { strength, moving } = useOrbitPreview();
  const { running, reduced } = useHomeAmbientMotion(moving, paused);
  const drift = useNativeAmbientCycle(23000, running);
  const breath = useNativeAmbientCycle(31000, running);
  const arcs = useMemo(() => {
    const cx = width / 2, rx = Math.min(width * .44, cardWidth * .65);
    const cy = centerY + cardHeight * .28;
    const lower = `M ${cx - rx * .40} ${cy - cardHeight * .09} C ${cx - rx * 1.14} ${cy + cardHeight * .10}, ${cx - rx * 1.17} ${cy + cardHeight * .29}, ${cx - rx * .48} ${cy + cardHeight * .28} C ${cx + rx * .02} ${cy + cardHeight * .27}, ${cx + rx * .64} ${cy + cardHeight * .08}, ${cx + rx * .94} ${cy - cardHeight * .10}`;
    const upper = `M ${cx - rx * .80} ${cy + cardHeight * .15} C ${cx + rx * .02} ${cy - cardHeight * .14}, ${cx + rx * 1.14} ${cy - cardHeight * .34}, ${cx + rx * .99} ${cy - cardHeight * .10} C ${cx + rx * .97} ${cy - cardHeight * .04}, ${cx + rx * .78} ${cy + cardHeight * .04}, ${cx + rx * .61} ${cy + cardHeight * .09}`;
    return [lower, upper].map((d, index) => <Svg key={index} width={width} height={height}>
      <Defs><LinearGradient id={`arc${index}`} x1="0%" y1="80%" x2="100%" y2="20%">
        <Stop offset="0" stopColor="#a8b9ed" stopOpacity="0" />
        <Stop offset={0.22} stopColor="#bdc9f6" stopOpacity={0.45} />
        <Stop offset={0.48} stopColor="#eee5ff" stopOpacity={0.85} />
        <Stop offset={0.72} stopColor="#b3bce8" stopOpacity={0.35} />
        <Stop offset="1" stopColor="#a8b9ed" stopOpacity="0" />
      </LinearGradient></Defs>
      <Path d={d} fill="none" stroke={`url(#arc${index})`} strokeWidth={5} opacity={.07} />
      <Path d={d} fill="none" stroke={`url(#arc${index})`} strokeWidth={1.8} opacity={.14} />
      <Path d={d} fill="none" stroke={`url(#arc${index})`} strokeWidth={index === 0 ? .65 : .45} />
    </Svg>);
  }, [width, height, cardWidth, cardHeight, centerY]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {arcs.map((arc, index) => <Animated.View key={index} renderToHardwareTextureAndroid shouldRasterizeIOS
      style={[StyleSheet.absoluteFill, {
        opacity: reduced ? strength * .6 : breath.interpolate({ inputRange: [0, 1], outputRange: [strength * .42, strength * .72] }),
        transform: [{ translateX: reduced ? 0 : drift.interpolate({ inputRange: [0, 1], outputRange: index === 0 ? [-2, 2] : [2, -2] }) },
          { translateY: reduced ? 0 : drift.interpolate({ inputRange: [0, 1], outputRange: index === 0 ? [1.5, -1.5] : [-1.5, 1.5] }) }],
      }]}>{arc}</Animated.View>)}
  </View>;
});
