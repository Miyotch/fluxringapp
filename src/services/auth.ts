import {
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { getRNAuth } from './firebase';

export function getCurrentUser(): User | null {
  return getRNAuth().currentUser;
}

export async function signInAnonymously(): Promise<UserCredential> {
  return firebaseSignInAnonymously(getRNAuth());
}

export async function signOut(): Promise<void> {
  return firebaseSignOut(getRNAuth());
}

export function onAuthStateChanged(
  callback: (user: User | null) => void,
): () => void {
  return firebaseOnAuthStateChanged(getRNAuth(), callback);
}

/* ── Email / password ──────────────────────────────────────────── */

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  return createUserWithEmailAndPassword(getRNAuth(), email, password);
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  return signInWithEmailAndPassword(getRNAuth(), email, password);
}

/* ── Social providers ──────────────────────────────────────────────
 * Native sign-in (Google / Apple / Facebook) requires expo-auth-session
 * or expo-apple-authentication on iOS. The browser popup flow is not
 * available on React Native. These stubs throw with a clear message so
 * that the UI can disable the buttons until the OAuth flows are wired up.
 * Tracked: backend-developer should implement these with expo-auth-session.
 * ─────────────────────────────────────────────────────────────── */

export async function signInWithGoogle(): Promise<UserCredential> {
  throw new Error('Google sign-in is not yet implemented on iPad. Use email or anonymous sign-in.');
}

export async function signInWithApple(): Promise<UserCredential> {
  throw new Error('Apple sign-in is not yet implemented on iPad. Use email or anonymous sign-in.');
}

export async function signInWithFacebook(): Promise<UserCredential> {
  throw new Error('Facebook sign-in is not yet implemented on iPad. Use email or anonymous sign-in.');
}

/* ── Human-readable error mapping ──────────────────────────────── */

export function readableAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'メールアドレスの形式が正しくありません。';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'メールアドレスまたはパスワードが違います。';
    case 'auth/email-already-in-use':
      return 'このメールアドレスは既に登録されています。';
    case 'auth/weak-password':
      return 'パスワードは6文字以上で入力してください。';
    case 'auth/account-exists-with-different-credential':
      return '同じメールアドレスの別プロバイダーアカウントが存在します。';
    case 'auth/operation-not-allowed':
      return 'この認証方法はFirebaseで有効化されていません。';
    case 'auth/network-request-failed':
      return 'ネットワークエラーが発生しました。接続をご確認ください。';
    default:
      return (err as { message?: string })?.message ?? 'ログインに失敗しました。';
  }
}

export function hasPasswordProvider(user: User | null): boolean {
  if (!user) return false;
  return user.providerData.some((p) => p.providerId === 'password');
}
