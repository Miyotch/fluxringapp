/**
 * r2.ts — Cloudflare R2 の音源URL解決
 * ------------------------------------------------------------------
 * 試聴（公開）とフル音源（所有者のみ・署名付き）を出し分ける。
 */

import {
  R2_PREVIEW_BASE,
  R2_WORKER_URL,
  isPreviewConfigured,
  isFullAudioConfigured,
} from '../constants/mediaConfig'
import { auth } from './firebase'

/**
 * 試聴（30秒）URL。公開バケット/カスタムドメインから直接取得。
 * 未設定なら null（試聴不可）。
 * 音源形式は MP3（R2 にアップロード済みのファイル形式に合わせる）。
 */
export function previewUrl(audioKey: string): string | null {
  if (!isPreviewConfigured || !audioKey) return null
  return `${R2_PREVIEW_BASE}/preview/${encodeURIComponent(audioKey)}.mp3`
}

/**
 * フル音源URL。Worker が Firebase ID トークンで所有権を確認し、
 * 非公開バケットの短命な署名付きURLを返す。
 * - 未ログイン / 未所有 / 未設定 は例外。
 */
export async function fullAudioUrl(audioKey: string): Promise<string> {
  if (!isFullAudioConfigured) throw new Error('音源配信が未設定です（app.json extra.r2.workerUrl）')
  if (!audioKey) throw new Error('audioKey がありません')

  const user = auth.currentUser
  if (!user) throw new Error('ログインが必要です')

  const idToken = await user.getIdToken()
  const res = await fetch(`${R2_WORKER_URL}/track/${encodeURIComponent(audioKey)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })

  if (res.status === 403) throw new Error('この楽曲を所有していません')
  if (!res.ok) throw new Error(`音源の取得に失敗しました (${res.status})`)

  const data = (await res.json()) as { url?: string }
  if (!data.url) throw new Error('署名付きURLが取得できませんでした')
  return data.url
}
