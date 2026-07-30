/**
 * iapProducts.ts — アプリ内課金の商品ID対応表
 * ------------------------------------------------------------------
 * 命名規則: `com.fluxring.app.track.<trackId>`
 *
 *   trackId | productId                     | 作品
 *   --------|-------------------------------|------------------
 *   blue    | com.fluxring.app.track.blue   | 冬明け
 *   white   | com.fluxring.app.track.white  | 薄明
 *   mesh    | com.fluxring.app.track.mesh   | 白鉛筆 I（仮）
 *   kite    | com.fluxring.app.track.kite   | 白鉛筆 II（仮）
 *   bloom   | com.fluxring.app.track.bloom  | 白鉛筆 III（仮）
 *
 * trackId を軸に置く理由:
 *   constants/stubData.ts の STUB_TRACKS.id と、R2 の音源キー（audioKey /
 *   full/{audioKey}.mp3・Worker の /track/{audioKey}）と、Firestore の
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

/** ストアに登録する有料トラックの trackId（= audioKey = Firestore doc id） */
export const PAID_TRACK_IDS = ['blue', 'white', 'mesh', 'kite', 'bloom'] as const

export type PaidTrackId = (typeof PAID_TRACK_IDS)[number]

/** trackId → productId */
export function productIdOf(trackId: string): string {
  return `${PRODUCT_ID_PREFIX}${trackId}`
}

/**
 * productId → trackId の明示的な逆引き表。
 * プレフィックスの split で済ませないのは、将来 trackId にドットや別体系が
 * 入ったときに黙って壊れる（誤った trackId を所有権として書き込む）ため。
 */
export const PRODUCT_ID_TO_TRACK_ID: Record<string, PaidTrackId> = {
  'com.fluxring.app.track.blue': 'blue',
  'com.fluxring.app.track.white': 'white',
  'com.fluxring.app.track.mesh': 'mesh',
  'com.fluxring.app.track.kite': 'kite',
  'com.fluxring.app.track.bloom': 'bloom',
}

/** fetchProducts に渡す skus 配列 */
export const ALL_PRODUCT_IDS: string[] = PAID_TRACK_IDS.map(productIdOf)

/** productId → trackId（未知の商品IDは null。ストアから来た値を信用しないため） */
export function trackIdOfProduct(productId: string | null | undefined): PaidTrackId | null {
  if (!productId) return null
  return PRODUCT_ID_TO_TRACK_ID[productId] ?? null
}

/** その trackId がストア購入の対象か（無料トラック・未登録作品は false） */
export function isPurchasableTrack(trackId: string | null | undefined): trackId is PaidTrackId {
  if (!trackId) return false
  return Object.prototype.hasOwnProperty.call(PRODUCT_ID_TO_TRACK_ID, productIdOf(trackId))
}
