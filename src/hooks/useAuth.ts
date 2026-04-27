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
    const unsubscribe = onAuthStateChanged((user) => {
      setState({ user, loading: false });
      if (user && user.uid !== syncedUidRef.current) {
        syncedUidRef.current = user.uid;
        syncUserProfile(user).catch((err) =>
          console.warn('User profile sync failed:', err),
        );
      }
      if (!user) syncedUidRef.current = null;
    });
    return unsubscribe;
  }, []);

  return state;
}
