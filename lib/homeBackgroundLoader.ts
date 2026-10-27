/** Bounded recovery: retry transient failures, pause retries offscreen, and discard stale results. */
export function createHomeBackgroundLoader<T>({ load, onReady, onError }: {
  load: () => Promise<T>; onReady: (value: T) => void; onError: (error: unknown) => void;
}) {
  const delays = [1000, 3000, 10000];
  let active = false, cancelled = false, ready = false, inFlight = false, failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const run = async () => {
    if (!active || cancelled || ready || inFlight) return;
    inFlight = true;
    try {
      const result = await load();
      if (!cancelled) { ready = true; onReady(result); }
    } catch (error) {
      if (!cancelled) {
        onError(error);
        const delay = delays[failures++];
        if (active && delay !== undefined) timer = setTimeout(() => { timer = undefined; void run(); }, delay);
      }
    } finally { inFlight = false; }
  };
  return {
    setActive(value: boolean) {
      if (cancelled || active === value) return;
      active = value;
      clear();
      if (active) { failures = 0; void run(); }
    },
    cancel() { cancelled = true; active = false; clear(); },
  };
}
