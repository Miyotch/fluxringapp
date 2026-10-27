/** Band-limited pink noise: power ~ 1/f between 8 and 128 seconds.
 * Periodic endpoints allow a seamless native loop; no per-frame JS work.
 */
export const PINK_SECONDS = 1024;
export function pinkSamples(seed: number): number[] {
  let state = seed >>> 0;
  const phases = Array.from({ length: 121 }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296 * Math.PI * 2;
  });
  const samples = Array.from({ length: PINK_SECONDS }, (_, t) =>
    phases.reduce((sum, phase, i) => {
      const k = i + 8;
      return sum + Math.cos(2 * Math.PI * k * t / PINK_SECONDS + phase) / Math.sqrt(k);
    }, 0));
  const max = Math.max(...samples.map(Math.abs));
  const normalized = samples.map(value => value / max);
  return [...normalized, normalized[0]];
}
export const PINK_INPUT = Array.from({ length: PINK_SECONDS + 1 }, (_, i) => i / PINK_SECONDS);
export const NEBULA_MORPH = pinkSamples(20261026);
export const NEBULA_LIGHT = pinkSamples(777);
export const CLOUD_SIGNALS = [20261026, 1739, 9107].map(seed => ({
  density: pinkSamples(seed),
  horizontal: pinkSamples(seed + 419),
  vertical: pinkSamples(seed + 821),
}));
