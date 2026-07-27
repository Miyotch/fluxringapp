/**
 * ownership.ts — 所有権（買い切りで手に入れた作品）の読み出し
 * ------------------------------------------------------------------
 * ■ 正は Firestore `users/{uid}/purchases/{trackId}`
 *   ドキュメントID = trackId（= audioKey）。infra/r2-audio-worker.js が
 *   期待する `users/{uid}/purchases/{audioKey}` とそのまま一致し、同じ作品を
 *   二重に購入しても同じ doc に収束する（冪等）。
 *
 * ■ クライアントは**書かない**
 *   書けるようにすると ownedIds を偽装するだけでフル音源（¥2,500 の対価）が
 *   取れてしまい、Worker の所有権判定が無意味になる。書き込みは
 *   サービスアカウントを持つサーバのみ。Firestore ルール側で
 *   read: request.auth.uid == uid / write: false にしておくこと
 *   （ルールファイルはリポジトリに無く、本環境からは現状を確認できていない）。
 *
 * ■ AsyncStorage キャッシュは表示専用
 *   起動直後のコレクションのちらつき防止にのみ使う。改ざん可能である前提で、
 *   音源配信の可否には一切使わない（Worker が Firestore を見る）。
 *   サインアウト時に破棄する。
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { subscribeUserPurchases } from './firebaseFirestore'

/** uid ごとのキャッシュキー。uid を混ぜるのは別アカウントの所有が混ざらないため */
const cacheKey = (uid: string) => `fluxring.owned.${uid}`

/** 表示用キャッシュの読み出し（失敗しても空で続行する） */
export async function loadCachedOwnedIds(uid: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(uid))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/** 表示用キャッシュの保存 */
export async function saveCachedOwnedIds(uid: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(uid), JSON.stringify(ids))
  } catch {
    /* 保存に失敗してもアプリの動作には影響しない */
  }
}

/** サインアウト・退会時に破棄 */
export async function clearCachedOwnedIds(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey(uid))
  } catch {
    /* 同上 */
  }
}

/**
 * Firestore の所有権を購読する。
 * `revokedAt` が立っているドキュメントは所有から外す（返金・失効の反映）。
 * 返金通知（App Store Server Notifications V2 / Google RTDN）の受け口は
 * サーバ側の未実装項目。ここは受け取り側の準備だけ先に入れてある。
 */
export function subscribeOwnedIds(
  uid: string,
  onChange: (ids: string[]) => void,
): () => void {
  try {
    return subscribeUserPurchases(
      uid,
      (docs) => {
        const ids = docs
          .filter((d) => !d.revokedAt)
          .map((d) => d.id)
        onChange(ids)
      },
      () => {
        // 権限エラー／オフライン。キャッシュ表示のまま続行する
      },
    )
  } catch {
    return () => {}
  }
}
