/**
 * Design 11: Noise Odyssey — Skia port (declarative-Path edition)
 *
 * Previous iterations of this component tried to drive the ring rendering via
 * an imperative `createPicture` worklet + `<Picture>` element so the legacy
 * Canvas2D draw routine could be ported nearly verbatim. In Skia 2.2.12 that
 * pattern silently fails to render: the Picture composes ok in isolation but
 * the moment we wrap it in a Group with a layer paint (or call `saveLayer`
 * inside the worklet) the inner draws are swallowed and nothing reaches the
 * canvas. The pearl / level text in the sibling Canvas behave the same way
 * when they share a state with a broken layer.
 *
 * This rewrite ditches `<Picture>` entirely and builds the ring geometry as
 * declarative `<Path>` elements with animated `path` SharedValues. This is the
 * idiomatic Skia React pattern and works reliably in 2.2.12.
 *
 *   - Inner ring group:  5 → 17 rings, accumulated into ONE SkPath, drawn as
 *     a single `<Path>` element with a `<BlurMask>` for the soft purple cloud.
 *   - Outer ring group:  6 → 22 rings, accumulated into ONE SkPath, drawn as
 *     a single `<Path>` element with a wider `<BlurMask>` for the diffuse
 *     outer halo.
 *   - Both groups: 72 vertices per ring (matches the legacy crisp segmented
 *     look) connected by straight lineTo segments.
 *   - Single global rotation transform wraps each group; per-ring rotation is
 *     folded into the geometry inside the worklet.
 *   - Particles: 12 → 48 floating motes accumulated into a third SkPath of
 *     circles, drawn with the screen blend mode and no blur.
 *   - Global breathing pulse: `1 + sin(time * 0.8) * 0.015 * level`.
 *
 * We intentionally drop the per-segment brightness banding + triple-stroke
 * (main / highlight / shadow) of the previous attempt — uniform stroke per
 * group keeps the call count to 3 drawPath/frame and gets rings visible. The
 * fancier per-segment modulation can be reintroduced later if we layer
 * additional `<Path>` elements per band; the current pass prioritizes
 * "anything visible" over fidelity.
 *
 * Knob, level number text, and "Flux Ring" sub-label are rendered by the
 * parent `FluxRingDial`, NOT here.
 */
import { useMemo } from 'react';
import {
  BlurMask,
  Canvas,
  Group,
  Path,
  Skia,
} from '@shopify/react-native-skia';
import type {
  DerivedValue,
  SharedValue,
} from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';
import {
  amplitudeToLevel,
  ridgedNoise,
  warpedNoise,
} from './noise';

export type Design11Props = {
  /**
   * 0.2..4.0 — drives noise displacement, ring count, brightness.
   * Accepts a SharedValue or DerivedValue (read-only); this component only
   * reads `.value`.
   */
  amplitude: SharedValue<number> | DerivedValue<number>;
  /** Radians, accumulated user pan; rotates the entire ring assembly. */
  rotation: SharedValue<number> | DerivedValue<number>;
  /** Free-running animation clock in seconds. Drives noise / breathing. */
  clock: SharedValue<number>;
  /** Canvas square size in px. */
  size: number;
};

/** Vertices per ring (matches the legacy spec exactly). */
const SEGMENTS = 72;

/** Hard caps so React-Hook order stays stable across renders. */
const MAX_INNER = 17;
const MAX_OUTER = 22;

