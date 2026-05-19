/**
 * Design 11: Noise Odyssey — Skia port (concentric multi-ring edition)
 *
 * Many concentric rings, 72 segments each, organic noise displacement.
 * 1:1 port of the legacy web Canvas2D implementation
 * (`/tmp/fluxring-original/src/designs/Design11_NoiseOdyssey.tsx`).
 *
 *   - Inner ring group (clockwise, warped noise):     5 → 17 rings
 *   - Outer ring group (counter-clockwise, ridged):   6 → 22 rings
 *   - 72 vertices per ring, connected by straight lines (no Bezier smoothing —
 *     keeps the crisp segmented character of the original).
 *   - Per-segment brightness modulation drives alpha + stroke width via an
 *     angle-based exponential window (Gaussian-ish). Implemented as a small
 *     number of "brightness bands" per ring (4) instead of per-segment strokes
 *     to keep frame cost reasonable.
 *   - Three strokes per ring: main, highlight (y-1, white), shadow (y+1, lavender).
 *   - 12 → 48 floating sparkle particles, screen-blended on top.
 *   - Global breathing pulse: `1 + sin(time * 0.8) * 0.015 * level`.
 *   - Free-running 60fps clock owned by parent (FluxRingDial); user pan
 *     gesture continues to update amplitude only.
 *
 * Knob, level number text, and "Flux Ring" sub-label are rendered by the
 * parent `FluxRingDial`, NOT here.
 */
