/**
 * Design 11: Noise Odyssey — Skia port (iridescent ribbons edition)
 *
 * Renders the Flux Ring's signature moving cloud: a cluster of thin
 * iridescent "ribbon" loops orbiting the pearl, wrapped by a soft luminous
 * halo donut. Ported from the legacy web Canvas2D design but rebuilt around
 * the declarative Skia API (animated `<Path>` + `<BlurMask>` + screen-blended
 * `<Group>`), which is the only reliably-rendering pattern in Skia 2.2.12 on
 * iPad (imperative `<Picture>` / `saveLayer` silently drop content).
 *
 *   - Outer halo: 3 concentric blurred circle strokes (white → lavender).
 *   - Ribbons:    up to 22 closed 96-vertex loops, split into 6 hue bands so
 *                 each band strokes in its own colour; screen-blended so
 *                 overlaps brighten to white → iridescent rainbow.
 *   - Per-ribbon noise: 3 layered sines (domain-warp) drive the flowing wave.
 *   - Inner ribbons rotate CW, outer CCW; right-side amplitude bias.
 *   - Breathing pulse: 1 + sin(time * 0.8) * 0.015 * level.
 *
 * Knob, level number text, and "Flux Ring" sub-label are rendered by the
 * parent `FluxRingDial`, NOT here.
 */
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
  type SkPath,
} from '@shopify/react-native-skia';
import type {
  DerivedValue,
  SharedValue,
} from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';
import { useMemo } from 'react';
import { amplitudeToLevel } from './noise';

export type Design11Props = {
  /**
   * 0.2..4.0 — drives noise displacement, ribbon count, brightness.
   * Accepts a SharedValue or DerivedValue (read-only); this component only
   * reads `.value`.
   */
  amplitude: SharedValue<number> | DerivedValue<number>;
  /** Radians, accumulated user pan; rotates the entire ribbon assembly. */
  rotation: SharedValue<number> | DerivedValue<number>;
  /** Free-running animation clock in seconds. Drives noise / breathing. */
  clock: SharedValue<number>;
  /** Canvas square size in px. */
  size: number;
};

/** Vertices per ribbon loop. */
const SEGMENTS = 96;
/** Hard cap on ribbon count so buffers stay bounded. */
const MAX_RIBBONS = 22;
/** Number of hue bands the ribbon cluster is split into. */
const BAND_COUNT = 6;
/** Hue (deg) per band: sweep 150° → 320° (green→cyan→blue→violet→magenta). */
const BAND_HUES = [150, 184, 218, 252, 286, 320];

/**
 * Convert HSL(A) to an `rgba()` string inside a worklet. Skia's color parser
 * is unreliable with `hsla()` literals built at runtime, so we expand to rgba
 * ourselves. `h` in [0,360), s/l/a in [0,1].
 */
function hslToRgba(h: number, s: number, l: number, a: number): string {
  'worklet';
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) {
    r = c; g = x; b = 0;
  } else if (hp < 2) {
    r = x; g = c; b = 0;
  } else if (hp < 3) {
    r = 0; g = c; b = x;
  } else if (hp < 4) {
    r = 0; g = x; b = c;
  } else if (hp < 5) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  const m = l - c / 2;
  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  return `rgba(${R}, ${G}, ${B}, ${a})`;
}

/**
 * Build one hue band's ribbon contours into a fresh SkPath. A "band" is the
 * subset of ribbons whose index ≡ bandIndex (mod bandCount). Splitting the
 * cluster into bands lets each band be stroked in its own hue for the
 * iridescent look. Pure worklet — calls NO hooks — so it's safe to invoke from
 * inside the per-band `useDerivedValue` worklets (keeps them plain top-level
 * hooks, no rules-of-hooks violations).
 */
