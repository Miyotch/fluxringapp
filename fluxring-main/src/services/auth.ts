import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

export function getCurrentUser(): FirebaseAuthTypes.User | null {
  return auth().currentUser;
}

export async function signInAnonymously(): Promise<FirebaseAuthTypes.UserCredential> {
  return auth().signInAnonymously();
}

export async function signOut(): Promise<void> {
  return auth().signOut();
}

export function onAuthStateChanged(
  callback: (user: FirebaseAuthTypes.User | null) => void
): () => void {
  return auth().onAuthStateChanged(callback);
}