import { useMemo } from 'react';
import {
  Canvas,
  Picture,
  Skia,
  TileMode,
  createPicture,
} from '@shopify/react-native-skia';
import type { DerivedValue, SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';
import {
  amplitudeToLevel,
  hash,
  ridgedNoise,
  smooth,
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

/** Build an `hsla()` CSS-string. Skia accepts CSS colors. */
function hslaStr(h: number, s: number, l: number, a: number): string {
  'worklet';
  return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a.toFixed(3)})`;
}

/** Vertices per ring (matches the spec exactly). */
const SEGMENTS = 72;

/**
 * Number of brightness bands per ring. The angle-based brightness window from
 * the original is bucketed into this many tiers. With 4 bands across 39 max
 * rings × 3 stroke passes, we end up around ~470 drawPath calls per frame —
 * comfortably within Skia's budget while preserving the angular glow.
 */
const BANDS = 4;

export function Design11NoiseOdyssey({
  amplitude,
  rotation,
  clock,
  size,
}: Design11Props) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 10;
  // Matches FluxRingDial inner orb radius (size * 0.18). The original web
  // version uses a fixed 114; we scale it so the dial works at any size.
  const orbR = size * 0.18;

  // Inner / outer band radii (port of original lines 111-113)
  const innerMaxR = orbR + 16 + (maxR - orbR - 28) * 0.45;
  const outerMinR = innerMaxR + 4;
  const outerMaxR = orbR + 16 + (maxR - orbR - 28) * 0.98;

  const dims = useMemo(
    () => ({ cx, cy, maxR, orbR, innerMaxR, outerMinR, outerMaxR }),
    [cx, cy, maxR, orbR, innerMaxR, outerMinR, outerMaxR],
  );

  // ── Background glow picture (bottom layer, no blur) ──
  const bgPicture = useDerivedValue(() => {
    return createPicture((canvas) => {
      drawBackgroundGlow(canvas, size);
    });
  }, [size]);

  // ── Inner ring picture (clockwise warped noise). The many low-alpha
  // strokes need a Gaussian blur applied to the *composited* group of
  // strokes to bloom into the soft purple "moya moya" cloud the web
  // Canvas2D gets for free via global composite. In Skia 2.2.12 the React
  // JSX pattern `<Group layer={<Paint><Blur/></Paint>}><Picture/></Group>`
  // does not composite Picture children — the offscreen layer swallows
  // them. Instead we apply the blur INSIDE the createPicture worklet via
  // `canvas.saveLayer(paint)` + `canvas.restore()`, where `paint` carries
  // a MakeBlur ImageFilter. This is the C++ canvas API's supported pattern
  // for blurring a group of imperative draws. ──
  const innerRingsPicture = useDerivedValue(() => {
    const amp = amplitude.value;
    const rot = rotation.value;
    const time = clock.value;
    const level = amplitudeToLevel(amp);
    const breath = 1 + Math.sin(time * 0.8) * 0.015 * level;
    const innerCount = Math.floor(5 + (level - 1) * 3);

    return createPicture((canvas) => {
      const blurFilter = Skia.ImageFilter.MakeBlur(6, 6, TileMode.Decal, null);
      const layerPaint = Skia.Paint();
      layerPaint.setImageFilter(blurFilter);
      canvas.saveLayer(layerPaint);

      canvas.save();
      canvas.translate(dims.cx, dims.cy);
      canvas.rotate((rot * 180) / Math.PI, 0, 0);
      canvas.translate(-dims.cx, -dims.cy);

      for (let i = 0; i < innerCount; i++) {
        const t = innerCount > 1 ? i / (innerCount - 1) : 0;
        const baseR = (orbR + 18 + t * (dims.innerMaxR - orbR - 18)) * breath;

        const rotSpeed = 0.1 + level * level * 0.04;
        const ringRot = time * rotSpeed + i * 0.15;

        canvas.save();
        canvas.translate(dims.cx, dims.cy);
        canvas.rotate((ringRot * 180) / Math.PI, 0, 0);
        drawWarpedRing(canvas, baseR, time, i, amp, level, t, true);
        canvas.restore();
      }
      canvas.restore();

      canvas.restore(); // matches saveLayer
    });
  }, [size]);

  // ── Outer ring picture (counter-clockwise, ridged + warped) ──
  // Same saveLayer/restore blur strategy as the inner picture but with a
  // wider blur sigma (10) so the outer rings read as a more diffuse outer
  // halo.
  const outerRingsPicture = useDerivedValue(() => {
    const amp = amplitude.value;
    const rot = rotation.value;
    const time = clock.value;
    const level = amplitudeToLevel(amp);
    const breath = 1 + Math.sin(time * 0.8) * 0.015 * level;
    const innerCount = Math.floor(5 + (level - 1) * 3);
    const outerCount = Math.floor(6 + (level - 1) * 4);

    return createPicture((canvas) => {
      const blurFilter = Skia.ImageFilter.MakeBlur(10, 10, TileMode.Decal, null);
      const layerPaint = Skia.Paint();
      layerPaint.setImageFilter(blurFilter);
      canvas.saveLayer(layerPaint);

      canvas.save();
      canvas.translate(dims.cx, dims.cy);
      canvas.rotate((rot * 180) / Math.PI, 0, 0);
      canvas.translate(-dims.cx, -dims.cy);

      for (let i = 0; i < outerCount; i++) {
        const t = outerCount > 1 ? i / (outerCount - 1) : 0;
        const baseR = (dims.outerMinR + t * (dims.outerMaxR - dims.outerMinR)) * breath;

        const rotSpeed = -(0.06 + level * level * 0.025);
        const ringRot = time * rotSpeed - i * 0.1;

        canvas.save();
        canvas.translate(dims.cx, dims.cy);
        canvas.rotate((ringRot * 180) / Math.PI, 0, 0);
        drawWarpedRing(canvas, baseR, time, i + innerCount, amp, level, t, false);
        canvas.restore();
      }
      canvas.restore();

      canvas.restore(); // matches saveLayer
    });
  }, [size]);

  // ── Particles + howahowa overlay (top layer, no blur — keep sparkles
  // crisp). ──
  const overlayPicture = useDerivedValue(() => {
    const amp = amplitude.value;
    const time = clock.value;
    const level = amplitudeToLevel(amp);

    return createPicture((canvas) => {
      drawParticles(
        canvas,
        dims.cx,
        dims.cy,
        dims.outerMaxR,
        dims.orbR,
        time,
        level,
      );
      drawHowahowa(canvas, dims.cx, dims.cy, size, time, Math.min(amp, 1.8));
    });
  }, [size]);

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Background glow — no blur. */}
      <Picture picture={bgPicture} />
      {/* Inner rings — blur applied via saveLayer/restore INSIDE the
          createPicture worklet (see innerRingsPicture). */}
      <Picture picture={innerRingsPicture} />
      {/* Outer rings — same saveLayer blur pattern with sigma=10. */}
      <Picture picture={outerRingsPicture} />
      {/* Particles + radial overlay — crisp on top of the blurred cloud. */}
      <Picture picture={overlayPicture} />
    </Canvas>
  );
}

// ---------------------------------------------------------------------------
// Worklet draw helpers — invoked from inside `createPicture` on the UI thread.
// ---------------------------------------------------------------------------

type SkCanvasLike = Parameters<Parameters<typeof createPicture>[0]>[0];

/**
 * Draw a single ring with domain-warped (or ridged) noise displacement and
 * per-segment brightness modulation.
 *
 * Ring path is built as straight lineTo segments (no Bezier) — the original
 * web version uses straight segments and we want to keep that crisp character.
 *
 * Each ring is rendered with three stroke passes (port of original lines
 * 264-287):
 *   1. Main stroke at the per-segment hsla colour.
 *   2. White highlight stroke at offset y-1, alpha ~0.07.
 *   3. Lavender shadow stroke at offset y+1, alpha ~0.05.
 *
 * Per-segment brightness is bucketed into BANDS=4 tiers; each tier becomes
 * its own path stroked at the tier's alpha + width. This trades exact
 * per-segment fidelity for a 5-10x reduction in drawPath calls — the visible
 * difference is negligible because BANDS already covers the dynamic range of
 * the angle-window exp curve.
 */
function drawWarpedRing(
  canvas: SkCanvasLike,
  baseR: number,
  time: number,
  ringIdx: number,
  amplitude: number,
  level: number,
  t: number, // ring position in its group [0..1]
  isInner: boolean,
): void {
  'worklet';
  const clampedAmp = Math.min(amplitude, 2.8);
  const noiseScale = 2.0 + ringIdx * 0.25;
  const warpIntensity = 0.8 + level * 0.3;
  const ampResp = (2.5 + clampedAmp * 2.5) * (0.5 + level * 0.08);

  // ── Pre-compute ring vertices + per-vertex brightness ──
  const xs: number[] = new Array(SEGMENTS + 1);
  const ys: number[] = new Array(SEGMENTS + 1);
  const brights: number[] = new Array(SEGMENTS + 1);

  // Phase point for the angle-based brightness window. The window slides
  // around the ring with time, giving the rings their flowing light.
  const brightPhase = time * (0.5 + level * 0.15) + ringIdx * 0.6;
  const brightWidth = 1.2 + level * 0.2;

  for (let s = 0; s <= SEGMENTS; s++) {
    const angle = (s / SEGMENTS) * Math.PI * 2;
    const nx = Math.cos(angle) * noiseScale;
    const ny = Math.sin(angle) * noiseScale;

    let noiseVal: number;
    if (isInner) {
      noiseVal = warpedNoise(nx, ny, time + ringIdx * 0.5, warpIntensity);
    } else {
      const warped = warpedNoise(
        nx,
        ny,
        time + ringIdx * 0.3,
        warpIntensity * 0.6,
      );
      const ridged = ridgedNoise(nx * 0.8, ny * 0.8, time + ringIdx * 0.7);
      noiseVal = warped * 0.6 + ridged * 0.4;
    }

    const r = baseR + noiseVal * ampResp;
    xs[s] = r * Math.cos(angle);
    ys[s] = r * Math.sin(angle);

    // Wrap angle-delta into [-π, π] before plugging into the Gaussian window.
    let angleDelta = angle - brightPhase;
    while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
    brights[s] = Math.exp(
      -(angleDelta * angleDelta) / brightWidth,
    );
  }

  // Visibility cap (port of lines 222-224, 238). Alpha is constrained to the
  // DESIGN.md spec range 0.03..0.13; the legacy `levelVis`/`alphaCap` factors
  // are folded into a normalized [0..1] fade that maps onto the tightened
  // alpha window below.
  const levelVis = 0.18 + (level - 1) * (level >= 4 ? 0.09 : 0.14);
  const baseHue = isInner ? 270 : 262;
  const baseAlpha = (1 - t * 0.35) * levelVis;
  // Spec alpha range for the main ring strokes — bumped 1.5x from the
  // DESIGN.md raw 0.03..0.13 because the parent Group blur (sigma 6/10)
  // averages the strokes down. Without the bump the cloud reads as
  // near-transparent in the iPad screenshot.
  const ALPHA_MIN = 0.045;
  const ALPHA_MAX = 0.2;
  const widthScale = 0.5 + (level - 1) * 0.13;
  const baseWidth = 1 - t * 0.4;

  // ── Pass 1: main per-band strokes ──
  // Bucket each segment into one of BANDS brightness tiers. Each band gets
  // its own Skia path; we stroke it once with the band's representative
  // alpha + width.
  const bandPaths: ReturnType<typeof Skia.Path.Make>[] = [];
  const bandStarted: boolean[] = new Array(BANDS);
  for (let b = 0; b < BANDS; b++) {
    bandPaths.push(Skia.Path.Make());
    bandStarted[b] = false;
  }

  for (let s = 0; s < SEGMENTS; s++) {
    const b = Math.min(BANDS - 1, Math.floor(brights[s] * BANDS));
    const path = bandPaths[b];
    if (!bandStarted[b]) {
      path.moveTo(xs[s], ys[s]);
      bandStarted[b] = true;
    } else {
      path.lineTo(xs[s], ys[s]);
    }
    path.lineTo(xs[s + 1], ys[s + 1]);
  }

  for (let b = 0; b < BANDS; b++) {
    if (!bandStarted[b]) continue;
    const bandBright = (b + 0.5) / BANDS; // representative brightness
    const segT = 0.5; // mid-circumference tint — bands aren't contiguous
    // Hue drift: spec window is hsla(260..270). Inner rings sit at 270, outer
    // at 262, so we modulate within ±5° of each center, capped to [260,270].
    // Max contribution: segT*4 + bandBright*4 + |sin|*2 = 10° peak-to-peak.
    const hueDrift = segT * 4 + bandBright * 4 + Math.sin(time * 0.3) * 2;
    const hue = Math.max(260, Math.min(270, baseHue - 5 + hueDrift));
    const sat = 58 + level * 4 + bandBright * 10 + t * 8;
    const light = 70 + Math.min(level, 3) * 2 + bandBright * 4;
    // Alpha drift: spec window is 0.03..0.13. baseAlpha (0..~0.54) is
    // normalized to a [0..1] fade and mapped onto the spec range; brightness
    // bands modulate within that window so dim segments hit the floor and
    // bright crests hit the ceiling.
    const alphaFade = Math.min(1, baseAlpha / 0.54);
    const alpha = Math.max(
      ALPHA_MIN,
      Math.min(
        ALPHA_MAX,
        ALPHA_MIN + bandBright * alphaFade * (ALPHA_MAX - ALPHA_MIN),
      ),
    );
    const lineWidth =
      (0.6 + baseWidth * 0.8 + bandBright * 0.6) * widthScale;

    const paint = Skia.Paint();
    paint.setStyle(1); // Stroke
    paint.setAntiAlias(true);
    paint.setStrokeWidth(lineWidth);
    paint.setColor(Skia.Color(hslaStr(hue, sat, light, alpha)));
    paint.setBlendMode(14); // Screen
    canvas.drawPath(bandPaths[b], paint);
  }

  // ── Pass 2: white highlight stroke offset y-1 (closed path) ──
  const highlightPath = Skia.Path.Make();
  highlightPath.moveTo(xs[0], ys[0] - 1);
  for (let s = 1; s <= SEGMENTS; s++) {
    highlightPath.lineTo(xs[s], ys[s] - 1);
  }
  highlightPath.close();
  // Highlight alpha: spec window 0.06..0.08, bumped 1.5x to compensate for
  // the parent Group blur, interpolated with the same baseAlpha-derived fade
  // as the main strokes.
  const hlAlphaFade = Math.min(1, baseAlpha / 0.54);
  const hlAlpha = Math.max(0.09, Math.min(0.12, 0.09 + hlAlphaFade * 0.03));
  // Highlight hue: clamp to [260,270] using a small downward drift so the
  // highlight tracks the ring without escaping the spec window.
  const hlHue = Math.max(260, Math.min(270, baseHue - t * 4));
  const hlPaint = Skia.Paint();
  hlPaint.setStyle(1);
  hlPaint.setAntiAlias(true);
  hlPaint.setStrokeWidth(
    (0.4 + (1 - t * 0.5) * 0.4) * (0.5 + (level - 1) * 0.12),
  );
  hlPaint.setColor(
    Skia.Color(
      hslaStr(
        hlHue,
        55 + level * 4,
        80 + Math.min(level, 3),
        hlAlpha,
      ),
    ),
  );
  hlPaint.setBlendMode(14);
  canvas.drawPath(highlightPath, hlPaint);

  // ── Pass 3: lavender shadow stroke offset y+1 (closed path) ──
  const shadowPath = Skia.Path.Make();
  shadowPath.moveTo(xs[0], ys[0] + 1);
  for (let s = 1; s <= SEGMENTS; s++) {
    shadowPath.lineTo(xs[s], ys[s] + 1);
  }
  shadowPath.close();
  // Shadow alpha: spec window 0.04..0.06, bumped 1.5x to survive the
  // parent Group blur.
  const shAlphaFade = Math.min(1, baseAlpha / 0.54);
  const shAlpha = Math.max(0.06, Math.min(0.09, 0.06 + shAlphaFade * 0.03));
  // Shadow hue: clamp to [260,270] with a small downward bias from baseHue.
  const shHue = Math.max(260, Math.min(270, baseHue - 5 - t * 2));
  const shPaint = Skia.Paint();
  shPaint.setStyle(1);
  shPaint.setAntiAlias(true);
  shPaint.setStrokeWidth(
    (0.4 + (1 - t * 0.5) * 0.4) * (0.5 + (level - 1) * 0.12),
  );
  shPaint.setColor(
    Skia.Color(
      hslaStr(
        shHue,
        55 + level * 3,
        70 + level * 2,
        shAlpha,
      ),
    ),
  );
  shPaint.setBlendMode(14);
  canvas.drawPath(shadowPath, shPaint);
}

/**
 * Floating luminous particles drifting between rings.
 * Count = 12 + (level - 1) * 9 → 12 (Lv1) ... 48 (Lv5).
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
  const particleCount = Math.floor(12 + (level - 1) * 9);
  const span = maxR - orbR - 30;

  const paint = Skia.Paint();
  paint.setStyle(0); // Fill
  paint.setAntiAlias(true);
  paint.setBlendMode(14); // Screen

  for (let i = 0; i < particleCount; i++) {
    const seed = i * 137.5;
    const orbitR =
      orbR + 22 + hash(seed, 0) * 0.5 * span + span * 0.5;
    const orbitSpeed =
      0.08 + hash(seed, 1) * 0.04 + level * 0.02;
    const angle = time * orbitSpeed * (i % 2 === 0 ? 1 : -1) + seed;

    const flutter =
      smooth(time * 0.3 + i * 0.7, i * 2.3) * 8 * (0.5 + level * 0.1);
    const r = orbitR + flutter;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);

    const pulse = 0.5 + 0.5 * Math.sin(time * 1.5 + i * 0.9);
    const alpha = (0.15 + pulse * 0.25) * (0.3 + (level - 1) * 0.18);
    // 1.0 .. 4.0 px particles — small drifting motes.
    const sizePx = 1.5 + pulse * 1.5 + level * 0.15;

    const hueP = 268 + hash(seed, 2) * 20;
    const sat = 60 + level * 5;

    paint.setColor(Skia.Color(hslaStr(hueP, sat, 82, alpha * 0.85)));
    canvas.drawCircle(x, y, sizePx, paint);
  }
}

/**
 * Soft pearl-lavender radial overlay around the dial.
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
    0, // Clamp
  );
  outerPaint.setShader(outerShader);
  outerPaint.setBlendMode(14); // Screen

  canvas.save();
  canvas.translate(cx, cy);
  canvas.rotate((time * 0.05 * 180) / Math.PI, 0, 0);
  canvas.translate(-cx, -cy);
  canvas.drawCircle(cx, cy, radius, outerPaint);
  canvas.restore();
}

/**
 * Vertical purple glow rising from the bottom of the canvas — bottom-most
 * draw so all rings sit on top of it.
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
  paint.setBlendMode(14); // Screen — keep glow additive over background
  canvas.drawRect({ x: 0, y: 0, width: size, height: size }, paint);
}
