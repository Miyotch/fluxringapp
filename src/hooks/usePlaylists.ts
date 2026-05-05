import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

let memoryCache: Playlist[] = DEFAULT_PLAYLISTS;
let hydrated = false;

async function loadPlaylists(): Promise<Playlist[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Playlist[];
      const hasFavorites = parsed.some((p) => p.id === 'favorites');
      const next = hasFavorites ? parsed : [DEFAULT_PLAYLISTS[0], ...parsed];
      memoryCache = next;
      return next;
    }
  } catch {
    // ignore parse errors
  }
  memoryCache = DEFAULT_PLAYLISTS;
  return DEFAULT_PLAYLISTS;
}

async function savePlaylists(playlists: Playlist[]): Promise<void> {
  memoryCache = playlists;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
  } catch {
    // ignore storage errors
  }
}

const listeners = new Set<(next: Playlist[]) => void>();

function notify(next: Playlist[]) {
  listeners.forEach((l) => l(next));
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>(memoryCache);

  useEffect(() => {
    const update = (next: Playlist[]) => setPlaylists(next);
    listeners.add(update);
    if (!hydrated) {
      hydrated = true;
      loadPlaylists().then((p) => notify(p));
    } else {
      setPlaylists(memoryCache);
    }
    return () => {
      listeners.delete(update);
    };
  }, []);

  const persist = useCallback(async (next: Playlist[]) => {
    await savePlaylists(next);
    notify(next);
  }, []);

  const addTrack = useCallback(
    (playlistId: string, trackId: string) => {
      const next = memoryCache.map((p) => {
        if (p.id !== playlistId) return p;
        if (p.trackIds.includes(trackId)) return p;
        return { ...p, trackIds: [...p.trackIds, trackId] };
      });
      void persist(next);
    },
    [persist],
  );

  const removeTrack = useCallback(
    (playlistId: string, trackId: string) => {
      const next = memoryCache.map((p) =>
        p.id === playlistId
          ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) }
          : p,
      );
      void persist(next);
    },
    [persist],
  );

  const toggleFavorite = useCallback(
    (trackId: string) => {
      const next = memoryCache.map((p) => {
        if (p.id !== 'favorites') return p;
        const has = p.trackIds.includes(trackId);
        return {
          ...p,
          trackIds: has
            ? p.trackIds.filter((id) => id !== trackId)
            : [...p.trackIds, trackId],
        };
      });
      void persist(next);
    },
    [persist],
  );

  const createPlaylist = useCallback(
    (name: string, hue: number): string => {
      const id = String(Date.now());
      const next = [
        ...memoryCache,
        { id, name, hue, trackIds: [] },
      ];
      void persist(next);
      return id;
    },
    [persist],
  );

  /**
   * Create a new playlist and immediately add a track to it. Returns the new
   * playlist id.
   */
  const createPlaylistWithTrack = useCallback(
    (name: string, hue: number, trackId: string): string => {
      const id = String(Date.now());
      const next = [
        ...memoryCache,
        { id, name, hue, trackIds: [trackId] },
      ];
      void persist(next);
      return id;
    },
    [persist],
  );

  const updatePlaylist = useCallback(
    (id: string, name: string, hue: number) => {
      const next = memoryCache.map((p) => (p.id === id ? { ...p, name, hue } : p));
      void persist(next);
    },
    [persist],
  );

  const deletePlaylist = useCallback(
    (id: string) => {
      if (id === 'favorites') return;
      const next = memoryCache.filter((p) => p.id !== id);
      void persist(next);
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
    createPlaylistWithTrack,
    updatePlaylist,
    deletePlaylist,
    isFavorite,
    // Friendlier aliases used by the playlist screen / modals.
    addPlaylist: createPlaylist,
    removePlaylist: deletePlaylist,
    addTrackToPlaylist: addTrack,
    removeTrackFromPlaylist: removeTrack,
  };
}
