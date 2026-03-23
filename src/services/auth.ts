import {
  getAuth,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User,
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
