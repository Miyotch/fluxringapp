import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Ambient ornamental background for the Home screen:
 *   • 4 soft blurred lavender / mint "orbs" that drift + scale + fade
 *   • 2 staggered diagonal aurora bands sweeping across the screen
 *
 * Rendered absolutely between the GradientBackground and the foreground
 * content. `pointerEvents="none"` so it never intercepts gestures.
 *
 * Port of the original web `.aurora-orb` / `.aurora-band` from
 * `src/index.css` lines 195-256.
 */

type OrbSpec = {
  width: number;
  height: number;
  /** Percent strings like '6%' — anchor relative to parent. */
  top: string;
  left: string;
  /** Lavender / pastel tint. */
  color: string;
  /** Drift period in ms. */
  period: number;
  /** Negative values stagger the start (matches CSS animation-delay). */
  delay: number;
};

const ORBS: OrbSpec[] = [
  {
    width: 220,
    height: 140,
    top: '6%',
    left: '54%',
    color: 'rgba(200, 170, 255, 0.32)',
    period: 22000,
    delay: 0,
  },
  {
    width: 170,
    height: 110,
    top: '52%',
    left: '60%',
    color: 'rgba(160, 200, 255, 0.26)',
    period: 18000,
    delay: -6000,
  },
  {
    width: 130,
    height: 90,
    top: '72%',
    left: '46%',
    color: 'rgba(220, 180, 255, 0.28)',
    period: 25000,
    delay: -12000,
  },
  {
    width: 100,
    height: 70,
    top: '16%',
    left: '80%',
    color: 'rgba(180, 220, 200, 0.22)',
    period: 20000,
    delay: -4000,
  },
];

/** Aurora band gradient stops — primary (lavender-warm). */
const BAND_A_COLORS = [
  'rgba(255,255,255,0)',
  'rgba(255,255,255,0)',
  'rgba(220,210,255,0)',
  'rgba(230,218,255,0.28)',
  'rgba(210,190,255,0.34)',
  'rgba(245,235,255,0.22)',
  'rgba(220,210,255,0)',
  'rgba(255,255,255,0)',
] as const;
const BAND_A_LOCATIONS = [0, 0.28, 0.3, 0.34, 0.38, 0.42, 0.46, 1] as const;

/** Aurora band gradient stops — secondary (cooler hue). */
const BAND_B_COLORS = [
  'rgba(255,255,255,0)',
  'rgba(255,255,255,0)',
  'rgba(200,195,255,0)',
  'rgba(215,205,255,0.22)',
  'rgba(195,178,255,0.3)',
  'rgba(230,222,255,0.18)',
  'rgba(200,195,255,0)',
  'rgba(255,255,255,0)',
] as const;
const BAND_B_LOCATIONS = [0, 0.28, 0.3, 0.34, 0.38, 0.42, 0.46, 1] as const;

const SWEEP_PERIOD = 18000;

function AmbientOrb({ spec }: { spec: OrbSpec }) {
  // Each orb drifts: translate (0,0)->(30,-20), scale 1->1.15, opacity yoyo.
  const progress = useSharedValue(0);

  useEffect(() => {
    const startDelay = spec.delay < 0 ? 0 : spec.delay;
    // Reanimated doesn't expose negative animation-delay directly; emulate it
    // by initializing `progress` partway through its cycle.
    if (spec.delay < 0) {
      const phase = ((-spec.delay) % spec.period) / spec.period;
      progress.value = phase;
    }
    progress.value = withDelay(
      startDelay,
      withRepeat(
        withTiming(1, { duration: spec.period, easing: Easing.inOut(Easing.ease) }),
        -1,
        true, // yoyo / alternate
      ),
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [progress, spec.delay, spec.period]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    // Opacity envelope: 0% -> 0, 15% -> 1, 85% -> 1, 100% -> 0.4
    let opacity: number;
    if (p < 0.15) opacity = p / 0.15;
    else if (p < 0.85) opacity = 1;
    else opacity = 1 - ((p - 0.85) / 0.15) * 0.6;
    return {
      opacity,
      transform: [
        { translateX: p * 30 },
        { translateY: p * -20 },
        { scale: 1 + p * 0.15 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        {
          width: spec.width,
          height: spec.height,
          top: spec.top as unknown as number,
          left: spec.left as unknown as number,
          backgroundColor: spec.color,
          borderRadius: Math.max(spec.width, spec.height),
        },
        animatedStyle,
      ]}
    >
      {/* BlurView softens the orb edge — sits inside so the tint shows through. */}
      <BlurView
        intensity={40}
        tint="light"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

function AuroraBand({
  delayMs,
  colors,
  locations,
  width,
}: {
  delayMs: number;
  colors: readonly string[];
  locations: readonly number[];
  width: number;
}) {
  // The CSS keyframe runs translateX(-55%) -> (+55%) linearly over 18s.
  // We compute pixel offsets from the parent width.
  const startPx = -0.55 * width;
  const endPx = 0.55 * width;

  const offset = useSharedValue(startPx);

  useEffect(() => {
    // Emulate negative animation-delay by starting partway into the loop.
    const phase = delayMs < 0 ? ((-delayMs) % SWEEP_PERIOD) / SWEEP_PERIOD : 0;
    offset.value = startPx + phase * (endPx - startPx);

    offset.value = withRepeat(
      withTiming(endPx, {
        duration: SWEEP_PERIOD,
        easing: Easing.linear,
      }),
      -1,
      false, // non-yoyo: jumps back to start (matches CSS linear infinite)
    );

    return () => {
      cancelAnimation(offset);
    };
  }, [offset, delayMs, startPx, endPx]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }, { translateY: -10 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.bandWrap, animatedStyle]}>
      <LinearGradient
        // 105deg in CSS roughly = top-left -> bottom-right with a 15° tilt.
        // Approximate via start/end vectors. (105° measured from +X axis CCW.)
        start={{ x: 0.0, y: 0.35 }}
        end={{ x: 1.0, y: 0.65 }}
        colors={colors as unknown as [string, string, ...string[]]}
        locations={locations as unknown as [number, number, ...number[]]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

export function AmbientOrbs() {
  const { width } = useWindowDimensions();

  return (
    <View pointerEvents="none" style={styles.root}>
      {/* Aurora sweep bands — slide diagonally; the second is offset -9s. */}
      <View pointerEvents="none" style={styles.sweep}>
        <AuroraBand
          delayMs={0}
          colors={BAND_A_COLORS}
          locations={BAND_A_LOCATIONS}
          width={width}
        />
        <AuroraBand
          delayMs={-SWEEP_PERIOD / 2}
          colors={BAND_B_COLORS}
          locations={BAND_B_LOCATIONS}
          width={width}
        />
      </View>

      {/* Soft drifting color orbs. */}
      {ORBS.map((spec, i) => (
        <AmbientOrb key={i} spec={spec} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  // The CSS sweep had `inset: -60% -20%` so the bands extend past the edges
  // and can slide fully off-screen. We do the same with negative insets.
  sweep: {
    position: 'absolute',
    top: '-60%',
    bottom: '-60%',
    left: '-20%',
    right: '-20%',
  },
  bandWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  orb: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
