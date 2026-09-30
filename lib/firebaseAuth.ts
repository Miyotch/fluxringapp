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
import AsyncStorage from '@react-native-async-storage/async-storage'
import { auth, PERSISTED_AUTH_KEY } from './firebase'

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

// ── 起動時のセッション復元 ──
// Firebase の最初のコールバックは、端末から読むだけでは出ない。ID トークン（1 時間で
// 失効）の更新とアカウント情報の確認、2 回の通信を終えてから出る。4G では 1.5 秒を
// 超えやすく、以前は 1.5 秒で「未ログイン」と決めていたため、ログイン済みでも起動の
// たびにログイン画面へ送られていた（2026-09-29 岡さん報告）。
//
//   ・復元が終わるまで待つ（authStateReady）
//   ・SESSION_WAIT_MS 待っても終わらないときは、端末に保存済みのログイン状態が
//     あればそのまま入れる（あとで無効と分かれば呼び出し側が起動フローへ戻す）
export const SESSION_WAIT_MS = 4000

export type SessionRestore = {
  /** ログイン済みとして扱ってよいか */
  signedIn: boolean
  /**
   * true なら「保存済みの状態を信じて先へ進んだ」だけで、Firebase の確認は終わっていない。
   * このあと onUserChanged が null を返したら、ログイン画面へ戻すこと。
   */
  provisional: boolean
}

export async function restoreSession(waitMs: number = SESSION_WAIT_MS): Promise<SessionRestore> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const settled = await Promise.race([
    auth.authStateReady().then(
      () => true,
      () => true,
    ),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), waitMs)
    }),
  ])
  if (timer) clearTimeout(timer)
  if (settled) return { signedIn: !!auth.currentUser, provisional: false }

  const saved = await AsyncStorage.getItem(PERSISTED_AUTH_KEY).catch(() => null)
  return { signedIn: !!saved, provisional: !!saved }
}

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
