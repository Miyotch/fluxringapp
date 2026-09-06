/**
 * mediaConfig.ts — 音源配信（Cloudflare R2）の設定
 * ------------------------------------------------------------------
 * 値は app.json の `extra.r2` から読み込む（コードに直書きしない）。
 *
 *   previewBaseUrl … 試聴（30秒・公開）の配信ベースURL。
 *                    R2 公開バケット or カスタムドメイン。
 *                    例: https://media.fluxring.app
 *                    → 試聴URL: {previewBaseUrl}/{audioKey}.wav
 *                      （lib/r2.ts の previewUrl() 参照。実際は Firestore の
 *                       tracks/{id}.r2_preview_url に完全URLを入れる運用が優先され、
 *                       未設定のときだけこのベースURLからフォールバック構築する）
 *
 *   workerUrl      … IAP購入検証エンドポイント（constants/iapConfig.ts の
 *                    /iap/verify）のベースURL。未実装・未設定（空文字）。
 *
 * ※ フル音源URL（tracks/{id}.r2_url）は lib/r2.ts が Firestore から直接読む。
 *   infra/r2-audio-worker.js（Firebase認証＋所有権確認を挟んで非公開バケットから
 *   配信するテンプレート）は実際にはデプロイされておらず、R2バケットも公開設定の
 *   ため、現状のアクセス制御はアプリのUI上のみ（URLを知っていれば誰でも取得できる）。
 *   本当の意味でのアクセス制御が必要になったら、Workerを実際にデプロイして
 *   workerUrlを設定するか、Firestoreセキュリティルール側でr2_urlを購入者のみ
 *   読める場所に分離する対応が要る。
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
