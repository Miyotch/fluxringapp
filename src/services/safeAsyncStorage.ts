import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AsyncStorage wrapper for Firebase Auth persistence.
 *
 * On some devices the native AsyncStorage call fails with an NSException at
 * launch; the RN TurboModule patch (patches/react-native+0.81.5.patch) logs
 * and swallows that exception instead of crashing, which leaves the JS
 * promise pending forever. Firebase Auth waits on the persistence read
 * before emitting the first onAuthStateChanged, so a hung getItem freezes
 * the app on the auth gate.
 *
 * Racing each call against a timeout lets auth proceed (as signed-out, with
 * in-memory persistence semantics) even when the native store is broken.
 */
const STORAGE_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn('AsyncStorage call timed out; continuing without persistence');
      resolve(fallback);
    }, STORAGE_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export const safeAuthStorage = {
  getItem: (key: string): Promise<string | null> =>
    withTimeout(AsyncStorage.getItem(key), null),
  setItem: (key: string, value: string): Promise<void> =>
    withTimeout(AsyncStorage.setItem(key, value), undefined),
  removeItem: (key: string): Promise<void> =>
    withTimeout(AsyncStorage.removeItem(key), undefined),
};
