/**
 * purchaseHistory.ts — 疑似購入（MOCK_PURCHASES）のFirestore記録
 * ------------------------------------------------------------------
 * 本番のストア連携（レシート検証・/iap/verify）が入るまでの間、
 * 「誰がどの楽曲を購入したか」を追える状態にするための暫定書き込み。
 *
 * infra/r2-audio-worker.js の冒頭コメントに記載された本番スキーマに
 * 合わせて、以下の2箇所へ書く（本番実装時に差し替えやすくするため）:
 *   1) users/{uid}/purchases/{trackId} … 所有権の正（lib/ownership.ts が購読）
 *   2) purchase_history                … 購入イベントの監査ログ（1購入1件）
 *
 * ⚠️ これは lib/usePurchaseFlow.ts の MOCK_PURCHASES=true の間だけ使う
 *   一時経路。本番のストア連携を実装する際は、この関数は使わず、
 *   サーバ（サービスアカウント）側から同じ2箇所へ書くように置き換えること
 *   （lib/ownership.ts に「クライアントは書かない」の理由が書いてある）。
 *
 * source は本番スキーマの 'store' | 'grant' のどちらでもない
 * （ストアも通さず、運営の手動付与でもない）ため、疑似購入である
 * ことが後から一目でわかるよう 'mock' を使う。
 */

import { Platform } from 'react-native'
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { productIdOf } from '../constants/iapProducts'
import { TRACK_PRICE_JPY } from '../constants/pricing'

export type RecordMockPurchaseParams = {
  uid: string
  trackId: string
  /** 購入時点の価格（円）。未指定なら標準単価にフォールバック */
  priceJpy?: number
}

/**
 * 疑似購入を Firestore に記録する。所有権書き込みと履歴追記の両方を行う。
 * どちらかが失敗しても呼び出し側（購入完了の演出）を止めないよう、
 * 呼び出し側で catch して握りつぶす想定（購入体験そのものは既にローカルで
 * 成立しているため、記録の失敗でモーダル等を失敗扱いに戻す必要はない）。
 */
export async function recordMockPurchase({
  uid,
  trackId,
  priceJpy = TRACK_PRICE_JPY,
}: RecordMockPurchaseParams): Promise<void> {
  const purchasedAt = serverTimestamp()
  const transactionId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await Promise.all([
    // 所有権（ドキュメントID = trackId = audioKey。lib/ownership.ts が購読する）
    setDoc(doc(db, 'users', uid, 'purchases', trackId), {
      priceJpy,
      verified: false,
      source: 'mock',
      purchasedAt,
      revokedAt: null,
    }),
    // 購入イベントの監査ログ（ドキュメントIDは自動採番）
    addDoc(collection(db, 'purchase_history'), {
      uid,
      trackId,
      productId: productIdOf(trackId),
      platform: Platform.OS,
      transactionId,
      purchaseToken: null,
      priceJpy,
      verified: false,
      source: 'mock',
      purchasedAt,
      revokedAt: null,
    }),
  ])
}
