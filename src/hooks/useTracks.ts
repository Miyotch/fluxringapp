import { useState, useEffect } from 'react';
import { onTracksSnapshot } from '../services/firestore';
import type { Track } from '../types/track';

export function useTracks() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onTracksSnapshot((data) => {
      setTracks(data);
      setLoading(false);
      setError(null);
    });

    return unsubscribe;
  }, []);

  return { tracks, loading, error };
}