function buildRibbonBand(
  bandIndex: number,
  bandCount: number,
  amp: number,
  time: number,
  level: number,
  rotationVal: number,
  cx: number,
  cy: number,
  ribbonMinR: number,
  ribbonMaxR: number,
): SkPath {
  'worklet';
  const path = Skia.Path.Make();
  const breath = 1 + Math.sin(time * 0.8) * 0.015 * level;
  const ribbonCount = Math.min(MAX_RIBBONS, Math.floor(8 + (level - 1) * 4));
  const clampedAmp = Math.min(amp, 3.0);

  for (let i = bandIndex; i < ribbonCount; i += bandCount) {
    const t = ribbonCount > 1 ? i / (ribbonCount - 1) : 0;
    const baseR = (ribbonMinR + t * (ribbonMaxR - ribbonMinR)) * breath;
    // Inner ribbons CW, outer CCW.
    const dir = t < 0.5 ? 1 : -1;
    const rotSpeed = (0.08 + level * 0.03) * dir;
    const ringRot = time * rotSpeed + i * 0.15 + rotationVal * dir;

    for (let s = 0; s <= SEGMENTS; s++) {
      const ang = (s / SEGMENTS) * Math.PI * 2;
      // 3 layered sines = domain-warped flowing wave.
      const w =
        Math.sin(ang * 3 + time * 1.1 + i) * 0.5 +
        Math.sin(ang * 5 - time * 0.7 + i * 1.3) * 0.3 +
        Math.sin(ang * 8 + time * 0.4 + i * 0.7) * 0.2;
      // Right-side amplitude bias (×1.4 near 3 o'clock = ang 0).
      const sideBias = 1 + 0.4 * Math.cos(ang);
      const rr =
        baseR + w * (6 + clampedAmp * 6) * sideBias * (0.5 + level * 0.08);
      const a = ang + ringRot;
      const x = cx + rr * Math.cos(a);
      const y = cy + rr * Math.sin(a);
      if (s === 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    path.close();
  }
  return path;
}

export function Design11NoiseOdyssey({
  amplitude,
  rotation,
  clock,
  size,
}: Design11Props) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 6;
  // Matches FluxRingDial inner orb radius (size * 0.18).
  const orbR = size * 0.18;

  // Annulus the ribbons orbit within: just outside the pearl rim → near the
  // outer halo donut.
  const ribbonMinR = orbR + 10;
  const ribbonMaxR = maxR * 0.92;

  const dims = useMemo(
    () => ({ cx, cy, maxR, orbR, ribbonMinR, ribbonMaxR }),
    [cx, cy, maxR, orbR, ribbonMinR, ribbonMaxR],
  );

  // ── Per-band ribbon paths ───────────────────────────────────────────────
  // 6 plain top-level `useDerivedValue` hooks, each rebuilding its band's
  // geometry every frame via the pure `buildRibbonBand` worklet. Kept explicit
  // (not generated in a loop / factory) so React Hook order is static and the
  // rules-of-hooks linter is satisfied.
  const band0 = useDerivedValue(() =>
    buildRibbonBand(0, BAND_COUNT, amplitude.value, clock.value, amplitudeToLevel(amplitude.value), rotation.value, dims.cx, dims.cy, dims.ribbonMinR, dims.ribbonMaxR),
  );
  const band1 = useDerivedValue(() =>
    buildRibbonBand(1, BAND_COUNT, amplitude.value, clock.value, amplitudeToLevel(amplitude.value), rotation.value, dims.cx, dims.cy, dims.ribbonMinR, dims.ribbonMaxR),
  );
  const band2 = useDerivedValue(() =>
    buildRibbonBand(2, BAND_COUNT, amplitude.value, clock.value, amplitudeToLevel(amplitude.value), rotation.value, dims.cx, dims.cy, dims.ribbonMinR, dims.ribbonMaxR),
  );
  const band3 = useDerivedValue(() =>
    buildRibbonBand(3, BAND_COUNT, amplitude.value, clock.value, amplitudeToLevel(amplitude.value), rotation.value, dims.cx, dims.cy, dims.ribbonMinR, dims.ribbonMaxR),
  );
  const band4 = useDerivedValue(() =>
    buildRibbonBand(4, BAND_COUNT, amplitude.value, clock.value, amplitudeToLevel(amplitude.value), rotation.value, dims.cx, dims.cy, dims.ribbonMinR, dims.ribbonMaxR),
  );
  const band5 = useDerivedValue(() =>
    buildRibbonBand(5, BAND_COUNT, amplitude.value, clock.value, amplitudeToLevel(amplitude.value), rotation.value, dims.cx, dims.cy, dims.ribbonMinR, dims.ribbonMaxR),
  );
  const bands = [band0, band1, band2, band3, band4, band5];

  // ── Outer halo donut ────────────────────────────────────────────────────
  const haloOuterR = dims.maxR * 0.99;
  const haloMidR = dims.maxR * 0.93;
  const haloInnerR = dims.maxR * 0.86;

  return (
    <Canvas style={{ width: size, height: size, backgroundColor: 'transparent' }}>
      {/* Outer halo donut — 3 concentric blurred strokes. */}
      <Group>
        <Circle
          cx={dims.cx}
          cy={dims.cy}
          r={haloOuterR}
          color="rgba(200, 180, 240, 0.5)"
          style="stroke"
          strokeWidth={2}
        >
          <BlurMask blur={14} style="normal" />
        </Circle>
        <Circle
          cx={dims.cx}
          cy={dims.cy}
          r={haloMidR}
          color="rgba(255, 255, 255, 0.7)"
          style="stroke"
          strokeWidth={2.5}
        >
          <BlurMask blur={8} style="normal" />
        </Circle>
        <Circle
          cx={dims.cx}
          cy={dims.cy}
          r={haloInnerR}
          color="rgba(190, 165, 235, 0.45)"
          style="stroke"
          strokeWidth={1.5}
        >
          <BlurMask blur={10} style="normal" />
        </Circle>
      </Group>

      {/* Iridescent ribbon cluster — screen-blended hue bands. */}
      <Group blendMode="screen">
        {bands.map((bandPath, idx) => (
          <Path
            key={idx}
            path={bandPath}
            style="stroke"
            strokeWidth={1.4}
            color={hslToRgba(BAND_HUES[idx], 0.6, 0.9, 0.12)}
          >
            <BlurMask blur={3} style="normal" />
          </Path>
        ))}
      </Group>
    </Canvas>
  );
}
