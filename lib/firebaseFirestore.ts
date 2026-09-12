import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  startAfter,
  Timestamp,
  onSnapshot,
  Unsubscribe,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'

// ── コレクション参照 ──────────────────────────────
export const artworksCol = () => collection(db, 'artworks')
export const artistsCol  = () => collection(db, 'artists')
// SNSアイコンのマスタ（アイコン画像URL・表示名）。artists.snsLinks[].typeId から引く
export const snsTypeCol  = () => collection(db, 'sns_type')
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

// ── メディア：記事一覧をページング取得（コレクション article）───
// 表示条件: published===true（CMS側の公開フラグ）かつ date<=現在時刻
// （公開日時が未来のものはまだ出さない）。並び順は date の降順（新しいものが上）。
// ※ published は公開/非公開フラグ（真偽値）であって公開日時ではない。
//   公開日時は別フィールドの date（Timestamp）。
export const articlesCol = () => collection(db, 'article')

export const fetchArticlesPage = (
  pageSize: number,
  cursor?: QueryDocumentSnapshot<DocumentData>,
) => {
  const constraints: QueryConstraint[] = [
    where('published', '==', true),
    where('date', '<=', Timestamp.now()),
    orderBy('date', 'desc'),
    limit(pageSize),
  ]
  if (cursor) constraints.push(startAfter(cursor))
  return getDocs(query(articlesCol(), ...constraints))
}

// ── 楽曲一覧をリアルタイム監視（コレクション tracks）───────
export const subscribeTracks = (
  count: number,
  callback: (docs: Array<{ id: string } & Record<string, unknown>>) => void,
  onError?: (e: Error) => void,
): Unsubscribe =>
  onSnapshot(
    query(tracksCol(), orderBy('publishedAt', 'desc'), limit(count)),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError,
  )
