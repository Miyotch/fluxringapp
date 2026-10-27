import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { Canvas, Circle, Group, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { runOnJS, useAnimatedReaction, useDerivedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useOrbitPreview } from '../lib/homeOrbitPreview';
import { useBackdropClock } from '../lib/usePausableClock';

type Props = {
  width: number; height: number; cardWidth: number; cardHeight: number;
  centerY: number; paused: SharedValue<boolean>;
};

// Several slow, incommensurate oscillations avoid a mechanical repeating pulse.
// This is an organic-motion approximation, not a measured 1/f noise process.
function point(angle: number, time: number, width: number, cardWidth: number, cardHeight: number, centerY: number) {
  'worklet';
  const breathe = Math.sin(time * .29) * 2 + Math.sin(time * .113 + 1.4) * 1.3;
  const rx = Math.min(width * .45, cardWidth * .66) + breathe;
  const ry = cardHeight * .17 + Math.sin(time * .197) * 3;
  const wave = Math.sin(angle * 3 + time * .17) * 2.5 + Math.sin(angle * 2 - time * .127) * 1.8;
  return {
    x: width / 2 + Math.cos(angle) * rx,
    y: centerY + cardHeight * .30 + Math.sin(angle) * ry - Math.cos(angle) * cardHeight * .19 + wave,
  };
}

/** Pointer-free orbit behind the card. No blur buffers or React renders per frame. */
export function HomeOrbit({ width, height, cardWidth, cardHeight, centerY, paused }: Props) {
  const { strength, moving } = useOrbitPreview();
  const [svPaused, setSvPaused] = useState(false);
  useAnimatedReaction(() => paused.value, (value, previous) => {
    if (value !== previous) runOnJS(setSvPaused)(value);
  }, [paused]);
  // Start still until the OS preference is known.
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    let preferenceEvent = false;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted && !preferenceEvent) setReduced(value);
    }).catch(() => {});
    const motionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      preferenceEvent = true;
      setReduced(value);
    });
    return () => { mounted = false; motionSub.remove(); };
  }, []);
  const { clock } = useBackdropClock(!moving || reduced || svPaused);
  const time = useDerivedValue(() => clock.value / 1000);
  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    for (let i = 0; i <= 128; i++) {
      const v = point(i / 128 * Math.PI * 2, time.value, width, cardWidth, cardHeight, centerY);
      if (i === 0) p.moveTo(v.x, v.y); else p.lineTo(v.x, v.y);
    }
    p.close();
    return p;
  });
  const opacity = useDerivedValue(() => strength * (.70 + Math.sin(time.value * .31) * .12 + Math.sin(time.value * .137 + .8) * .08));
  const head = useDerivedValue(() => point(2.05 + time.value * .16, time.value, width, cardWidth, cardHeight, centerY));
  const cx = useDerivedValue(() => head.value.x);
  const cy = useDerivedValue(() => head.value.y);
  return <Canvas pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
    <Group opacity={opacity}>
      <Path path={path} style="stroke" strokeWidth={8} color="#b398ed" opacity={.045} />
      <Path path={path} style="stroke" strokeWidth={3} color="#c4a8f2" opacity={.13} />
      <Path path={path} style="stroke" strokeWidth={.85}>
        <LinearGradient start={vec(width * .1, centerY)} end={vec(width * .9, centerY + cardHeight * .4)}
          colors={['#b69bd49a', '#f4eaff', '#c7b2ed', '#eee6ff']} />
      </Path>
      <Circle cx={cx} cy={cy} r={8} color="#cbb3f7" opacity={.055} />
      <Circle cx={cx} cy={cy} r={3.5} color="#d9c4ff" opacity={.23} />
      <Circle cx={cx} cy={cy} r={1.3} color="#fff5ff" />
    </Group>
  </Canvas>;
}
