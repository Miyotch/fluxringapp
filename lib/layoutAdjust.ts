/**
 * layoutAdjust.ts — ホーム／ウィッシュリストの「カード・ボタンの縦位置」調整
 * ------------------------------------------------------------------
 * 設定 →「ボタン位置調整」のスライダーが読み書きする Firestore
 * config/layoutAdjust を購読する。lib/backgroundLayers.ts（星雲・魔法陣調整）
 * と同じ構図で、実機ビルド無しで運営が位置を微調整できるようにする。
 *
 * 未設定（ドキュメントが無い／フィールドが無い）はすべて 0＝「今の位置のまま」
 * を基準値として扱う。
 *
 *   homeCardOffsetY    … ホーム（ディスカバー）のカード本体＋接地影の縦位置
 *   homeActsOffsetY    … ホームの下部ボタン行（★／試聴／購入する、または
 *                         所有時の「再生」）の縦位置
 *   wishlistBuyOffsetY … ウィッシュリストの各タイルにある「購入する」ボタンの
 *                         縦位置（試聴ボタンは動かさない）
 */

import { useEffect, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'

export type LayoutAdjustConfig = {
  homeCardOffsetY: number
  homeActsOffsetY: number
  wishlistBuyOffsetY: number
}

export const DEFAULT_LAYOUT_ADJUST: LayoutAdjustConfig = {
  homeCardOffsetY: 0,
  homeActsOffsetY: 0,
  wishlistBuyOffsetY: 0,
}

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

function parseConfig(v: unknown): LayoutAdjustConfig {
  const obj = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    homeCardOffsetY: num(obj.homeCardOffsetY, 0),
    homeActsOffsetY: num(obj.homeActsOffsetY, 0),
    wishlistBuyOffsetY: num(obj.wishlistBuyOffsetY, 0),
  }
}

const configDoc = () => doc(db, 'config', 'layoutAdjust')

/** ホーム／ウィッシュリスト側の購読フック。読み取り専用 */
export function useLayoutAdjustConfig(): LayoutAdjustConfig {
  const [cfg, setCfg] = useState<LayoutAdjustConfig>(DEFAULT_LAYOUT_ADJUST)

  useEffect(() => {
    const unsub = onSnapshot(
      configDoc(),
      (snap) => {
        const data = snap.data()
        setCfg(data ? parseConfig(data) : DEFAULT_LAYOUT_ADJUST)
      },
      () => setCfg(DEFAULT_LAYOUT_ADJUST),
    )
    return unsub
  }, [])

  return cfg
}

/** 設定画面の保存ボタンから呼ぶ */
export async function saveLayoutAdjustConfig(cfg: LayoutAdjustConfig): Promise<void> {
  await setDoc(configDoc(), {
    homeCardOffsetY: cfg.homeCardOffsetY,
    homeActsOffsetY: cfg.homeActsOffsetY,
    wishlistBuyOffsetY: cfg.wishlistBuyOffsetY,
    updatedAt: serverTimestamp(),
  })
}
