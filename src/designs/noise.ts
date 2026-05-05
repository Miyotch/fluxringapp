/**
 * Pseudo-noise helpers ported from `Design11_NoiseOdyssey.tsx` (web).
 *
 * All functions are marked as worklets so they can be called from
 * react-native-reanimated `useDerivedValue` blocks running on the UI thread.
 */

export function hash(x: number, y: number): number {
  'worklet';
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

export function smooth(x: number, y: number): number {
  'worklet';
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  return (
    hash(ix, iy) * (1 - sx) * (1 - sy) +
    hash(ix + 1, iy) * sx * (1 - sy) +
    hash(ix, iy + 1) * (1 - sx) * sy +
    hash(ix + 1, iy + 1) * sx * sy
  );
}

export function fbm(x: number, y: number, oct: number): number {
  'worklet';
  let v = 0;
  let a = 1;
  let f = 1;
  let m = 0;
  for (let i = 0; i < oct; i++) {
    v += smooth(x * f, y * f) * a;
    m += a;
    a *= 0.5;
    f *= 2.1;
  }
  return v / m;
}

/** Domain warping: noise that distorts the input to another noise layer. */
export function warpedNoise(
  x: number,
  y: number,
  time: number,
  intensity: number,
): number {
  'worklet';
  const warpX = fbm(x + time * 0.05, y + time * 0.03, 3) * intensity;
  const warpY = fbm(x + 5.2 + time * 0.04, y + 1.3 + time * 0.06, 3) * intensity;
  return fbm(x + warpX, y + warpY, 4);
}

/** Ridged noise for sharp, dramatic features. */
export function ridgedNoise(x: number, y: number, time: number): number {
  'worklet';
  const n = fbm(x + time * 0.08, y + time * 0.06, 3);
  return 1.0 - Math.abs(n) * 2;
}

/** Map dial amplitude (0.2..4.0) to a discrete 1..5 level. */
export function amplitudeToLevel(amplitude: number): number {
  'worklet';
  const t = Math.max(0, Math.min(1, (amplitude - 0.2) / 3.8));
  return Math.min(5, Math.floor(t * 5) + 1);
}
