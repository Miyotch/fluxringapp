import { useEffect, useState, useRef } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from '../services/auth';
import { syncUserProfile } from '../services/firestore';
import { diagLog } from '../components/diagnostics/DiagnosticsOverlay';

export interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  const syncedUidRef = useRef<string | null>(null);

  useEffect(() => {
    // Watchdog: if Firebase Auth never emits (e.g. the native persistence
    // layer hangs at launch), fall through to the login screen instead of
    // leaving the splash gate stuck forever.
    const watchdog = setTimeout(() => {
      diagLog('auth watchdog fired (no auth event in 8s)');
      setState((prev) => (prev.loading ? { user: null, loading: false } : prev));
    }, 8000);

    const unsubscribe = onAuthStateChanged((user) => {
      diagLog(`auth event: ${user ? `uid=${user.uid.slice(0, 8)}…` : 'signed out'}`);
      clearTimeout(watchdog);
      setState({ user, loading: false });
      if (user && user.uid !== syncedUidRef.current) {
        syncedUidRef.current = user.uid;
        syncUserProfile(user).catch((err) =>
          console.warn('User profile sync failed:', err),
        );
      }
      if (!user) syncedUidRef.current = null;
    });
    return () => {
      clearTimeout(watchdog);
      unsubscribe();
    };
  }, []);

  return state;
}
