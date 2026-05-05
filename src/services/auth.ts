import {
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword as firebaseUpdatePassword,
  updateEmail as firebaseUpdateEmail,
  deleteUser as firebaseDeleteUser,
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

/* ── Account management helpers ────────────────────────────────── */

/**
 * Re-authenticate the current user with their email + current password.
 * Required by Firebase before privileged ops (updateEmail, updatePassword,
 * deleteUser) when the session has aged.
 */
async function reauthWithPassword(user: User, currentPassword: string): Promise<void> {
  if (!user.email) {
    throw Object.assign(new Error('メール認証でないアカウントは変更できません。'), {
      code: 'auth/no-email',
    });
  }
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred);
}

/** Change the current user's password. Re-auths with the current password first. */
export async function changePassword(current: string, next: string): Promise<void> {
  const user = getRNAuth().currentUser;
  if (!user) throw new Error('ログインしていません。');
  await reauthWithPassword(user, current);
  await firebaseUpdatePassword(user, next);
}

/** Change the current user's email. Re-auths with the current password first. */
export async function changeEmail(currentPassword: string, newEmail: string): Promise<void> {
  const user = getRNAuth().currentUser;
  if (!user) throw new Error('ログインしていません。');
  await reauthWithPassword(user, currentPassword);
  await firebaseUpdateEmail(user, newEmail.trim());
}

/**
 * Permanently delete the current user. If the account uses email/password,
 * a re-auth with the current password is performed first.
 */
export async function deleteAccount(password: string): Promise<void> {
  const user = getRNAuth().currentUser;
  if (!user) throw new Error('ログインしていません。');
  if (user.email && password) {
    await reauthWithPassword(user, password);
  }
  await firebaseDeleteUser(user);
}
