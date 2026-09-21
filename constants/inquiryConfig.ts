/**
 * inquiryConfig.ts — お問い合わせ受信時の管理者メール通知 Worker の設定
 * ------------------------------------------------------------------
 * 値は app.json の `extra.inquiry` から読み込む（コードに直書きしない）。
 *
 *   notifyWorkerUrl … infra/inquiry-notify-worker.js（Resend 経由で管理者へ
 *                     メール通知するテンプレート）のデプロイ先URL。
 *                     未設定（空文字）のあいだは lib/submitInquiry.ts が
 *                     通知をスキップする（お問い合わせ自体は Firestore に
 *                     記録される。メール通知は Worker をデプロイしてから）。
 */

import Constants from 'expo-constants'

type InquiryConfig = {
  notifyWorkerUrl?: string
}

const inquiry = (Constants.expoConfig?.extra?.inquiry as InquiryConfig | undefined) ?? {}

export const INQUIRY_NOTIFY_URL = (inquiry.notifyWorkerUrl ?? '').replace(/\/+$/, '')

export const isInquiryNotifyConfigured = Boolean(INQUIRY_NOTIFY_URL)
