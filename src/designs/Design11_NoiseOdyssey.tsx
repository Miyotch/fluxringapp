/**
 * Design 11: Noise Odyssey — Skia port
 *
 * Renders the Flux Ring's animated outer ring system:
 *   - Inner clockwise ring group (5..17 rings, domain-warped FBM noise)
 *   - Outer counter-clockwise ring group (6..22 rings, ridged + warped noise mix)
 *   - Floating luminous particles (12..52)
 *   - Soft "howahowa" radial overlay
 *
 * Knob, level number text, and "Flux Ring" sub-label are rendered by the
 * parent `FluxRingDial`, NOT here. This component only owns the ring + particle
 * canvas.
 *
 * Uses an imperative `Skia.PictureRecorder` inside a `useDerivedValue` so we
 * can drive ~25 rings * 72 segments per frame with per-segment color from a
 * single Picture, rather than thousands of declarative Skia nodes.
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
  ridgedNoise,
  smooth,
  warpedNoise,
} from './noise';

export type Design11Props = {
  /** 0.2..4.0 — drives ring count, hue range, brightness. */
  amplitude: SharedValue<number>;
  /** Radians, accumulated user rotation; rotates the entire ring group. */
  rotation: SharedValue<number>;
  /** Canvas square size in px. */
  size: number;
};

