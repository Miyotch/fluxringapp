/** Wall-clock deadline: track changes and pauses do not extend the timer. */
export function sleepGain(deadline: number, now: number): number {
  return Math.max(0, Math.min(1, (deadline - now) / 30000));
}
