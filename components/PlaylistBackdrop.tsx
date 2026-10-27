import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export const PLAYLIST_BACKGROUND = '#080F1F';

/** A quiet, static field: no cloud textures, glow or animation behind the list. */
export const PlaylistBackdrop = React.memo(function PlaylistBackdrop({ width, height }: {
  width: number; height: number;
}) {
  const stars = useMemo(() => {
    let seed = 137;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const count = Math.min(120, Math.max(45, Math.round(width * height / 4800)));
    return Array.from({ length: count }, () => ({
      x: 12 + random() * Math.max(0, width - 24),
      y: 12 + random() * Math.max(0, height - 24),
      radius: .35 + random() * .35,
      opacity: .12 + random() * .12,
    }));
  }, [width, height]);
  return <View pointerEvents="none" accessible={false}
    style={[StyleSheet.absoluteFill, { backgroundColor: PLAYLIST_BACKGROUND }]}>
    <Svg width={width} height={height}>
      {stars.map((star, index) => <Circle key={index} cx={star.x} cy={star.y}
        r={star.radius} opacity={star.opacity} fill="#B5C8E2" />)}
    </Svg>
  </View>;
});
