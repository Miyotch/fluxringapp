import storage from '@react-native-firebase/storage';

export async function getAudioUrl(path: string): Promise<string> {
  return storage().ref(path).getDownloadURL();
}

export async function getArtworkUrl(path: string): Promise<string> {
  return storage().ref(path).getDownloadURL();
}
