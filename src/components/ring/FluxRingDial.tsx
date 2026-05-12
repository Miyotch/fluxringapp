import { useMemo } from 'react';
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
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { Design11NoiseOdyssey } from '../../designs/Design11_NoiseOdyssey';
import { colors } from '../../theme/colors';

interface FluxRingDialProps {
  size: number;
  /**
   * Optional advisory amplitude. Rotation is now the source of truth; this
   * prop is retained for backwards-compatibility but is NOT synced into the
   * dial after mount. Listeners should subscribe via `onAmplitudeChange`.
   */
  amplitude?: number;
  /** Called whenever the user spins the dial; receives the new amplitude. */
  onAmplitudeChange?: (amp: number) => void;
}

function clampWorklet(v: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(v, min), max);
}

// Rotation bounds: 0..5 full turns (0..10π radians).
const MAX_ROTATION = 10 * Math.PI;
// Amplitude band the noise odyssey rings render across.
const MIN_AMP = 0.2;
const MAX_AMP = 4.0;

/**
 * Animated ring dial. Combines the Design11 Noise Odyssey aurora ribbons (Skia
 * Picture) with a static pearl knob + level indicator + "Flux Ring" sub-label
 * rendered on top. Touch/drag rotates the dial and adjusts amplitude.
 */
export function FluxRingDial({
  size,
  onAmplitudeChange,
}: FluxRingDialProps) {
  const cx = size / 2;
  const cy = size / 2;
  const orbR = size * 0.18;

  // Rotation is the source of truth (radians, accumulated, clamped 0..10π).
  // Amplitude is derived from rotation below.
  const rotation = useSharedValue(0);
  const lastAngle = useSharedValue(0);

  // Amplitude derived from rotation: 0..10π -> 0.2..4.0 (continuous).
  const amp = useDerivedValue(() => {
    const t = rotation.value / MAX_ROTATION;
    return MIN_AMP + t * (MAX_AMP - MIN_AMP);
  });

  // ── Free-running 60fps animation clock (seconds since mount) ──
  // Drives the noise / breathing pulse / per-ring rotation inside Design11
  // so the dial keeps animating even when the user isn't touching it.
  const clock = useSharedValue(0);
  useFrameCallback((info) => {
    'worklet';
    clock.value += (info.timeSincePreviousFrame ?? 16) / 1000;
  }, true);

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

  // ── Gesture: circular drag rotates the ring (clamped 0..10π) ──
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
      rotation.value = clampWorklet(rotation.value + delta, 0, MAX_ROTATION);
    });

  // ── Pearl-knob indicator dot ──
  // Per spec: tiny dot just outside the sphere edge at angle `rotation - π/2`
  // (3 o'clock when rotation = π/2 — matches the screenshot), color primary
  // accent, radius 4px. Rotates with the user spin so the user can see how far
  // they've turned the dial.
  const indicatorRadius = 4;
  const indicatorOrbit = orbR + 8; // just outside the sphere rim

  const dotX = useDerivedValue(() => {
    const a = rotation.value - Math.PI / 2;
    return cx + Math.cos(a) * indicatorOrbit;
  });
  const dotY = useDerivedValue(() => {
    const a = rotation.value - Math.PI / 2;
    return cy + Math.sin(a) * indicatorOrbit;
  });

  // ── Level number text + font ──
  const levelFontSize = Math.round(orbR * 0.95); // big "02" — ~64px on a 350px orb
  const subFontSize = Math.round(orbR * 0.18);

  const levelFont = useMemo(
    () => matchFont({ fontFamily: 'System', fontSize: levelFontSize, fontWeight: '200' }),
    [levelFontSize],
  );
  const subFont = useMemo(
    () => matchFont({ fontFamily: 'System', fontSize: subFontSize, fontWeight: '300' }),
    [subFontSize],
  );

  const levelText = useDerivedValue(() => {
    // Level is purely a function of rotation: each full turn (2π) advances
    // by 1, clamped to 1..5. At exactly 2π we tick from "01" -> "02".
    const level = Math.min(
      5,
      Math.max(1, Math.floor(rotation.value / (2 * Math.PI)) + 1),
    );
    return level < 10 ? `0${level}` : `${level}`;
  });

  const subText = 'Flux Ring';

  // Approximate text-centering using empirical advance ratios for the system
  // font. matchFont gives metrics on native but reading them from a derived
  // value is awkward; these factors land within a pixel of true center.
  const levelX = useDerivedValue(() => cx - levelText.value.length * levelFontSize * 0.3);
  const subX = cx - subText.length * subFontSize * 0.27;

  // Pearl gradient center — slight offset so the highlight reads as a soft
  // top-left light source (kept consistent with the original neumorphism).
  const pearlCenter = vec(cx - orbR * 0.18, cy - orbR * 0.22);

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.root, { width: size, height: size }]}>
        {/* Concentric noise rings + particles + howahowa overlay (Design11) */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Design11NoiseOdyssey
            amplitude={amp}
            rotation={rotation}
            clock={clock}
            size={size}
          />
        </View>

        {/* Pearl knob + level text overlay */}
        <Canvas style={[StyleSheet.absoluteFill, { width: size, height: size }]}>
          {/* Drop shadow under the sphere */}
          <Group opacity={0.22}>
            <Circle
              cx={cx + orbR * 0.04}
              cy={cy + orbR * 0.07}
              r={orbR}
              color={colors.knobShadow}
            />
          </Group>

          {/* Pearl body: pure white center fading to a cool grey rim. This is
              the key change from the previous neumorphic look — pearlier,
              calmer, more like a smooth marble. */}
          <Circle cx={cx} cy={cy} r={orbR} color="#ffffff" />
          <Circle cx={cx} cy={cy} r={orbR}>
            <RadialGradient
              c={pearlCenter}
              r={orbR * 1.08}
              colors={[
                '#ffffff',
                '#f6f5fb',
                '#e6e4ee',
                '#dcdce8',
              ]}
              positions={[0, 0.5, 0.85, 1]}
            />
          </Circle>

          {/* Subtle outer rim hairline — gives the bezel-on-pearl edge */}
          <Circle
            cx={cx}
            cy={cy}
            r={orbR - 0.5}
            color="rgba(220, 220, 232, 0.9)"
            style="stroke"
            strokeWidth={0.8}
          />

          {/* ── Level number "0X" centered in the knob ── */}
          <SkiaText
            x={levelX}
            y={cy + orbR * 0.12}
            text={levelText}
            font={levelFont}
            color={colors.textPrimary}
          />

          {/* Sub-label "Flux Ring" below the number */}
          <SkiaText
            x={subX}
            y={cy + orbR * 0.55}
            text={subText}
            font={subFont}
            color={colors.textSecondary}
          />

          {/* ── Indicator dot on the sphere rim ── */}
          <Circle
            cx={dotX}
            cy={dotY}
            r={indicatorRadius}
            color={colors.primary}
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
