import firestore from '@react-native-firebase/firestore';
import type { Track, Playlist, Article } from '../types/track';

const db = firestore();

export async function getTracks(): Promise<Track[]> {
  const snapshot = await db.collection('tracks').orderBy('order').get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() ?? new Date(),
  })) as Track[];
}

export function onTracksSnapshot(
  callback: (tracks: Track[]) => void
): () => void {
  return db
    .collection('tracks')
    .orderBy('order')
    .onSnapshot((snapshot) => {
      const tracks = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() ?? new Date(),
      })) as Track[];
      callback(tracks);
    });
}

export async function getPlaylists(userId: string): Promise<Playlist[]> {
  const snapshot = await db
    .collection('playlists')
    .where('userId', '==', userId)
    .get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() ?? new Date(),
  })) as Playlist[];
}

export async function getArticles(): Promise<Article[]> {
  const snapshot = await db
    .collection('articles')
    .orderBy('publishedAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    publishedAt: doc.data().publishedAt?.toDate() ?? new Date(),
  })) as Article[];
}

export async function toggleFavorite(
  userId: string,
  trackId: string
): Promise<void> {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  const favorites: string[] = userDoc.data()?.favorites ?? [];

  if (favorites.includes(trackId)) {
    await userRef.update({
      favorites: firestore.FieldValue.arrayRemove(trackId),
    });
  } else {
    await userRef.update({
      favorites: firestore.FieldValue.arrayUnion(trackId),
    });
  }
}
