import {
  getFirestore,
  collection,
  query,
  orderBy,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayRemove,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { Track, Playlist, Article } from '../types/track';
import { initFirebase } from './firebase';

function db() {
  return getFirestore(initFirebase());
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
    audioUrl: data.r2_url ?? data.sound ?? data.audioUrl ?? '',
    previewUrl: data.preview ?? '',
    description: data.comment ?? data.description ?? '',
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    order: data.level ?? data.order ?? 0,
    paidMusic: data.paid_music === true,
    frequencyMode: data.frequency_mode === true,
    melodyMode: data.melody_mode === true,
    earphoneOptimized: data.earphone_optimized === true,
    speakerOptimized: data.speaker_optimized === true,
    noiseLevel: typeof data.noise_level === 'number' ? data.noise_level : 50,
    toneCharacter: typeof data.tone_character === 'number' ? data.tone_character : 50,
    rhythmIntensity: typeof data.rhythm_intensity === 'number' ? data.rhythm_intensity : 50,
    justIntonation: data.just_intonation === true,
    equalTemperament: data.equal_temperament !== false,
    rootFrequency: data.root_frequency ?? '440',
    brainwaveEntrainment: data.brainwave_entrainment ?? 'OFF',
    pinkNoiseFluctuation: data.pink_noise_fluctuation === true,
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

function docToArticle(d: import('firebase/firestore').QueryDocumentSnapshot): Article {
  const data = d.data();
  return {
    id: d.id,
    title: data.title ?? '',
    subtitle: data.subtitle ?? '',
    descriptions: data.descriptions ?? '',
    date: data.date?.toDate?.() ?? new Date(),
    published: data.published === true,
    stable: data.stable === true,
    externalLink: data.external_link ?? '',
    thumbnail: data.thumbnail ?? '',
  };
}

export async function getArticles(): Promise<Article[]> {
  const q = query(collection(db(), 'article'), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToArticle).filter((a) => a.published);
}

export function onArticlesSnapshot(
  callback: (articles: Article[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db(), 'article'), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const all = snapshot.docs.map(docToArticle);
      callback(all.filter((a) => a.published));
    },
    (error) => {
      console.error('Firestore article snapshot error:', error);
      onError?.(error);
    },
  );
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

/**
 * Sync authenticated user profile to Firestore users/{uid}.
 * Creates the document if it doesn't exist (with user_type: 'free').
 * Merges displayName / email / photoURL / provider on every login.
 */
export async function syncUserProfile(user: User): Promise<void> {
  const userRef = doc(db(), 'users', user.uid);
  const snap = await getDoc(userRef);

  const providerIds = user.providerData.map((p) => p.providerId);

  if (!snap.exists()) {
    await setDoc(userRef, {
      email: user.email ?? '',
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? '',
      providers: providerIds,
      user_type: 'free',
      admin: false,
      created_time: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    const updates: Record<string, unknown> = {
      email: user.email ?? '',
      photoURL: user.photoURL ?? '',
      providers: providerIds,
      updatedAt: serverTimestamp(),
    };
    // Only overwrite Firestore displayName when Auth has one set (e.g. Google/Apple),
    // so a username saved via setup-username is not cleared on email-password login.
    if (user.displayName) {
      updates.displayName = user.displayName;
    }
    await updateDoc(userRef, updates);
  }
}
