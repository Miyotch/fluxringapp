import { useState, useEffect, useCallback } from 'react';

export interface Playlist {
  id: string;
  name: string;
  hue: number;
  trackIds: string[];
}

const STORAGE_KEY = 'fluxring.playlists';

const DEFAULT_PLAYLISTS: Playlist[] = [
  { id: 'favorites', name: 'お気に入り', hue: 320, trackIds: [] },
  { id: 'focus', name: '集中モード', hue: 260, trackIds: [] },
  { id: 'relax', name: 'リラックス', hue: 195, trackIds: [] },
];

function loadPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Playlist[];
      // Ensure favorites playlist always exists
      const hasFavorites = parsed.some((p) => p.id === 'favorites');
      if (!hasFavorites) {
        return [DEFAULT_PLAYLISTS[0], ...parsed];
      }
      return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_PLAYLISTS;
}

function savePlaylists(playlists: Playlist[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
  } catch {
    // ignore storage errors
  }
}

// Simple pub-sub so multiple components stay in sync
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>(loadPlaylists);

  useEffect(() => {
    const update = () => setPlaylists(loadPlaylists());
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const persist = useCallback((next: Playlist[]) => {
    savePlaylists(next);
    notify();
  }, []);

  const addTrack = useCallback(
    (playlistId: string, trackId: string) => {
      const cur = loadPlaylists();
      const next = cur.map((p) => {
        if (p.id !== playlistId) return p;
        if (p.trackIds.includes(trackId)) return p;
        return { ...p, trackIds: [...p.trackIds, trackId] };
      });
      persist(next);
    },
    [persist],
  );

  const removeTrack = useCallback(
    (playlistId: string, trackId: string) => {
      const cur = loadPlaylists();
      const next = cur.map((p) =>
        p.id === playlistId
          ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) }
          : p,
      );
      persist(next);
    },
    [persist],
  );

  const toggleFavorite = useCallback(
    (trackId: string) => {
      const cur = loadPlaylists();
      const next = cur.map((p) => {
        if (p.id !== 'favorites') return p;
        const has = p.trackIds.includes(trackId);
        return {
          ...p,
          trackIds: has
            ? p.trackIds.filter((id) => id !== trackId)
            : [...p.trackIds, trackId],
        };
      });
      persist(next);
    },
    [persist],
  );

  const createPlaylist = useCallback(
    (name: string, hue: number) => {
      const cur = loadPlaylists();
      const next = [
        ...cur,
        { id: String(Date.now()), name, hue, trackIds: [] },
      ];
      persist(next);
    },
    [persist],
  );

  const updatePlaylist = useCallback(
    (id: string, name: string, hue: number) => {
      const cur = loadPlaylists();
      const next = cur.map((p) => (p.id === id ? { ...p, name, hue } : p));
      persist(next);
    },
    [persist],
  );

  const deletePlaylist = useCallback(
    (id: string) => {
      if (id === 'favorites') return; // protect favorites
      const cur = loadPlaylists();
      const next = cur.filter((p) => p.id !== id);
      persist(next);
    },
    [persist],
  );

  const isFavorite = useCallback(
    (trackId: string) => {
      const fav = playlists.find((p) => p.id === 'favorites');
      return fav?.trackIds.includes(trackId) ?? false;
    },
    [playlists],
  );

  return {
    playlists,
    addTrack,
    removeTrack,
    toggleFavorite,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    isFavorite,
  };
}
