/**
 * usePlaylists.ts — マイプレイリスト（スロット 2 以降）
 * ------------------------------------------------------------------
 * 2026-09-24 の打ち合わせで、コレクションを「プレイリスト」に改め、
 * カードゲームのデッキのように複数のプレイリストを作って切り替えられるようにした。
 *
 *   スロット 1 … 所有曲すべて。ここには保存しない（所有から毎回作る）
 *   スロット 2 以降 … ユーザーが作る（睡眠用・仕事用など）。この hook が持つ
 *
 * lib/useFavorites.ts と同じ作りで、端末の AsyncStorage に保存する。
 * Firestore への同期は保留（users/{uid} 配下へ書くルールがこのリポジトリに無く、
 * 別作業になるため）。
 *
 * 曲は trackId（購入・音源キーと同じ文字列）で持つ。所有でなくなった曲は
 * 表示する側で外す（ここでは消さない。所有の読み込みが遅れた瞬間に
 * プレイリストの中身を消してしまわないため）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

/** 保存キー。値は Playlist の配列 */
const STORAGE_KEY = 'fr.playlists.v1'

export type Playlist = {
  id: string
  name: string
  /** 再生順どおりの trackId */
  trackIds: string[]
}

export type PlaylistsController = {
  lists: Playlist[]
  /** AsyncStorage の読み出しが済んだか（済む前は書き戻さない） */
  ready: boolean
  /** 新しいプレイリストを作って、その id を返す */
  create: (name: string, trackIds?: string[]) => string
  rename: (id: string, name: string) => void
  /** 曲の並びをまるごと置き換える（追加・削除・並べ替えはすべてこれで行う） */
  setTracks: (id: string, trackIds: string[]) => void
  remove: (id: string) => void
}

function isPlaylist(v: unknown): v is Playlist {
  if (!v || typeof v !== 'object') return false
  const p = v as Playlist
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    Array.isArray(p.trackIds) &&
    p.trackIds.every((t) => typeof t === 'string')
  )
}

const newId = () => `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

export function usePlaylists(): PlaylistsController {
  const [lists, setLists] = useState<Playlist[]>([])
  const [ready, setReady] = useState(false)
  // 読み出し前の空配列を保存して既存のプレイリストを消してしまわないためのゲート
  const readyRef = useRef(false)

  useEffect(() => {
    let alive = true
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive || !raw) return
        try {
          const arr = JSON.parse(raw)
          if (Array.isArray(arr)) setLists(arr.filter(isPlaylist))
        } catch {
          // 壊れた値は無視して空から始める（例外で起動を止めない）
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

  useEffect(() => {
    if (!readyRef.current) return
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lists)).catch(() => {})
  }, [lists])

  const create = useCallback((name: string, trackIds: string[] = []) => {
    const id = newId()
    setLists((prev) => [...prev, { id, name, trackIds: [...new Set(trackIds)] }])
    return id
  }, [])

  const rename = useCallback((id: string, name: string) => {
    setLists((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  }, [])

  const setTracks = useCallback((id: string, trackIds: string[]) => {
    setLists((prev) =>
      prev.map((p) => (p.id === id ? { ...p, trackIds: [...new Set(trackIds)] } : p)),
    )
  }, [])

  const remove = useCallback((id: string) => {
    setLists((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return { lists, ready, create, rename, setTracks, remove }
}

export default usePlaylists
