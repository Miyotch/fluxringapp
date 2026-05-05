import { getStorage, ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { initFirebase } from './firebase';

function storage() {
  return getStorage(initFirebase());
}

export async function getAudioUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage(), path));
}

export async function getArtworkUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage(), path));
}

/**
 * Upload an article thumbnail. Accepts a Blob (web) or `{ uri, type }`
 * descriptor (React Native — convert with `fetch(uri).then(r => r.blob())`).
 */
export async function uploadArticleThumbnail(
  blob: Blob,
  articleId: string,
  contentType = 'image/jpeg',
  ext = 'jpg',
): Promise<string> {
  const path = `articles/${articleId}/thumbnail.${ext}`;
  const storageRef = ref(storage(), path);
  await uploadBytes(storageRef, blob, { contentType });
  return getDownloadURL(storageRef);
}
