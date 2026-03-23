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

function docToTrack(d: import('firebase/firestore').QueryDocumentSnapshot): Track {
  const data = d.data();
  return {
    id: d.id,
    title: data.title ?? '',
    artist: data.artist ?? 'Flux Ring',
    duration: data.duration ?? 0,
    artworkUrl: data.artworkUrl ?? data.artwork_url ?? '',
    audioUrl: data.audioUrl ?? data.audio_url ?? '',
    description: data.description ?? '',
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    order: data.order ?? 0,
  };
}

export async function getTracks(): Promise<Track[]> {
  const q = query(collection(db(), 'sound'), orderBy('order'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToTrack);
}

export function onTracksSnapshot(
  callback: (tracks: Track[]) => void,
): () => void {
  const q = query(collection(db(), 'sound'), orderBy('order'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(docToTrack));
  });
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
