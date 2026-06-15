import { useEffect, useState, useRef } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from '../services/auth';
import { syncUserProfile } from '../services/firestore';

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
      setState((prev) => (prev.loading ? { user: null, loading: false } : prev));
    }, 8000);

    const unsubscribe = onAuthStateChanged((user) => {
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
