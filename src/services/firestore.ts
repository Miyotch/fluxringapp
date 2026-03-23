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

export async function getTracks(): Promise<Track[]> {
  const q = query(collection(db(), 'tracks'), orderBy('order'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
  })) as Track[];
}

export function onTracksSnapshot(
  callback: (tracks: Track[]) => void,
): () => void {
  const q = query(collection(db(), 'tracks'), orderBy('order'));
  return onSnapshot(q, (snapshot) => {
    const tracks = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
    })) as Track[];
    callback(tracks);
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
