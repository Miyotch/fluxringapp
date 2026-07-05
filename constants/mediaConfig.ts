/**
 * mediaConfig.ts — 音源配信（Cloudflare R2）の設定
 * ------------------------------------------------------------------
 * 値は app.json の `extra.r2` から読み込む（コードに直書きしない）。
 *
 *   previewBaseUrl … 試聴（30秒・公開）の配信ベースURL。
 *                    R2 公開バケット or カスタムドメイン。
 *                    例: https://media.fluxring.app
 *                    → 試聴URL: {previewBaseUrl}/preview/{audioKey}.m4a
 *
 *   workerUrl      … フル音源の署名付きURLを発行する Cloudflare Worker のURL。
 *                    非公開バケットを Firebase 認証＋所有権で保護する。
 *                    例: https://fluxring-audio.<subdomain>.workers.dev
 *                    → GET {workerUrl}/track/{audioKey}  (Authorization: Bearer <idToken>)
 *                      → { "url": "<署名付き短命URL>" }
 *
 * ※ フル音源は有料（¥2,500 買い切り）のため公開しない。必ず Worker 経由で
 *   所有権を確認してから署名付きURLを返す（infra/r2-audio-worker.js 参照）。
 */

import Constants from 'expo-constants'

type R2Config = {
  previewBaseUrl?: string
  workerUrl?: string
}

const r2 = (Constants.expoConfig?.extra?.r2 as R2Config | undefined) ?? {}

export const R2_PREVIEW_BASE = (r2.previewBaseUrl ?? '').replace(/\/+$/, '')
export const R2_WORKER_URL = (r2.workerUrl ?? '').replace(/\/+$/, '')

export const isPreviewConfigured = Boolean(R2_PREVIEW_BASE)
export const isFullAudioConfigured = Boolean(R2_WORKER_URL)
