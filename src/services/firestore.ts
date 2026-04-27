import {
  getFirestore,
  collection,
  query,
  orderBy,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  arrayRemove,
  arrayUnion,
} from 'firebase/firestore';
import type { Track, Playlist, Article } from '../types/track';

function db() {
  return getFirestore();
}

function parseDuration(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parts = value.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    const n = parseInt(value, 10);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function docToTrack(d: import('firebase/firestore').QueryDocumentSnapshot): Track {
  const data = d.data();
  return {
    id: d.id,
    title: data.sound_name ?? data.title ?? '',
    artist: data.artist ?? 'Flux Ring',
    duration: parseDuration(data.length ?? data.duration),
    artworkUrl: data.thumnail ?? data.artworkUrl ?? '',
    audioUrl: data.sound ?? data.audioUrl ?? '',
    previewUrl: data.preview ?? '',
    description: data.comment ?? data.description ?? '',
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    order: data.level ?? data.order ?? 0,
    paidMusic: data.paid_music === true,
  };
}

function sortTracks(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => a.order - b.order);
}

export async function getTracks(): Promise<Track[]> {
  const snapshot = await getDocs(collection(db(), 'sound'));
  return sortTracks(snapshot.docs.map(docToTrack));
}

export function onTracksSnapshot(
  callback: (tracks: Track[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    collection(db(), 'sound'),
    (snapshot) => {
      callback(sortTracks(snapshot.docs.map(docToTrack)));
    },
    (error) => {
      console.error('Firestore snapshot error:', error);
      onError?.(error);
    },
  );
}

export async function getPlaylists(userId: string): Promise<Playlist[]> {
  const q = query(
    collection(db(), 'playlists'),
    where('userId', '==', userId),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
  })) as Playlist[];
}

export async function getArticles(): Promise<Article[]> {
  const q = query(
    collection(db(), 'articles'),
    orderBy('publishedAt', 'desc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    publishedAt: d.data().publishedAt?.toDate?.() ?? new Date(),
  })) as Article[];
}

export async function toggleFavorite(
  userId: string,
  trackId: string,
): Promise<void> {
  const userRef = doc(db(), 'users', userId);
  const userDoc = await getDoc(userRef);
  const favorites: string[] = userDoc.data()?.favorites ?? [];

  if (favorites.includes(trackId)) {
    await updateDoc(userRef, { favorites: arrayRemove(trackId) });
  } else {
    await updateDoc(userRef, { favorites: arrayUnion(trackId) });
  }
}
