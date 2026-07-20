import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  deleteUser,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  User,
} from 'firebase/auth'
import { auth } from './firebase'

// ── メール / パスワード ──
export const signUp = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password)

export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password)

export const signOut = () => firebaseSignOut(auth)

// ── 退会（アカウント削除） ──
// 現在のユーザーを削除する。ログイン状態が古いと Firebase が
// requires-recent-login を投げるため、呼び出し側で失敗をハンドルする。
// 未ログイン（スタブ等）のときは何もせず解決する。
export const deleteAccount = () => {
  const u = auth.currentUser
  if (!u) return Promise.resolve()
  return deleteUser(u)
}

export const onUserChanged = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback)

// ── Google ──
// expo-auth-session で取得した id_token（必要なら access_token）を
// Firebase の Google クレデンシャルに変換してサインインする。
export const signInWithGoogleToken = (idToken: string, accessToken?: string) => {
  const credential = GoogleAuthProvider.credential(idToken, accessToken)
  return signInWithCredential(auth, credential)
}

// ── Apple ──
// expo-apple-authentication の identityToken と、署名検証用の rawNonce を
// Firebase の apple.com クレデンシャルに変換してサインインする。
export const signInWithAppleToken = (identityToken: string, rawNonce: string) => {
  const provider = new OAuthProvider('apple.com')
  const credential = provider.credential({ idToken: identityToken, rawNonce })
  return signInWithCredential(auth, credential)
}
