/**
 * Design 11: Noise Odyssey — Skia port (aurora ribbon edition)
 *
 * Renders the Flux Ring's calm flowing aurora ribbons:
 *   - 6 unified aurora ribbons (3 inner clockwise, 3 outer counter-clockwise)
 *     each built from 32 sample points connected with cubic Bezier curves
 *     (Catmull-Rom -> Bezier conversion) for smooth flowing waves
 *   - 12 small floating sparkle particles
 *   - Soft pearl/lavender "howahowa" radial overlay
 *   - Faint vertical purple glow rising from below the dial
 *
 * Knob, level number text, and "Flux Ring" sub-label are rendered by the
 * parent `FluxRingDial`, NOT here. This component owns the ring + particle
 * canvas + background glow.
 *
 * Uses an imperative `Skia.PictureRecorder` inside a `useDerivedValue` so all
 * curves are recorded into a single Picture per frame.
 */
import { useMemo } from 'react';
import {
  Canvas,
  Group,
  Picture,
  Skia,
  createPicture,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';
import {
  amplitudeToLevel,
  hash,
  smooth,
  warpedNoise,
} from './noise';

export type Design11Props = {
  /** 0.2..4.0 — drives ribbon amplitude response, hue spread, brightness. */
  amplitude: SharedValue<number>;
  /** Radians, accumulated user rotation; rotates the entire ribbon group. */
  rotation: SharedValue<number>;
  /** Canvas square size in px. */
  size: number;
};

/** Build an `hsla()` CSS-string. Skia accepts CSS colors. */
function hsla(h: number, s: number, l: number, a: number): string {
  'worklet';
  return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a.toFixed(3)})`;
}

/** Sample count per ribbon. 32 gives smooth cubic curves without hot loops. */
const SAMPLES = 32;

/** Total ribbon count: 3 inner + 3 outer = 6. */
const INNER_RIBBONS = 3;
const OUTER_RIBBONS = 3;

/** Sparkle particle count (fixed; no longer scales with level). */
const PARTICLES = 12;

/**
 * Aurora ribbon palette. Each ribbon picks a base hue from this set; the hue
 * rotates slowly with time to give a gentle color shift. Pinks, lavenders,
 * cyans and pale yellow.
 */
const RIBBON_HUES = [318, 280, 258, 198, 168, 50];

export function Design11NoiseOdyssey({ amplitude, rotation, size }: Design11Props) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 10;
  const orbR = size * 0.18; // matches FluxRingDial inner orb radius

  // Ribbon radius band: starts just outside the orb, ends just inside the bezel.
  const innerBand = orbR + 24;
  const outerBand = maxR - 6;
  const bandSpan = outerBand - innerBand;

  const dims = useMemo(
    () => ({ cx, cy, maxR, orbR, innerBand, outerBand, bandSpan }),
    [cx, cy, maxR, orbR, innerBand, outerBand, bandSpan],
  );

  const picture = useDerivedValue(() => {
    const amp = amplitude.value;
    const rot = rotation.value;
    // Drive noise time off the rotation so ribbons continuously animate as the
    // user spins the dial. The small base offset keeps a static dial alive.
    const time = rot * 0.25;
    const level = amplitudeToLevel(amp);

    // Breathing pulse (gentle global rhythm, far smaller than the segmented
    // version had — we want calm motion not a thumping bass meter).
    const breath = 1 + Math.sin(time * 0.6) * 0.012 * level;

    return createPicture((canvas) => {
      // ── Background vertical purple glow (bottom-most layer) ──
      drawBackgroundGlow(canvas, size);

      // Apply user rotation to the whole ribbon assembly.
      canvas.save();
      canvas.translate(dims.cx, dims.cy);
      canvas.rotate((rot * 180) / Math.PI, 0, 0);
      canvas.translate(-dims.cx, -dims.cy);

      // ── Inner ribbons (clockwise) ──
      for (let i = 0; i < INNER_RIBBONS; i++) {
        const t = i / INNER_RIBBONS;
        // Inner ribbons live in the lower 55% of the band.
        const baseR =
          (dims.innerBand + (0.05 + t * 0.5) * dims.bandSpan) * breath;
        const ribbonRot = time * (0.08 + level * 0.02) + i * 0.7;
        const phase = i * 1.7;
        const hue = RIBBON_HUES[i % RIBBON_HUES.length];

        canvas.save();
        canvas.translate(dims.cx, dims.cy);
        canvas.rotate((ribbonRot * 180) / Math.PI, 0, 0);
        drawAuroraRibbon(canvas, baseR, time, phase, hue, amp, level, t, true);
        canvas.restore();
      }

      // ── Outer ribbons (counter-clockwise) ──
      for (let i = 0; i < OUTER_RIBBONS; i++) {
        const t = i / OUTER_RIBBONS;
        // Outer ribbons live in the upper 55% of the band.
        const baseR =
          (dims.innerBand + (0.45 + t * 0.55) * dims.bandSpan) * breath;
        const ribbonRot = -(time * (0.05 + level * 0.015) + i * 0.55);
        const phase = i * 2.3 + 4.7;
        const hue =
          RIBBON_HUES[(i + INNER_RIBBONS) % RIBBON_HUES.length];

        canvas.save();
        canvas.translate(dims.cx, dims.cy);
        canvas.rotate((ribbonRot * 180) / Math.PI, 0, 0);
        drawAuroraRibbon(canvas, baseR, time, phase, hue, amp, level, t, false);
        canvas.restore();
      }

      // ── Floating luminous particles ──
      drawParticles(
        canvas,
        dims.cx,
        dims.cy,
        dims.outerBand,
        dims.orbR,
        time,
        level,
      );

      // ── Howahowa soft pearl/lavender radial overlay ──
      drawHowahowa(canvas, dims.cx, dims.cy, size, time, Math.min(amp, 1.8));

      canvas.restore();
    });
  }, [size]);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group>
        <Picture picture={picture} />
      </Group>
    </Canvas>
  );
}

// ---------------------------------------------------------------------------
// Worklet draw helpers — invoked from inside `createPicture` on the UI thread.
// ---------------------------------------------------------------------------

type SkCanvasLike = Parameters<Parameters<typeof createPicture>[0]>[0];

/**
 * Build a smooth closed curve through SAMPLES points using Catmull-Rom -> Bezier
 * conversion. This gives a continuous wavy aurora line, not a segmented zigzag.
 *
 * Catmull-Rom segment between p1 and p2 with neighbours p0, p3 maps to a cubic
 * Bezier with control points:
 *   c1 = p1 + (p2 - p0) / 6
 *   c2 = p2 - (p3 - p1) / 6
 */
function buildSmoothClosedPath(xs: number[], ys: number[]): ReturnType<typeof Skia.Path.Make> {
  'worklet';
  const path = Skia.Path.Make();
  const n = xs.length;
  if (n < 2) return path;

  path.moveTo(xs[0], ys[0]);
  for (let i = 0; i < n; i++) {
    const i0 = (i - 1 + n) % n;
    const i1 = i;
    const i2 = (i + 1) % n;
    const i3 = (i + 2) % n;

    const c1x = xs[i1] + (xs[i2] - xs[i0]) / 6;
    const c1y = ys[i1] + (ys[i2] - ys[i0]) / 6;
    const c2x = xs[i2] - (xs[i3] - xs[i1]) / 6;
    const c2y = ys[i2] - (ys[i3] - ys[i1]) / 6;

    path.cubicTo(c1x, c1y, c2x, c2y, xs[i2], ys[i2]);
  }
  path.close();
  return path;
}

/**
 * Draw a single aurora ribbon: a smooth closed curve perturbed by FBM noise,
 * rendered as a translucent wide glow underneath plus a thin bright stroke
 * on top.
 */
function drawAuroraRibbon(
  canvas: SkCanvasLike,
  baseR: number,
  time: number,
  phase: number,
  baseHue: number,
  amplitude: number,
  level: number,
  t: number,
  isInner: boolean,
): void {
  'worklet';
  const clampedAmp = Math.min(amplitude, 2.8);

  // Lower frequency than before: we want broad gentle waves, not high-frequency
  // chatter. 1.8..2.4 across the ribbon stack.
  const noiseFreq = 1.8 + t * 0.6;
  const warpIntensity = 0.55 + level * 0.18;
  const ampResp = (3.5 + clampedAmp * 3.2) * (0.6 + level * 0.06);

  const xs: number[] = [];
  const ys: number[] = [];

  for (let s = 0; s < SAMPLES; s++) {
    const angle = (s / SAMPLES) * Math.PI * 2;
    const nx = Math.cos(angle) * noiseFreq + phase;
    const ny = Math.sin(angle) * noiseFreq + phase;

    // Inner ribbons get pure warped noise; outer get a slightly stronger warp
    // to spiral away from the inner trio.
    const noiseVal = isInner
      ? warpedNoise(nx, ny, time + phase * 0.3, warpIntensity)
      : warpedNoise(nx, ny, time + phase * 0.4, warpIntensity * 1.15);

    const r = baseR + noiseVal * ampResp;
    xs.push(r * Math.cos(angle));
    ys.push(r * Math.sin(angle));
  }

  const path = buildSmoothClosedPath(xs, ys);

  // Slow hue shift over time keeps the palette alive without being noisy.
  const hue = baseHue + Math.sin(time * 0.2 + phase) * 12;
  const sat = 62 + level * 3;
  const light = 72 + Math.min(level, 3) * 2;
  const visibility = 0.55 + (level - 1) * 0.08;

  // Wide soft glow stroke (under).
  const glowPaint = Skia.Paint();
  glowPaint.setStyle(1); // 1 = Stroke
  glowPaint.setAntiAlias(true);
  glowPaint.setStrokeWidth(10 + level * 1.4);
  glowPaint.setColor(Skia.Color(hsla(hue, sat, light + 4, 0.18 * visibility)));
  glowPaint.setBlendMode(14); // 14 = Screen — additive feel for aurora
  canvas.drawPath(path, glowPaint);

  // Mid stroke for body.
  const midPaint = Skia.Paint();
  midPaint.setStyle(1);
  midPaint.setAntiAlias(true);
  midPaint.setStrokeWidth(4.5 + level * 0.4);
  midPaint.setColor(Skia.Color(hsla(hue, sat + 6, light + 2, 0.32 * visibility)));
  midPaint.setBlendMode(14);
  canvas.drawPath(path, midPaint);

  // Sharp top stroke for the bright ribbon line.
  const linePaint = Skia.Paint();
  linePaint.setStyle(1);
  linePaint.setAntiAlias(true);
  linePaint.setStrokeWidth(2.2);
  linePaint.setColor(
    Skia.Color(hsla(hue, Math.min(80, sat + 12), light + 8, 0.55 * visibility)),
  );
  canvas.drawPath(path, linePaint);
}

/**
 * Floating luminous sparkle particles — small (2-3px) and sparse so they read
 * as drifting motes, not a confetti spray.
 */
function drawParticles(
  canvas: SkCanvasLike,
  cx: number,
  cy: number,
  maxR: number,
  orbR: number,
  time: number,
  level: number,
): void {
  'worklet';
  const paint = Skia.Paint();
  paint.setStyle(0); // 0 = Fill
  paint.setAntiAlias(true);

  const span = maxR - orbR - 30;

  for (let i = 0; i < PARTICLES; i++) {
    const seed = i * 137.5;
    const orbitR = orbR + 24 + (hash(seed, 0) * 0.5 + 0.5) * span;
    const orbitSpeed = 0.06 + hash(seed, 1) * 0.03 + level * 0.012;
    const angle = time * orbitSpeed * (i % 2 === 0 ? 1 : -1) + seed;

    const flutter = smooth(time * 0.25 + i * 0.6, i * 2.1) * 6 * (0.4 + level * 0.08);
    const r = orbitR + flutter;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);

    const pulse = 0.5 + 0.5 * Math.sin(time * 1.2 + i * 0.9);
    const alpha = (0.18 + pulse * 0.22) * (0.55 + (level - 1) * 0.1);
    const sizePx = 1.2 + pulse * 1.2; // 1.2..2.4 px

    const hueP = 268 + hash(seed, 2) * 30;
    const sat = 55 + level * 4;

    paint.setColor(Skia.Color(hsla(hueP, sat, 84, alpha)));
    canvas.drawCircle(x, y, sizePx, paint);
  }
}

/**
 * Soft pearl-lavender radial overlay around the dial. Replaces the older
 * "purple cloud" — this is tuned to the pastel screenshot palette.
 */
function drawHowahowa(
  canvas: SkCanvasLike,
  cx: number,
  cy: number,
  size: number,
  time: number,
  amplitude: number,
): void {
  'worklet';
  const t = Math.max(0, Math.min(1, (amplitude - 0.2) / 3.8));
  const radius = size * 0.475;

  const outerPaint = Skia.Paint();
  outerPaint.setStyle(0);
  outerPaint.setAntiAlias(true);
  const outerShader = Skia.Shader.MakeRadialGradient(
    { x: cx, y: cy },
    radius,
    [
      Skia.Color(`rgba(232, 222, 245, ${(0.16 + t * 0.14).toFixed(3)})`),
      Skia.Color('rgba(210, 198, 232, 0.07)'),
      Skia.Color('rgba(200, 188, 225, 0)'),
    ],
    [0, 0.55, 1],
    0, // 0 = Clamp tile mode
  );
  outerPaint.setShader(outerShader);
  outerPaint.setBlendMode(14); // 14 = Screen

  canvas.save();
  canvas.translate(cx, cy);
  canvas.rotate((time * 0.05 * 180) / Math.PI, 0, 0);
  canvas.translate(-cx, -cy);
  canvas.drawCircle(cx, cy, radius, outerPaint);
  canvas.restore();
}

/**
 * Vertical purple glow rising from the bottom of the canvas — bottom-most
 * draw so all ribbons sit on top of it.
 */
function drawBackgroundGlow(canvas: SkCanvasLike, size: number): void {
  'worklet';
  const paint = Skia.Paint();
  paint.setStyle(0);
  paint.setAntiAlias(true);
  const shader = Skia.Shader.MakeLinearGradient(
    { x: size / 2, y: 0 },
    { x: size / 2, y: size },
    [
      Skia.Color('rgba(145, 120, 189, 0)'),
      Skia.Color('rgba(145, 120, 189, 0.15)'),
    ],
    [0, 1],
    0, // Clamp
  );
  paint.setShader(shader);
  canvas.drawRect({ x: 0, y: 0, width: size, height: size }, paint);
}
