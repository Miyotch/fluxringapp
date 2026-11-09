/**
 * backdropMode.ts — ホーム背景の見比べ用スイッチ（端末ごと・AsyncStorage）
 * ------------------------------------------------------------------
 *   'sky'    … 従来（BackdropSky の地色＋天の川＋星）
 *   'image'  … assets の青雲画像を敷き、その上に星・調律陣などを重ねる
 *   'nebula' … 天の川の帯（HomeNebulaBand。公式サイト冒頭の試作と同じ星雲）＋星
 *   'clouds' … これまでの星雲（HomeNebulaSpace の水彩の雲）＋星。見比べ用
 *
 * 設定 →「背景レイヤー調整」のスイッチが書く。ホームはこれを購読して即切り替わる。
 * 全端末への反映はしない（見比べ用。本番で決まったら Firestore へ載せ替える）。
 */

import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type BackdropMode = 'sky' | 'image' | 'orbit' | 'nebula' | 'clouds'

const STORAGE_KEY = 'fr.backdropMode.starfieldPreview.v4'

let current: BackdropMode = 'nebula'
let loaded = false
const listeners = new Set<(m: BackdropMode) => void>()

const load = () => {
  if (loaded) return
  loaded = true
  AsyncStorage.getItem(STORAGE_KEY)
    .then((v) => {
      if (v === 'image' || v === 'sky' || v === 'orbit' || v === 'nebula' || v === 'clouds') {
        current = v
        listeners.forEach((l) => l(current))
      }
    })
    .catch(() => {})
}

export function setBackdropMode(m: BackdropMode) {
  current = m
  listeners.forEach((l) => l(m))
  AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {})
}

export function useBackdropMode(): BackdropMode {
  const [mode, setMode] = useState<BackdropMode>(current)
  useEffect(() => {
    load()
    listeners.add(setMode)
    setMode(current)
    return () => {
      listeners.delete(setMode)
    }
  }, [])
  return mode
}
