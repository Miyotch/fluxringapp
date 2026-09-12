/**
 * backgroundLayers.ts — ホーム背景「星雲」「魔法陣（調律陣）」の位置・大きさ調整
 * ------------------------------------------------------------------
 * 設定 →「背景レイヤー調整」のスライダーが読み書きする Firestore
 * config/backgroundLayers を購読する。ホーム画面（DiscoverScreen）はこれを
 * 購読し、各レイヤーの見た目にそのまま反映する。
 *
 * 未設定（ドキュメントが無い／フィールドが無い）は「現状の位置・大きさ」
 * （offsetX/offsetY=0・scale=1）を基準値として扱う＝今の見た目のまま。
 */

import { useEffect, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'

export type LayerAdjust = { offsetX: number; offsetY: number; scale: number }
export type BackgroundLayersConfig = { nebula: LayerAdjust; seal: LayerAdjust }

export const DEFAULT_LAYER_ADJUST: LayerAdjust = { offsetX: 0, offsetY: 0, scale: 1 }
export const DEFAULT_BACKGROUND_LAYERS: BackgroundLayersConfig = {
  nebula: { ...DEFAULT_LAYER_ADJUST },
  seal: { ...DEFAULT_LAYER_ADJUST },
}

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

function parseAdjust(v: unknown): LayerAdjust {
  const obj = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    offsetX: num(obj.offsetX, 0),
    offsetY: num(obj.offsetY, 0),
    scale: num(obj.scale, 1),
  }
}

const configDoc = () => doc(db, 'config', 'backgroundLayers')

/** ホーム画面側の購読フック。読み取り専用 */
export function useBackgroundLayersConfig(): BackgroundLayersConfig {
  const [cfg, setCfg] = useState<BackgroundLayersConfig>(DEFAULT_BACKGROUND_LAYERS)

  useEffect(() => {
    const unsub = onSnapshot(
      configDoc(),
      (snap) => {
        const data = snap.data()
        setCfg(
          data
            ? { nebula: parseAdjust(data.nebula), seal: parseAdjust(data.seal) }
            : DEFAULT_BACKGROUND_LAYERS,
        )
      },
      () => setCfg(DEFAULT_BACKGROUND_LAYERS),
    )
    return unsub
  }, [])

  return cfg
}

/** 設定画面の保存ボタンから呼ぶ */
export async function saveBackgroundLayersConfig(cfg: BackgroundLayersConfig): Promise<void> {
  await setDoc(configDoc(), {
    nebula: cfg.nebula,
    seal: cfg.seal,
    updatedAt: serverTimestamp(),
  })
}
