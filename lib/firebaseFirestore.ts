import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'

// ── コレクション参照 ──────────────────────────────
export const artworksCol = () => collection(db, 'artworks')
export const artistsCol  = () => collection(db, 'artists')
export const usersCol    = () => collection(db, 'users')

// ── ディスカバー：全楽曲を新着順で取得 ─────────────
export const fetchArtworks = (count = 20) =>
  getDocs(query(artworksCol(), orderBy('releaseAt', 'desc'), limit(count)))

// ── 作品単体 ───────────────────────────────────
export const fetchArtwork = (id: string) =>
  getDoc(doc(db, 'artworks', id))

// ── 作家プロフィール ─────────────────────────────
export const fetchArtist = (id: string) =>
  getDoc(doc(db, 'artists', id))

// ── ユーザーの所有楽曲一覧（コレクション P3）───────
export const fetchUserCollection = (uid: string) =>
  getDocs(
    query(
      collection(db, 'users', uid, 'purchases'),
      orderBy('purchasedAt', 'desc'),
    ),
  )

// ── ディスカバー リアルタイム監視 ──────────────────
export const subscribeArtworks = (
  count: number,
  callback: (docs: any[]) => void,
): Unsubscribe =>
  onSnapshot(
    query(artworksCol(), orderBy('releaseAt', 'desc'), limit(count)),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
  )
