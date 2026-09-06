/**
 * r2.ts — Cloudflare R2 の音源URL解決
 * ------------------------------------------------------------------
 * 試聴（公開）とフル音源を出し分ける。
 *
 * フル音源は tracks/{trackId}.r2_url（Cloudflare R2の公開バケット
 * music-app-storage に置かれた完全URL）を Firestore から直接読む。
 * infra/r2-audio-worker.js（Firebase認証＋所有権確認を挟んでR2の非公開
 * バケットから配信するテンプレート）はデプロイされておらず
 * （app.json の extra.r2.workerUrl も未設定）、実際のバケットも公開設定の
 * ため、現状はURLを知っていれば誰でも取得できる点に注意
 * （所有権はアプリのUI上でのみ制御している）。将来的に本当の意味での
 * アクセス制御をするなら、Worker を実際にデプロイするか、Firestore
 * セキュリティルールで r2_url を購入者のみ読み取り可能な別ドキュメント
 * （例: tracks/{id}/private/audio）に分離する対応が必要。
 */

import { doc, getDoc } from 'firebase/firestore'
import { R2_PREVIEW_BASE, isPreviewConfigured } from '../constants/mediaConfig'
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
 * フル音源URL。tracks/{trackId}.r2_url を Firestore から読み、そのまま返す。
 * - 未ログイン / 未設定（ドキュメント無し・r2_url未設定）は例外。
 */
export async function fullAudioUrl(trackId: string): Promise<string> {
  if (!trackId) throw new Error('trackId がありません')

  const user = auth.currentUser
  if (!user) throw new Error('ログインが必要です')

  const snap = await getDoc(doc(db, 'tracks', trackId))
  const url = snap.exists() ? (snap.data() as { r2_url?: unknown }).r2_url : null
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('この楽曲の音源が見つかりません（tracks.r2_url 未設定）')
  }
  return url
}