/** Build an `hsla()` CSS-string. Skia accepts CSS colors. */
function hsla(h: number, s: number, l: number, a: number): string {
  'worklet';
  return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a.toFixed(3)})`;
}

/** Hard caps on ring + segment counts. iPad can handle 25 * 72 line segments. */
const SEGMENTS = 72;
const MAX_INNER_RINGS = 12; // web maxes at 17; tuned down for mobile
const MAX_OUTER_RINGS = 16; // web maxes at 22
const MAX_PARTICLES = 40;   // web maxes at 52

export function Design11NoiseOdyssey({ amplitude, rotation, size }: Design11Props) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = Math.min(size, size) / 2 - 10;
  const orbR = size * 0.18; // matches FluxRingDial inner orb radius
  const innerMaxR = orbR + 16 + (maxR - orbR - 28) * 0.45;
  const outerMinR = innerMaxR + 4;
  const outerMaxR = orbR + 16 + (maxR - orbR - 28) * 0.98;

  // Memoise the dimensions object; size is stable per render so this is cheap.
  const dims = useMemo(
    () => ({ cx, cy, maxR, orbR, innerMaxR, outerMinR, outerMaxR }),
    [cx, cy, maxR, orbR, innerMaxR, outerMinR, outerMaxR],
  );

  const picture = useDerivedValue(() => {
    const amp = amplitude.value;
    const rot = rotation.value;
    // Drive the noise time off the rotation so the rings continuously animate
    // as the user spins the dial. We add a minor phase offset so a static dial
    // still has a tiny sense of life.
    const time = rot * 0.25;
    const level = amplitudeToLevel(amp);

    // Breathing pulse (organic global rhythm).
    const breath = 1 + Math.sin(time * 0.8) * 0.015 * level;

    // Ring counts grow with level. Floor + clamp to mobile-friendly maxes.
    const innerCount = Math.min(
      MAX_INNER_RINGS,
      Math.floor(5 + (level - 1) * 3),
    );
    const outerCount = Math.min(
      MAX_OUTER_RINGS,
      Math.floor(6 + (level - 1) * 4),
    );
    const particleCount = Math.min(
      MAX_PARTICLES,
      Math.floor(12 + (level - 1) * 10),
    );

    return createPicture((canvas) => {
      // Apply user rotation to the whole assembly.
      canvas.save();
      canvas.translate(dims.cx, dims.cy);
      canvas.rotate((rot * 180) / Math.PI, 0, 0);
      canvas.translate(-dims.cx, -dims.cy);

      // ── Inner ring group (clockwise, warped noise) ──
      for (let i = 0; i < innerCount; i++) {
        const t = innerCount > 1 ? i / innerCount : 0;
        const baseR = (dims.orbR + 18 + t * (dims.innerMaxR - dims.orbR - 18)) * breath;
        const rotSpeed = 0.1 + level * level * 0.04;
        const ringRot = time * rotSpeed + i * 0.15;

        canvas.save();
        canvas.translate(dims.cx, dims.cy);
        canvas.rotate((ringRot * 180) / Math.PI, 0, 0);
        drawWarpedRing(canvas, baseR, time, i, amp, level, t, true);
        canvas.restore();
      }

      // ── Outer ring group (counter-clockwise, ridged + warped) ──
      for (let i = 0; i < outerCount; i++) {
        const t = outerCount > 1 ? i / outerCount : 0;
        const baseR = (dims.outerMinR + t * (dims.outerMaxR - dims.outerMinR)) * breath;
        const rotSpeed = -(0.06 + level * level * 0.025);
        const ringRot = time * rotSpeed - i * 0.1;

        canvas.save();
        canvas.translate(dims.cx, dims.cy);
        canvas.rotate((ringRot * 180) / Math.PI, 0, 0);
        drawWarpedRing(canvas, baseR, time, i + innerCount, amp, level, t, false);
        canvas.restore();
      }

      // ── Floating luminous particles ──
      drawParticles(
        canvas,
        dims.cx,
        dims.cy,
        dims.maxR,
        dims.orbR,
        time,
        level,
        particleCount,
      );

      // ── Howahowa soft radial overlay ──
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
// They take a Skia `SkCanvas` and use the imperative API directly.
// ---------------------------------------------------------------------------

type SkCanvasLike = Parameters<Parameters<typeof createPicture>[0]>[0];

/**
 * Single ring with domain-warped or ridged noise + per-segment HSL stroke.
 * Mirrors the web `drawWarpedRing` but emits straight line segments (lineTo)
 * for each of the 72 chunks.
 */
function drawWarpedRing(
  canvas: SkCanvasLike,
  baseR: number,
  time: number,
  ringIdx: number,
  amplitude: number,
  level: number,
  t: number,
  isInner: boolean,
): void {
  'worklet';
  const clampedAmp = Math.min(amplitude, 2.8);
  const noiseScale = 2.0 + ringIdx * 0.25;
  const warpIntensity = 0.8 + level * 0.3;

  // Pre-compute ring points + brightness.
  const xs: number[] = [];
  const ys: number[] = [];
  const bs: number[] = [];

  for (let s = 0; s <= SEGMENTS; s++) {
    const angle = (s / SEGMENTS) * Math.PI * 2;
    const nx = Math.cos(angle) * noiseScale;
    const ny = Math.sin(angle) * noiseScale;

    let noiseVal: number;
    if (isInner) {
      noiseVal = warpedNoise(nx, ny, time + ringIdx * 0.5, warpIntensity);
    } else {
      const warped = warpedNoise(nx, ny, time + ringIdx * 0.3, warpIntensity * 0.6);
      const ridged = ridgedNoise(nx * 0.8, ny * 0.8, time + ringIdx * 0.7);
      noiseVal = warped * 0.6 + ridged * 0.4;
    }

    const displacement = noiseVal * (2.5 + clampedAmp * 2.5) * (0.5 + level * 0.08);
    const r = baseR + displacement;
    xs.push(r * Math.cos(angle));
    ys.push(r * Math.sin(angle));

    const brightPhase = time * (0.5 + level * 0.15) + ringIdx * 0.6;
    let angleDelta = angle - brightPhase;
    while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
    const brightness = Math.exp(-(angleDelta * angleDelta) / (1.2 + level * 0.2));
    bs.push(brightness);
  }

  const baseHue = isInner ? 270 : 262;
  const levelVis = 0.18 + (level - 1) * (level >= 4 ? 0.09 : 0.14);
  const alphaCap = level >= 4 ? 0.35 : 0.45;
  const widthScale = 0.5 + (level - 1) * 0.13;

  // ── Per-segment colored strokes ──
  // We allocate one Paint per segment (cheap; lives only inside the picture).
  const segPaint = Skia.Paint();
  segPaint.setStyle(1); // 1 = Stroke
  segPaint.setAntiAlias(true);

  for (let s = 0; s < xs.length - 1; s++) {
    const segT = s / (xs.length - 1);
    const brightness = bs[s];

    const hue = baseHue + segT * 30 + brightness * 15 + t * 15;
    const sat = 58 + level * 4 + brightness * 10 + t * 8;
    const light = 70 + Math.min(level, 3) * 2 + brightness * 4;

    const baseAlpha = (1 - t * 0.35) * levelVis;
    const alpha = Math.min(alphaCap, baseAlpha * (0.45 + brightness * 0.45));

    const baseWidth = 1 - t * 0.4;
    const lw = (0.6 + baseWidth * 0.8 + brightness * 0.6) * widthScale;

    segPaint.setColor(Skia.Color(hsla(hue, sat, light, alpha)));
    segPaint.setStrokeWidth(lw);

    const path = Skia.Path.Make();
    path.moveTo(xs[s], ys[s]);
    path.lineTo(xs[s + 1], ys[s + 1]);
    canvas.drawPath(path, segPaint);
  }

  // ── Neumorphic highlight stroke (offset up) ──
  const hlAlpha = Math.min(level >= 4 ? 0.16 : 0.22, (1 - t * 0.35) * levelVis * 0.25);
  const hlPaint = Skia.Paint();
  hlPaint.setStyle(1);
  hlPaint.setAntiAlias(true);
  hlPaint.setColor(
    Skia.Color(hsla(baseHue + t * 20, 55 + level * 4, 80 + Math.min(level, 3), hlAlpha)),
  );
  hlPaint.setStrokeWidth((0.4 + (1 - t * 0.5) * 0.4) * (0.5 + (level - 1) * 0.12));
  const hlPath = Skia.Path.Make();
  hlPath.moveTo(xs[0], ys[0] - 1);
  for (let s = 1; s < xs.length; s++) hlPath.lineTo(xs[s], ys[s] - 1);
  canvas.drawPath(hlPath, hlPaint);

  // ── Neumorphic shadow stroke (offset down) ──
  const shAlpha = Math.min(0.18, (1 - t * 0.35) * levelVis * 0.22);
  const shPaint = Skia.Paint();
  shPaint.setStyle(1);
  shPaint.setAntiAlias(true);
  shPaint.setColor(
    Skia.Color(hsla(baseHue + t * 20 - 5, 55 + level * 3, 70 + level * 2, shAlpha)),
  );
  shPaint.setStrokeWidth((0.4 + (1 - t * 0.5) * 0.4) * (0.5 + (level - 1) * 0.12));
  const shPath = Skia.Path.Make();
  shPath.moveTo(xs[0], ys[0] + 1);
  for (let s = 1; s < xs.length; s++) shPath.lineTo(xs[s], ys[s] + 1);
  canvas.drawPath(shPath, shPaint);
}

/** Floating luminous particles drifting between the rings. */
function drawParticles(
  canvas: SkCanvasLike,
  cx: number,
  cy: number,
  maxR: number,
  orbR: number,
  time: number,
  level: number,
  particleCount: number,
): void {
  'worklet';
  const paint = Skia.Paint();
  paint.setStyle(0); // 0 = Fill
  paint.setAntiAlias(true);

  for (let i = 0; i < particleCount; i++) {
    const seed = i * 137.5;
    const orbitR =
      orbR + 22 + hash(seed, 0) * 0.5 * (maxR - orbR - 30) + (maxR - orbR - 30) * 0.5;
    const orbitSpeed = 0.08 + hash(seed, 1) * 0.04 + level * 0.02;
    const angle = time * orbitSpeed * (i % 2 === 0 ? 1 : -1) + seed;

    const flutter = smooth(time * 0.3 + i * 0.7, i * 2.3) * 8 * (0.5 + level * 0.1);
    const r = orbitR + flutter;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);

    const pulse = 0.5 + 0.5 * Math.sin(time * 1.5 + i * 0.9);
    const alpha = (0.15 + pulse * 0.25) * (0.3 + (level - 1) * 0.18);
    const sizePx = 1.0 + pulse * 1.5 + level * 0.3;

    const hueP = 268 + hash(seed, 2) * 20;
    const sat = 60 + level * 5;

    paint.setColor(Skia.Color(hsla(hueP, sat, 82, alpha)));
    canvas.drawCircle(x, y, sizePx, paint);
  }
}

/**
 * Soft purple radial overlay approximating the web `howahowa-N.png` sprites.
 * Procedural so we don't have to ship 5 PNG variants.
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

  // Soft outer glow
  const outerPaint = Skia.Paint();
  outerPaint.setStyle(0);
  outerPaint.setAntiAlias(true);
  const outerShader = Skia.Shader.MakeRadialGradient(
    { x: cx, y: cy },
    radius,
    [
      Skia.Color(`rgba(180, 150, 220, ${(0.18 + t * 0.18).toFixed(3)})`),
      Skia.Color('rgba(170, 140, 215, 0.08)'),
      Skia.Color('rgba(170, 140, 215, 0)'),
    ],
    [0, 0.55, 1],
    0, // 0 = Clamp tile mode
  );
  outerPaint.setShader(outerShader);
  outerPaint.setBlendMode(13); // 13 = Screen

  canvas.save();
  canvas.translate(cx, cy);
  canvas.rotate((time * 0.06 * 180) / Math.PI, 0, 0);
  canvas.translate(-cx, -cy);
  canvas.drawCircle(cx, cy, radius, outerPaint);
  canvas.restore();
}

