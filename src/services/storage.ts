import { getStorage, ref, getDownloadURL, uploadBytes } from 'firebase/storage';

export async function getAudioUrl(path: string): Promise<string> {
  return getDownloadURL(ref(getStorage(), path));
}

export async function getArtworkUrl(path: string): Promise<string> {
  return getDownloadURL(ref(getStorage(), path));
}

export async function uploadArticleThumbnail(
  file: File,
  articleId: string,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `articles/${articleId}/thumbnail.${ext}`;
  const storageRef = ref(getStorage(), path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}
