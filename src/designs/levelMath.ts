/**
 * Pure helpers used by the FluxRingDial / HomeScreen.
 * Web-only Canvas 2D rendering helpers have been removed; rendering now lives
 * inside `src/components/ring/FluxRingDial.tsx` (react-native-skia).
 */

/** Map dial amplitude (0.2–4.0) to a discrete level 1–5. */
export function amplitudeToLevel(amplitude: number): number {
  const t = Math.max(0, Math.min(1, (amplitude - 0.2) / 3.8));
  return Math.min(5, Math.floor(t * 5) + 1);
}
