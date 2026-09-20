/**
 * useFavorites.ts — 「お気に入り」（所有済みの曲にも付けられる目印）
 * ------------------------------------------------------------------
 * ウィッシュリスト（lib/useWishlist.ts）は「まだ持っていない・買いたい」を
 * 表す集合で、所有した瞬間に自動的に外れる（wishlistItems が
 * !ownedTrackIds.has(tr.id) でフィルタするため）。
 *
 * 「お気に入り」はそれとは別の集合で、所有の有無に関わらず付けられる
 * 単純な目印（再生画面の★など）。lib/useWishlist.ts と同じ構図
 * （AsyncStorage に永続化。Firestore 同期は将来的な拡張として保留）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

/** お気に入りの保存キー。値は trackId の配列（購入・音源キーと同じ文字列） */
const STORAGE_KEY = 'fr.favorites.v1'

export type FavoritesController = {
  /** お気に入りに置かれている trackId */
  ids: Set<string>
  /** AsyncStorage の読み出しが済んだか（済む前は書き戻さない） */
  ready: boolean
  has: (trackId: string) => boolean
  /** ★のトグル */
  toggle: (trackId: string) => void
}

export function useFavorites(): FavoritesController {
  const [ids, setIds] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)
  // 読み出し前の空 Set を保存して既存のお気に入りを消してしまわないためのゲート
  const readyRef = useRef(false)

  // 起動時に読み出す
  useEffect(() => {
    let alive = true
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive) return
        if (raw) {
          try {
            const arr = JSON.parse(raw)
            if (Array.isArray(arr)) setIds(new Set(arr.filter((v) => typeof v === 'string')))
          } catch {
            // 壊れた値は無視して空から始める（例外で起動を止めない）
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) return
        readyRef.current = true
        setReady(true)
      })
    return () => {
      alive = false
    }
  }, [])

  // 変更のたびに書き戻す。読み出し完了までは書かない。
  useEffect(() => {
    if (!readyRef.current) return
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...ids])).catch(() => {})
  }, [ids])

  const has = useCallback((trackId: string) => ids.has(trackId), [ids])

  const toggle = useCallback((trackId: string) => {
    setIds((prev) => {
      const next = new Set(prev)
      if (next.has(trackId)) next.delete(trackId)
      else next.add(trackId)
      return next
    })
  }, [])

  return { ids, ready, has, toggle }
}

export default useFavorites
