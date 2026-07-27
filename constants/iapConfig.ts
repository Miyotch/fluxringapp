/**
 * iapConfig.ts — アプリ内課金のサーバ検証エンドポイント設定
 * ------------------------------------------------------------------
 * レシート検証は必ずサーバ側で行う。フル音源（R2 の署名付きURL）は ¥2,500 の
 * 対価そのものなので、所有権の判定をアプリ内に置くと改ざんで取られる。
 *
 * 既定では音源 Worker（infra/r2-audio-worker.js）と同居させる:
 *   POST {workerUrl}/iap/verify
 *     ヘッダ: Authorization: Bearer <Firebase ID token>
 *     ボディ: { platform, productId, purchaseToken, transactionId }
 *   → サーバが Apple / Google に検証をかけ、Firestore
 *     `users/{uid}/purchases/{trackId}` に権利を書いてから 200 を返す。
 *
 * 所有権を判定する主体（Worker の checkOwnership）と、権利を書き込む主体を
 * 同じ場所に置くための同居。別 Worker に分ける場合のみ app.json の
 * `extra.iap.verifyUrl` に絶対URLを入れて上書きする。
 *
 * 未設定（workerUrl も verifyUrl も空）のときの扱いは lib/iap.ts の
 * verifyOnServer() のコメントを参照。
 */

import Constants from 'expo-constants'
import { R2_WORKER_URL } from './mediaConfig'

type IapConfig = {
  /** 検証エンドポイントの絶対URL。空なら Worker と同居（{workerUrl}/iap/verify） */
  verifyUrl?: string
}

const iap = (Constants.expoConfig?.extra?.iap as IapConfig | undefined) ?? {}

const explicit = (iap.verifyUrl ?? '').replace(/\/+$/, '')

export const IAP_VERIFY_URL =
  explicit || (R2_WORKER_URL ? `${R2_WORKER_URL}/iap/verify` : '')

/** サーバ検証が設定済みか。false の間は「ストア購入は通るがサーバ権利は残らない」 */
export const isIapVerifyConfigured = Boolean(IAP_VERIFY_URL)
