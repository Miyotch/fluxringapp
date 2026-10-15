/**
 * r2.ts — Cloudflare R2 の音源URL解決
 * ------------------------------------------------------------------
 * 試聴（公開）とフル音源を出し分ける。
 *
 * 2026-10-15: infra/audio-gateway（署名URL・所有権確認・購入検証）を用意した。
 * extra.r2.workerUrl を入れると、フル音源はそちら経由になる（下の fullAudioUrl）。
 * 以下は移行前（未設定）の状態の説明。
 *
 * フル音源は tracks/{trackId}.r2_url（Cloudflare R2の公開バケット
 * music-app-storage に置かれた完全URL）を Firestore から直接読む。
 * infra/audio-gateway（Firebase認証＋所有権確認を挟んでR2の非公開
 * バケットから配信するテンプレート）はデプロイされておらず
 * （app.json の extra.r2.workerUrl も未設定）、実際のバケットも公開設定の
 * ため、現状はURLを知っていれば誰でも取得できる点に注意
 * （所有権はアプリのUI上でのみ制御している）。将来的に本当の意味での
 * アクセス制御をするなら、Worker を実際にデプロイするか、Firestore
 * セキュリティルールで r2_url を購入者のみ読み取り可能な別ドキュメント
 * （例: tracks/{id}/private/audio）に分離する対応が必要。
 */

import { doc, getDoc } from 'firebase/firestore'
import { R2_PREVIEW_BASE, R2_WORKER_URL, isPreviewConfigured } from '../constants/mediaConfig'
import { auth, db } from './firebase'

/**
 * 試聴（30秒）URL。公開バケット/カスタムドメインから直接取得。
 * 未設定なら null（試聴不可）。
 * 音源形式は WAV。R2 のファイルはバケット直下に置かれている想定
 *   （例: {base}/blue.wav）。フォルダに入れる場合はここのパスを合わせる。
 */
export function previewUrl(audioKey: string): string | null {
  if (!isPreviewConfigured || !audioKey) return null
  return `${R2_PREVIEW_BASE}/${encodeURIComponent(audioKey)}.wav`
}

/**
 * フル音源URL。
 * - audio-gateway（app.json の extra.r2.workerUrl）が設定されていれば、そこへ
 *   Firebase の ID トークンを付けて署名URLをもらう。持っていない曲は 403 で例外。
 *   署名URLは 6 時間で切れるので、切れる 10 分前まで曲ごとに使い回す。
 * - 未設定（移行前）は従来どおり tracks/{trackId}.r2_url を Firestore から読む。
 * - 未ログイン / 未設定（ドキュメント無し・r2_url未設定）は例外。
 */
const signedCache = new Map<string, { url: string; until: number }>()

export async function fullAudioUrl(trackId: string): Promise<string> {
  if (!trackId) throw new Error('trackId がありません')

  const user = auth.currentUser
  if (!user) throw new Error('ログインが必要です')

  if (R2_WORKER_URL) {
    const key = `${user.uid}:${trackId}`
    const hit = signedCache.get(key)
    if (hit && Date.now() < hit.until) return hit.url
    const res = await fetch(`${R2_WORKER_URL}/v1/stream-url`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trackId }),
    })
    if (res.status === 403) throw new Error('この楽曲はまだ所有していません')
    if (!res.ok) throw new Error(`音源のURLを取得できませんでした (${res.status})`)
    const body = (await res.json()) as { url?: string; expiresAt?: number }
    if (!body.url) throw new Error('音源のURLを取得できませんでした')
    signedCache.set(key, { url: body.url, until: (body.expiresAt ?? Date.now() + 3600_000) - 10 * 60_000 })
    return body.url
  }

  const snap = await getDoc(doc(db, 'tracks', trackId))
  const url = snap.exists() ? (snap.data() as { r2_url?: unknown }).r2_url : null
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('この楽曲の音源が見つかりません（tracks.r2_url 未設定）')
  }
  return url
}
