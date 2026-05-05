import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  RadialGradient,
  Path,
  Skia,
  vec,
  useClock,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, useSharedValue, runOnJS } from 'react-native-reanimated';
import { colors } from '../../theme/colors';

function clamp(v: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(v, min), max);
}

interface FluxRingDialProps {
  size: number;
  amplitude?: number;
  onAmplitudeChange?: (amp: number) => void;
}

/**
 * Animated ring dial built on react-native-skia. Replaces the web Canvas 2D
 * implementation. The user rotates the ring with a one-finger drag; the
 * angular delta translates to a logical "amplitude" in [0.2, 4.0].
 */
export function FluxRingDial({ size, amplitude = 1.0, onAmplitudeChange }: FluxRingDialProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.46;
  const innerR = size * 0.18;
  const bandR = size * 0.36;

  const clock = useClock();
  const ampShared = useSharedValue(amplitude);
  const lastAngle = useSharedValue(0);

  useEffect(() => {
    ampShared.value = amplitude;
  }, [amplitude, ampShared]);

  const reportAmp = (next: number) => {
    onAmplitudeChange?.(next);
  };

  const pan = Gesture.Pan()
    .onBegin((e) => {
      lastAngle.value = Math.atan2(e.y - cy, e.x - cx);
    })
    .onUpdate((e) => {
      const angle = Math.atan2(e.y - cy, e.x - cx);
      let delta = angle - lastAngle.value;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      lastAngle.value = angle;
      const next = clamp(ampShared.value + delta * 1.5, 0.2, 4.0);
      ampShared.value = next;
      runOnJS(reportAmp)(next);
    });

  // Pulsating ring radius
  const pulseR = useDerivedValue(() => {
    const t = clock.value / 1000;
    return bandR + Math.sin(t * 1.2) * 4 + ampShared.value * 1.5;
  });

  // Build the segmented arc path once
  const segmentsPath = (() => {
    const path = Skia.Path.Make();
    const segments = 48;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 0.6) / segments) * Math.PI * 2;
      const r0 = bandR - 16;
      const r1 = bandR + 16;
      path.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0);
      path.lineTo(cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1);
      path.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
      path.lineTo(cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0);
      path.close();
    }
    return path;
  })();

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.root, { width: size, height: size }]}>
        <Canvas style={{ width: size, height: size }}>
          {/* Outer glow */}
          <Circle cx={cx} cy={cy} r={outerR}>
            <RadialGradient
              c={vec(cx, cy)}
              r={outerR}
              colors={[
                'rgba(145,120,189,0.0)',
                'rgba(145,120,189,0.18)',
                'rgba(145,120,189,0.0)',
              ]}
              positions={[0.6, 0.85, 1]}
            />
          </Circle>

          {/* Bezel */}
          <Circle
            cx={cx}
            cy={cy}
            r={outerR - 4}
            color={colors.ringBezel}
            style="stroke"
            strokeWidth={4}
          />

          {/* Animated radial pulse */}
          <Group>
            <Circle cx={cx} cy={cy} r={pulseR} color="rgba(145,120,189,0.18)" style="stroke" strokeWidth={2} />
          </Group>

          {/* Segments */}
          <Path path={segmentsPath} color={colors.primaryLight} />

          {/* Inner orb */}
          <Circle cx={cx} cy={cy} r={innerR}>
            <RadialGradient
              c={vec(cx - innerR * 0.3, cy - innerR * 0.3)}
              r={innerR * 1.4}
              colors={['#ffffff', '#dac8ee', colors.primary]}
              positions={[0, 0.55, 1]}
            />
          </Circle>
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
