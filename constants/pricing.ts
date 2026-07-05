/**
 * pricing.ts — FLUX RING 価格定数（PRICING.md の確定値）
 * ------------------------------------------------------------------
 * 商品は三種のみ:
 *   1. toC 買い切り        … ¥2,500 / 曲（無料トラック ¥0）
 *   2. toB 年間ライセンス  … ¥36,000 / 年（月換算 ¥3,000）
 *   3. カスタム制作        … 価格協議中（アプリ内では扱わない）
 *
 * 価格の階層・レアリティ価格・月額サブスクは設けない（全作品が単一価格）。
 * 詳細は PRICING.md を正とする。
 */

/** toC 作品の単一価格（円・買い切り） */
export const TRACK_PRICE_JPY = 2500

/** 無料トラックの価格（円） */
export const FREE_PRICE_JPY = 0

/** toB 年間ライセンス（円 / 年）。対外呼称は「年間ライセンス」——「サブスク」は使わない */
export const BUSINESS_ANNUAL_LICENSE_JPY = 36000

/**
 * 価格ラベルの整形。
 * 0 円は「無料」、それ以外は「¥2,500」形式（3桁区切り）。
 * ※ Hermes では Intl 無効時に toLocaleString の桁区切りが効かないため手動整形。
 */
export function formatPrice(jpy: number): string {
  if (jpy <= 0) return '無料'
  const grouped = Math.round(jpy).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `¥${grouped}`
}

/** 作品の購入ボタン用ラベル（例: 「購入する ¥2,500」/ 無料トラックは「無料で受け取る」） */
export function buyLabel(jpy: number = TRACK_PRICE_JPY): string {
  return jpy <= 0 ? '無料で受け取る' : `購入する ${formatPrice(jpy)}`
}
