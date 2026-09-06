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
// 楽曲情報（サムネイル・R2音源URL等）。旧 sound コレクションから移行。
// ドキュメントIDが所有権判定のtrackId（= audioKey）と一致する前提。
export const tracksCol   = () => collection(db, 'tracks')

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

// ── ユーザーの所有権をリアルタイム監視（購入直後の反映用）───
// orderBy を付けないのは、所有集合に順序が要らないうえ、purchasedAt を
// 持たないドキュメント（旧データ・grant 付与の書き漏れ）を orderBy が
// 黙って除外してしまい「買ったのに所有されていない」ように見えるため。
export const subscribeUserPurchases = (
  uid: string,
  callback: (docs: Array<{ id: string } & Record<string, unknown>>) => void,
  onError?: (e: Error) => void,
): Unsubscribe =>
  onSnapshot(
    collection(db, 'users', uid, 'purchases'),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError,
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

// ── メディア：記事一覧を新着順で購読（コレクション article）───
export const articlesCol = () => collection(db, 'article')

export const subscribeArticles = (
  count: number,
  callback: (docs: Array<{ id: string } & Record<string, unknown>>) => void,
  onError?: (e: Error) => void,
): Unsubscribe =>
  onSnapshot(
    query(articlesCol(), orderBy('published', 'desc'), limit(count)),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError,
  )

// ── 楽曲の試聴URL（tracks/{id}.r2_preview_url）をリアルタイム監視 ───
// ドキュメントが無い／フィールドが空文字・未設定なら null（試聴なし）を返す。
// フル音源（tracks/{id}.r2_url）は未購入ユーザーにも見えるここでは読まない。
// 所有権確認後にサーバ側（infra/r2-audio-worker.js）でのみ解決する。
export const subscribeTrackPreview = (
  id: string,
  callback: (url: string | null) => void,
  onError?: (e: Error) => void,
): Unsubscribe =>
  onSnapshot(
    doc(db, 'tracks', id),
    snap => {
      const v = snap.exists() ? (snap.data() as { r2_preview_url?: unknown }).r2_preview_url : null
      callback(typeof v === 'string' && v.trim() !== '' ? v : null)
    },
    onError,
  )
