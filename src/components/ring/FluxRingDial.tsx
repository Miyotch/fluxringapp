import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  RadialGradient,
  Text as SkiaText,
  matchFont,
  vec,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { Design11NoiseOdyssey } from '../../designs/Design11_NoiseOdyssey';
import { amplitudeToLevel } from '../../designs/levelMath';
import { colors } from '../../theme/colors';

interface FluxRingDialProps {
  size: number;
  /** Optional controlled amplitude (0.2..4.0). */
  amplitude?: number;
  /** Called whenever the user spins the dial; receives the new amplitude. */
  onAmplitudeChange?: (amp: number) => void;
}

function clampWorklet(v: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(v, min), max);
}

/**
 * Animated ring dial. Combines the Design11 Noise Odyssey ring layers (Skia
 * Picture) with a static neumorphic knob + level indicator + "Flux Ring"
 * sub-label rendered on top. Touch/drag rotates the dial and adjusts amplitude.
 */
export function FluxRingDial({
  size,
  amplitude: externalAmplitude,
  onAmplitudeChange,
}: FluxRingDialProps) {
  const cx = size / 2;
  const cy = size / 2;
  const orbR = size * 0.18;

  // Shared values: amplitude in [0.2, 4.0], rotation in radians (accumulated).
  const amp = useSharedValue(externalAmplitude ?? 1.0);
  const rotation = useSharedValue(0);
  const lastAngle = useSharedValue(0);

  // Sync external amplitude prop into the shared value when it changes.
  useEffect(() => {
    if (typeof externalAmplitude === 'number') {
      amp.value = externalAmplitude;
    }
  }, [externalAmplitude, amp]);

  // Bridge amplitude back to the JS thread via the optional callback.
  useAnimatedReaction(
    () => amp.value,
    (next, prev) => {
      if (prev !== null && Math.abs(next - (prev ?? 0)) > 0.001 && onAmplitudeChange) {
        runOnJS(onAmplitudeChange)(next);
      }
    },
    [onAmplitudeChange],
  );

  // ── Gesture: circular drag rotates the ring + adjusts amplitude ──
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
      rotation.value = rotation.value + delta;
      amp.value = clampWorklet(amp.value + delta * 1.5, 0.2, 4.0);
    });

  // ── Knob indicator dot position (rotates with amplitude, not user rotation) ──
  const dotCenterR = orbR * 0.74;
  const dotR = orbR * 0.11;

  const dotX = useDerivedValue(() => {
    const tNorm = clampWorklet((amp.value - 0.2) / 3.8, 0, 1);
    const indicatorAngle = -Math.PI / 2 + tNorm * Math.PI * 2;
    return cx + Math.cos(indicatorAngle) * dotCenterR;
  });

  const dotY = useDerivedValue(() => {
    const tNorm = clampWorklet((amp.value - 0.2) / 3.8, 0, 1);
    const indicatorAngle = -Math.PI / 2 + tNorm * Math.PI * 2;
    return cy + Math.sin(indicatorAngle) * dotCenterR;
  });

  const dotCenter = useDerivedValue(() => vec(dotX.value, dotY.value));

  // ── Level number text + font ──
  const levelFontSize = orbR * 0.55 + 5;
  const subFontSize = orbR * 0.18;

  const levelFont = useMemo(
    () => matchFont({ fontFamily: 'System', fontSize: levelFontSize, fontWeight: '200' }),
    [levelFontSize],
  );
  const subFont = useMemo(
    () => matchFont({ fontFamily: 'System', fontSize: subFontSize, fontWeight: '300' }),
    [subFontSize],
  );

  const levelText = useDerivedValue(() => {
    const level = amplitudeToLevel(amp.value);
    return level < 10 ? `0${level}` : `${level}`;
  });

  const subText = 'Flux Ring';

  // Approximate text-centering: character widths come from font metrics on
  // native, but for our needs an empirical advance ratio is sufficient. The
  // legacy web design used `textAlign: 'center'`; we replicate that by
  // shifting -width/2.
  const levelX = useDerivedValue(() => cx - levelText.value.length * levelFontSize * 0.32);
  const subX = cx - subText.length * subFontSize * 0.27;

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.root, { width: size, height: size }]}>
        {/* Ring + particles + howahowa overlay (Design11 imperative picture) */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Design11NoiseOdyssey amplitude={amp} rotation={rotation} size={size} />
        </View>

        {/* Knob + level text overlay (static, not affected by user rotation) */}
        <Canvas style={[StyleSheet.absoluteFill, { width: size, height: size }]}>
          {/* ── Knob body: drop shadow, dome highlight, rim ── */}
          {/* Drop shadow (a slightly larger dimmer disc offset down-right) */}
          <Group opacity={0.28}>
            <Circle
              cx={cx + orbR * 0.05}
              cy={cy + orbR * 0.08}
              r={orbR}
              color={colors.knobShadow}
            />
          </Group>

          {/* Base body fill */}
          <Circle cx={cx} cy={cy} r={orbR} color={colors.knobBody} />

          {/* Neumorphic dome highlight (top-left light source) */}
          <Circle cx={cx} cy={cy} r={orbR}>
            <RadialGradient
              c={vec(cx - orbR * 0.25, cy - orbR * 0.3)}
              r={orbR}
              colors={[
                'rgba(255, 255, 255, 0.95)',
                'rgba(245, 242, 252, 0.85)',
                'rgba(228, 222, 245, 0.75)',
                'rgba(212, 205, 232, 0.55)',
              ]}
              positions={[0, 0.45, 0.85, 1]}
            />
          </Circle>

          {/* Rim highlight */}
          <Circle
            cx={cx}
            cy={cy}
            r={orbR - 1}
            color="rgba(255, 255, 255, 0.55)"
            style="stroke"
            strokeWidth={1.2}
          />

          {/* ── Rotation indicator dot (neumorphic raised bump) ── */}
          {/* Outer halo */}
          <Group opacity={0.35}>
            <Circle cx={dotX} cy={dotY} r={dotR * 1.4} color={colors.knobShadow} />
          </Group>

          {/* Bump body */}
          <Circle cx={dotX} cy={dotY} r={dotR} color={colors.knobIndicator} />

          {/* Bump glossy gradient */}
          <Circle cx={dotX} cy={dotY} r={dotR}>
            <RadialGradient
              c={dotCenter}
              r={dotR}
              colors={[
                'rgba(255, 252, 255, 0.95)',
                'rgba(225, 215, 240, 0.85)',
                'rgba(180, 165, 205, 0.75)',
                'rgba(160, 145, 190, 0.55)',
              ]}
              positions={[0, 0.45, 0.85, 1]}
            />
          </Circle>

          {/* Bump rim */}
          <Circle
            cx={dotX}
            cy={dotY}
            r={dotR - 0.5}
            color="rgba(255, 255, 255, 0.4)"
            style="stroke"
            strokeWidth={0.8}
          />

          {/* ── Level number "0X" centered in the knob ── */}
          <SkiaText
            x={levelX}
            y={cy + orbR * 0.05}
            text={levelText}
            font={levelFont}
            color={colors.knobLabel}
          />

          {/* Sub-label "Flux Ring" below the number */}
          <SkiaText
            x={subX}
            y={cy + orbR * 0.55}
            text={subText}
            font={subFont}
            color={colors.knobSubLabel}
          />
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
