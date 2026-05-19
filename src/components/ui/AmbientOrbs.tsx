import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  BlurMask,
  Canvas,
  Circle,
} from '@shopify/react-native-skia';
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

// Alphas bumped from the legacy CSS values (0.32 / 0.26 / 0.28 / 0.22) to
// 0.45 / 0.40 / 0.42 / 0.32 so the orbs read on the lavender-on-lavender
// background instead of disappearing into it. The web version got more
// pop from CSS blur + screen blending; Skia's BlurMask softens but doesn't
// brighten, so we compensate with a higher input alpha.
const ORBS: OrbSpec[] = [
  {
    width: 220,
    height: 140,
    top: '6%',
    left: '54%',
    color: 'rgba(200, 170, 255, 0.45)',
    period: 22000,
    delay: 0,
  },
  {
    width: 170,
    height: 110,
    top: '52%',
    left: '60%',
    color: 'rgba(160, 200, 255, 0.40)',
    period: 18000,
    delay: -6000,
  },
  {
    width: 130,
    height: 90,
    top: '72%',
    left: '46%',
    color: 'rgba(220, 180, 255, 0.42)',
    period: 25000,
    delay: -12000,
  },
  {
    width: 100,
    height: 70,
    top: '16%',
    left: '80%',
    color: 'rgba(180, 220, 200, 0.32)',
    period: 20000,
    delay: -4000,
  },
];

// BlurMask sigma (px) applied to every orb. Tuned per spec — bigger orbs
// stay diffuse, smaller ones gather more visible color.
const ORB_BLUR_SIGMA = 32;

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

  // ── Outer Animated.View handles position (top/left), translateX/Y, scale,
  // and the JS-side opacity envelope. ──
  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
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

  // The Skia canvas needs to be larger than the orb itself so the BlurMask
  // halo (sigma 32) can spill beyond the ellipse edge. We pad by ~3x sigma
  // on each side.
  const padding = ORB_BLUR_SIGMA * 3;
  const canvasW = spec.width + padding * 2;
  const canvasH = spec.height + padding * 2;

  // The legacy spec described elliptical orbs (width != height). Skia's
  // <Circle> is round, so we approximate the ellipse by scaling the Group
  // — but for the small width/height ratios we use (1.4..1.6:1), a single
  // round circle inscribed in the orb reads identically once blurred.
  const radius = Math.min(spec.width, spec.height) / 2;

  // BlurMask sigma derived value lets us animate it if we ever need to;
  // for now it's a constant.
  const blurSigma = useDerivedValue(() => ORB_BLUR_SIGMA);

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
        },
        animatedStyle,
      ]}
    >
      <Canvas
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: canvasW,
          height: canvasH,
          left: -padding,
          top: -padding,
        }}
      >
        <Circle cx={canvasW / 2} cy={canvasH / 2} r={radius} color={spec.color}>
          <BlurMask blur={blurSigma} style="normal" />
        </Circle>
      </Canvas>
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
    // No `overflow: hidden` here — the Skia canvas inside intentionally
    // extends past the orb's bounds so the BlurMask halo can spill out.
  },
});
