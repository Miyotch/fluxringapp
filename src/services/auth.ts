import {
  getAuth,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  FacebookAuthProvider,
  type User,
  type UserCredential,
} from 'firebase/auth';

export function getCurrentUser(): User | null {
  return getAuth().currentUser;
}

export async function signInAnonymously() {
  return firebaseSignInAnonymously(getAuth());
}

export async function signOut() {
  return firebaseSignOut(getAuth());
}

export function onAuthStateChanged(
  callback: (user: User | null) => void,
): () => void {
  return firebaseOnAuthStateChanged(getAuth(), callback);
}

/* ── Email / password ──────────────────────────────────────────── */

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  return createUserWithEmailAndPassword(getAuth(), email, password);
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  return signInWithEmailAndPassword(getAuth(), email, password);
}

/* ── Social providers (popup flow) ─────────────────────────────── */

export async function signInWithGoogle(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(getAuth(), provider);
}

export async function signInWithApple(): Promise<UserCredential> {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return signInWithPopup(getAuth(), provider);
}

export async function signInWithFacebook(): Promise<UserCredential> {
  const provider = new FacebookAuthProvider();
  provider.addScope('email');
  return signInWithPopup(getAuth(), provider);
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
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'ログインがキャンセルされました。';
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
