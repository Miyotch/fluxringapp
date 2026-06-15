import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Temporary on-screen diagnostics for TestFlight builds (no Mac required).
 *
 * The white-screen-at-launch bug can't be debugged via Console.app because
 * development happens on Windows. This overlay renders on top of the app
 * root and shows:
 *   - an uptime ticker (proves the JS event loop and rendering are alive —
 *     if the screen is pure white WITHOUT this banner, JS never rendered
 *     and the splash screen is stuck)
 *   - the last few global JS errors / console.error / console.warn lines
 *
 * Flip DIAGNOSTICS_ENABLED to false (or remove the component) once the
 * launch issue is resolved.
 */
export const DIAGNOSTICS_ENABLED = false;

const MAX_LINES = 8;

let lines: string[] = [];
const listeners = new Set<(next: string[]) => void>();

export function diagLog(message: string) {
  const stamp = new Date().toISOString().slice(11, 19);
  lines = [...lines.slice(-(MAX_LINES - 1)), `${stamp} ${message}`];
  listeners.forEach((notify) => notify(lines));
}

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorUtilsLike {
  getGlobalHandler(): GlobalErrorHandler | undefined;
  setGlobalHandler(handler: GlobalErrorHandler): void;
}

let hooksInstalled = false;

function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      const message = error instanceof Error ? error.message : String(error);
      diagLog(`JSError${isFatal ? ' (fatal)' : ''}: ${message}`.slice(0, 300));
      previous?.(error, isFatal);
    });
  }

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    diagLog(`error: ${args.map((a) => String(a)).join(' ')}`.slice(0, 300));
    originalError(...args);
  };

  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    diagLog(`warn: ${args.map((a) => String(a)).join(' ')}`.slice(0, 300));
    originalWarn(...args);
  };
}

if (DIAGNOSTICS_ENABLED) {
  installHooks();
  diagLog('diagnostics installed');
}

export function DiagnosticsOverlay() {
  const [entries, setEntries] = useState<string[]>(lines);
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const notify = (next: string[]) => setEntries([...next]);
    listeners.add(notify);
    const timer = setInterval(() => setUptime((s) => s + 1), 1000);
    return () => {
      listeners.delete(notify);
      clearInterval(timer);
    };
  }, []);

  if (!DIAGNOSTICS_ENABLED) return null;

  return (
    <View pointerEvents="none" style={styles.banner}>
      <Text style={styles.title}>DIAG alive {uptime}s</Text>
      {entries.map((line, i) => (
        <Text key={i} style={styles.line}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: 'rgba(180, 30, 30, 0.85)',
    borderRadius: 6,
    padding: 8,
  },
  title: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  line: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Courier',
  },
});
