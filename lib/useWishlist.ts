/**
 * useWishlist.ts — ウィッシュリストの唯一の持ち主
 * ------------------------------------------------------------------
 * v0.2 まで、星の状態は DiscoverScreen のローカル useState に閉じていて、
 * コレクションのウィッシュリストは STUB_WISHLIST（kite / bloom の固定2件）を見ていた。
 * つまり **星を押してもウィッシュリストには何も起きず、画面を離れれば消えていた**。
 * ウィッシュリストから購入できる導線（CollectionScreen の購入ボタン）も、空状態の案内も
 * 先に出来ていたのに、肝心の「ユーザーの意思」がそこへ入っていなかった。
 *
 * 置き場所を App.tsx に一本化し、AsyncStorage へ永続化する。
 *
 * Firestore 同期（次段階）:
 *   購入が users/{uid}/purchases/{trackId} に載っているのと同じ形で、
 *   users/{uid}/wishlist/{trackId} に置けば機種変更でもウィッシュリストが残る。
 *   ログイン前は端末ローカルだけで完結させたいので、まず AsyncStorage を
 *   正にして、ログイン時に「ローカル ∪ リモート」でマージする想定。
 *   （ウィッシュリストは「消えないこと」が価値なので、衝突時は消さない側に倒す）
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

/** ウィッシュリストの保存キー。値は trackId の配列（購入・音源キーと同じ文字列） */
const STORAGE_KEY = 'fr.wishlist.v1'

export type WishlistController = {
  /** ウィッシュリストに置かれている trackId */
  ids: Set<string>
  /** AsyncStorage の読み出しが済んだか（済む前は書き戻さない） */
  ready: boolean
  has: (trackId: string) => boolean
  /** 星のトグル（ホームの★） */
  toggle: (trackId: string) => void
  /** ウィッシュリストから外す（コレクション側の★） */
  remove: (trackId: string) => void
}

export function useWishlist(): WishlistController {
  const [ids, setIds] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)
  // 読み出し前の空 Set を保存して既存のウィッシュリストを消してしまわないためのゲート
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

  const remove = useCallback((trackId: string) => {
    setIds((prev) => {
      if (!prev.has(trackId)) return prev
      const next = new Set(prev)
      next.delete(trackId)
      return next
    })
  }, [])

  return { ids, ready, has, toggle, remove }
}

export default useWishlist
