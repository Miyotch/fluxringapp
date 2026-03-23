import { initializeApp, getApps } from 'firebase/app';

const firebaseConfig = {
  projectId: 'sound-curtain-5unwwh',
  // TODO: Add full Firebase config (apiKey, authDomain, etc.)
};

export function initFirebase() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
}