export function Design11NoiseOdyssey({
  amplitude,
  rotation,
  clock,
  size,
}: Design11Props) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 10;
  // Matches FluxRingDial inner orb radius (size * 0.18).
  const orbR = size * 0.18;

  // Inner / outer band radii (port of original lines 111-113)
  const innerMaxR = orbR + 16 + (maxR - orbR - 28) * 0.45;
  const outerMinR = innerMaxR + 4;
  const outerMaxR = orbR + 16 + (maxR - orbR - 28) * 0.98;

  const dims = useMemo(
    () => ({ cx, cy, maxR, orbR, innerMaxR, outerMinR, outerMaxR }),
    [cx, cy, maxR, orbR, innerMaxR, outerMinR, outerMaxR],
  );

  // ── Animated SkPath for the inner ring group ────────────────────────────
  // The path holds every active inner ring's closed contour, transformed into
  // canvas-space coordinates. We bake the per-ring rotation into the geometry
  // here (instead of pushing a Group transform per ring) so the whole group
  // can be drawn with a single Path element + one BlurMask.
  const innerRingsPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const amp = amplitude.value;
    const time = clock.value;
    const level = amplitudeToLevel(amp);
    const breath = 1 + Math.sin(time * 0.8) * 0.015 * level;
    const innerCount = Math.min(MAX_INNER, Math.floor(5 + (level - 1) * 3));
    const clampedAmp = Math.min(amp, 2.8);

    for (let i = 0; i < innerCount; i++) {
      const t = innerCount > 1 ? i / (innerCount - 1) : 0;
      const baseR = (dims.orbR + 18 + t * (dims.innerMaxR - dims.orbR - 18)) * breath;

      const rotSpeed = 0.1 + level * level * 0.04;
      const ringRot = time * rotSpeed + i * 0.15;

      const noiseScale = 2.0 + i * 0.25;
      const warpIntensity = 0.8 + level * 0.3;
      const ampResp = (2.5 + clampedAmp * 2.5) * (0.5 + level * 0.08);

      for (let s = 0; s <= SEGMENTS; s++) {
        const angle = (s / SEGMENTS) * Math.PI * 2;
        const nx = Math.cos(angle) * noiseScale;
        const ny = Math.sin(angle) * noiseScale;
        const noiseVal = warpedNoise(nx, ny, time + i * 0.5, warpIntensity);
        const r = baseR + noiseVal * ampResp;

        // Bake per-ring rotation into the angle.
        const a = angle + ringRot;
        const x = dims.cx + r * Math.cos(a);
        const y = dims.cy + r * Math.sin(a);
        if (s === 0) {
          path.moveTo(x, y);
        } else {
          path.lineTo(x, y);
        }
      }
      path.close();
    }
    return path;
  }, [size]);

  // ── Animated SkPath for the outer ring group ────────────────────────────
  const outerRingsPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const amp = amplitude.value;
    const time = clock.value;
    const level = amplitudeToLevel(amp);
    const breath = 1 + Math.sin(time * 0.8) * 0.015 * level;
    const innerCount = Math.floor(5 + (level - 1) * 3);
    const outerCount = Math.min(MAX_OUTER, Math.floor(6 + (level - 1) * 4));
    const clampedAmp = Math.min(amp, 2.8);

    for (let i = 0; i < outerCount; i++) {
      const t = outerCount > 1 ? i / (outerCount - 1) : 0;
      const baseR = (dims.outerMinR + t * (dims.outerMaxR - dims.outerMinR)) * breath;

      const rotSpeed = -(0.06 + level * level * 0.025);
      const ringRot = time * rotSpeed - i * 0.1;

      const ringIdx = i + innerCount;
      const noiseScale = 2.0 + ringIdx * 0.25;
      const warpIntensity = 0.8 + level * 0.3;
      const ampResp = (2.5 + clampedAmp * 2.5) * (0.5 + level * 0.08);

      for (let s = 0; s <= SEGMENTS; s++) {
        const angle = (s / SEGMENTS) * Math.PI * 2;
        const nx = Math.cos(angle) * noiseScale;
        const ny = Math.sin(angle) * noiseScale;
        const warped = warpedNoise(
          nx,
          ny,
          time + ringIdx * 0.3,
          warpIntensity * 0.6,
        );
        const ridged = ridgedNoise(nx * 0.8, ny * 0.8, time + ringIdx * 0.7);
        const noiseVal = warped * 0.6 + ridged * 0.4;
        const r = baseR + noiseVal * ampResp;

        const a = angle + ringRot;
        const x = dims.cx + r * Math.cos(a);
        const y = dims.cy + r * Math.sin(a);
        if (s === 0) {
          path.moveTo(x, y);
        } else {
          path.lineTo(x, y);
        }
      }
      path.close();
    }
    return path;
  }, [size]);

  // ── Animated SkPath holding every floating particle as a tiny circle ────
  const particlesPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const amp = amplitude.value;
    const time = clock.value;
    const level = amplitudeToLevel(amp);
    const particleCount = Math.floor(12 + (level - 1) * 9);
    const span = dims.outerMaxR - dims.orbR - 30;

    for (let i = 0; i < particleCount; i++) {
      const seed = i * 137.5;
      // Deterministic pseudo-random offsets — matches the original `hash`
      // function's behaviour; inlined so the worklet stays small.
      const h0 = Math.sin(seed * 127.1) * 43758.5453;
      const r0 = (h0 - Math.floor(h0));
      const h1 = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      const r1 = (h1 - Math.floor(h1));

      const orbitR = dims.orbR + 22 + r0 * 0.5 * span + span * 0.5;
      const orbitSpeed = 0.08 + r1 * 0.04 + level * 0.02;
      const angle = time * orbitSpeed * (i % 2 === 0 ? 1 : -1) + seed;

      const pulse = 0.5 + 0.5 * Math.sin(time * 1.5 + i * 0.9);
      const flutter = Math.sin(time * 0.3 + i * 0.7) * 8 * (0.5 + level * 0.1);
      const r = orbitR + flutter;
      const x = dims.cx + r * Math.cos(angle);
      const y = dims.cy + r * Math.sin(angle);
      const sizePx = 1.5 + pulse * 1.5 + level * 0.15;
      path.addCircle(x, y, sizePx);
    }
    return path;
  }, [size]);

  // ── Background glow path (a full-canvas rect) ───────────────────────────
  const backgroundPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.addRect({ x: 0, y: 0, width: size, height: size });
    return p;
  }, [size]);

  // ── Global rotation transform applied to both ring groups ───────────────
  // We rotate around the canvas center by translating in, rotating, and
  // translating back.
  const ringTransform = useDerivedValue(() => {
    return [
      { translateX: dims.cx },
      { translateY: dims.cy },
      { rotate: rotation.value },
      { translateX: -dims.cx },
      { translateY: -dims.cy },
    ];
  });

  return (
    <Canvas style={{ width: size, height: size, backgroundColor: 'transparent' }}>
      {/* Background vertical purple wash — bottom layer. */}
      <Path
        path={backgroundPath}
        color="rgba(145, 120, 189, 0.08)"
        blendMode="screen"
      />

      {/* Inner ring group (clockwise warped noise).
          Two stacked stroked Paths simulate the legacy web bloom:
            • Wide, softer halo layer — gives the diffuse purple cloud.
            • Tight, brighter core layer — keeps the ring shape readable.
          Both reference the same animated SkPath so they stay in lockstep. */}
      <Group transform={ringTransform}>
        {/* Wide halo */}
        <Path
          path={innerRingsPath}
          style="stroke"
          strokeWidth={2.0}
          color="rgba(170, 130, 235, 0.55)"
          blendMode="screen"
        >
          <BlurMask blur={4} style="normal" />
        </Path>
        {/* Tight bright core */}
        <Path
          path={innerRingsPath}
          style="stroke"
          strokeWidth={1.0}
          color="rgba(180, 140, 240, 0.7)"
          blendMode="screen"
        >
          <BlurMask blur={2} style="normal" />
        </Path>
      </Group>

      {/* Outer ring group (counter-clockwise, ridged + warped). Wider blur
          for the diffuse outer halo. */}
      <Group transform={ringTransform}>
        <Path
          path={outerRingsPath}
          style="stroke"
          strokeWidth={1.6}
          color="rgba(155, 180, 235, 0.40)"
          blendMode="screen"
        >
          <BlurMask blur={6} style="normal" />
        </Path>
      </Group>

      {/* Floating particles — crisp, no blur, screen-blended. */}
      <Path
        path={particlesPath}
        color="rgba(220, 200, 255, 0.7)"
        blendMode="screen"
      />
    </Canvas>
  );
}
