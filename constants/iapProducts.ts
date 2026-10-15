/**
 * iapProducts.ts — アプリ内課金の商品ID対応表
 * ------------------------------------------------------------------
 * 命名規則: `com.fluxring.app.track.<trackId>`
 *
 *   trackId は Firestore の tracks のドキュメントID（例: snow-in-focus →
 *   com.fluxring.app.track.snow-in-focus）
 *
 * trackId を軸に置く理由:
 *   constants/stubData.ts の STUB_TRACKS.id と、R2 の音源キー（audioKey /
 *   full/{audioKey}.wav・Worker の /track/{audioKey}）と、Firestore の
 *   `users/{uid}/purchases/{trackId}` のドキュメントIDが、すべて同じ文字列で
 *   貫通している。ここで別体系のIDを挟むと変換点が増えて必ずどこかでずれる。
 *
 * バンドルIDのプレフィックスを付ける理由:
 *   Google Play の商品IDは同一開発者アカウント内で名前空間を共有しない一方、
 *   App Store Connect では他アプリの商品と同じ一覧に並ぶ。識別のために付ける。
 *
 * 商品種別（いずれも「買い切り」。自動更新の商品は作らない）:
 *   ・iOS     … 非消費型（Non-Consumable）。PRICING.md「購入後は永続アクセス」と一致。
 *   ・Android … 1回限りの製品（in-app product）。**消費しない**（consume せず acknowledge のみ）。
 *
 * 無料トラック（¥0）はここに載せない:
 *   ストアは ¥0 の非消費型を作れない。無料付与はサーバ側 grant（source:'grant'）で
 *   Firestore に直接書く別経路になる。
 *
 * toB 年間ライセンス（¥36,000/年）もここに載せない:
 *   PRICING.md のとおり請求書・契約書を伴う法人取引で、アプリ内課金の対象外。
 *   ※ この前提はアプリ内で商用利用権による機能差を作らないことに依存する。
 *      ストア規約上の解釈は要合意事項（本環境では確認できない）。
 */

/** 商品IDの共通プレフィックス（app.json の bundleIdentifier / package と一致させる） */
export const PRODUCT_ID_PREFIX = 'com.fluxring.app.track.'

/**
 * ストアで売る曲。2026-10-15 から Firestore の tracks（price > 0）で決める
 * （以前は試作の5曲 blue/white/mesh/kite/bloom を固定で持っていて、実際の曲と
 * ずれていた）。useTracks が曲を読んだときに registerPaidTracks で入れる。
 * App Store Connect / Google Play には、同じ命名で商品を1曲ずつ作っておくこと。
 */
export type PaidTrackId = string

const TRACK_ID_RE = /^[A-Za-z0-9_-]{1,128}$/

/**
 * productId → trackId の明示的な逆引き表。
 * プレフィックスの split で済ませないのは、Firestore に無い曲の商品IDを
 * 所有権として書き込まない（ストアから来た値を信用しない）ため。
 */
const productToTrack = new Map<string, PaidTrackId>()

/** trackId → productId */
export function productIdOf(trackId: string): string {
  return `${PRODUCT_ID_PREFIX}${trackId}`
}

/** Firestore の有料曲を登録する（呼ぶたびに置き換え） */
export function registerPaidTracks(trackIds: string[]) {
  productToTrack.clear()
  for (const id of trackIds) if (TRACK_ID_RE.test(id)) productToTrack.set(productIdOf(id), id)
}

/** fetchProducts に渡す skus 配列 */
export function allProductIds(): string[] {
  return [...productToTrack.keys()]
}

/** productId → trackId（未知の商品IDは null。ストアから来た値を信用しないため） */
export function trackIdOfProduct(productId: string | null | undefined): PaidTrackId | null {
  if (!productId) return null
  const hit = productToTrack.get(productId)
  if (hit) return hit
  // 起動直後（曲の一覧がまだ届く前）に未完了の購入を引き取ることがある。そのときは
  // 命名規則から読む。権利を書くのはサーバ（audio-gateway）で、サーバは Firestore に
  // その曲が在るかを確かめ直すので、ここで通しても知らない曲の権利は生まれない
  if (productToTrack.size === 0 && productId.startsWith(PRODUCT_ID_PREFIX)) {
    const id = productId.slice(PRODUCT_ID_PREFIX.length)
    return TRACK_ID_RE.test(id) ? id : null
  }
  return null
}

/** その trackId がストア購入の対象か（無料トラック・未登録作品は false） */
export function isPurchasableTrack(trackId: string | null | undefined): trackId is PaidTrackId {
  if (!trackId) return false
  return productToTrack.has(productIdOf(trackId))
}
