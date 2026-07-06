/**
 * useAuthUser.ts — ログイン中のユーザーを購読するフック
 * ------------------------------------------------------------------
 * Firebase の認証状態を購読し、現在のユーザー（未ログインなら null）を返す。
 * メールアドレス等の表示に使う。
 */

import { useState, useEffect } from 'react'
import type { User } from 'firebase/auth'
import { auth } from './firebase'
import { onUserChanged } from './firebaseAuth'

export function useAuthUser(): User | null {
  const [user, setUser] = useState<User | null>(auth.currentUser)
  useEffect(() => onUserChanged(setUser), [])
  return user
}
