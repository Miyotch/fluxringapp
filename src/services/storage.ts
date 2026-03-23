import { getStorage, ref, getDownloadURL } from 'firebase/storage';

export async function getAudioUrl(path: string): Promise<string> {
  return getDownloadURL(ref(getStorage(), path));
}

export async function getArtworkUrl(path: string): Promise<string> {
  return getDownloadURL(ref(getStorage(), path));
}
