import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  // @ts-expect-error - getReactNativePersistence is not in firebase/auth's typings
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import { safeAuthStorage } from './safeAsyncStorage';

const firebaseConfig = {
  apiKey: 'AIzaSyDmSs-dEkmUkeSNZxF6u6fU_ifDhSZKkVI',
  authDomain: 'sound-curtain-5unwwh.firebaseapp.com',
  projectId: 'sound-curtain-5unwwh',
  storageBucket: 'sound-curtain-5unwwh.firebasestorage.app',
  messagingSenderId: '496626750767',
  appId: '1:496626750767:web:fb627d42fc98e95ca57dda',
};

// Google OAuth Web Client ID — find this in Firebase Console > Authentication > Sign-in method > Google > Web SDK configuration
export const GOOGLE_WEB_CLIENT_ID = '496626750767-REPLACE_WITH_YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function initFirebase(): FirebaseApp {
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
}

/**
 * Lazily initialize the Auth instance with AsyncStorage persistence so
 * sign-in survives app restarts on iOS / Android. Falls back to getAuth on web.
 */
export function getRNAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const app = initFirebase();
  try {
    cachedAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(safeAuthStorage),
    });
  } catch {
    cachedAuth = getAuth(app);
  }
  return cachedAuth;
}
