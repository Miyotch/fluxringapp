/**
 * Cloudflare R2 upload helper for the React Native iPad app.
 *
 * Authentication: uses the current Firebase user's ID token.
 * The Worker validates the token via Firestore and checks that
 * users/{uid}.admin === true before issuing a presigned URL.
 *
 * Configure the endpoint via expo-constants `extra.r2UploadEndpoint`
 * (set in app.json `expo.extra.r2UploadEndpoint` or via EAS env vars).
 */

import Constants from 'expo-constants';
import { getRNAuth } from './firebase';

const ENDPOINT: string | undefined = (Constants.expoConfig?.extra as
  | { r2UploadEndpoint?: string }
  | undefined)?.r2UploadEndpoint;

export type UploadKind = 'audio' | 'preview' | 'artwork';

export interface UploadAsset {
  /** Local file URI (e.g. from expo-document-picker / expo-image-picker). */
  uri: string;
  /** MIME type, e.g. "audio/mp4". */
  contentType: string;
  /** File extension without the dot, e.g. "m4a". */
  ext: string;
}

export interface UploadResult {
  publicUrl: string;
  key: string;
}

export function isR2Configured(): boolean {
  return Boolean(ENDPOINT);
}

/**
 * Upload a local file to R2 via the presigned URL Worker.
 *
 * Note: progress reporting via `XMLHttpRequest.upload.onprogress` is
 * supported on React Native, but if the runtime falls back to the
 * `fetch` polyfill, granular progress may be unavailable.
 */
export async function uploadToR2(
  asset: UploadAsset,
  trackId: string,
  kind: UploadKind = 'audio',
  onProgress?: (progress: number) => void,
): Promise<UploadResult> {
  if (!ENDPOINT) {
    throw new Error('R2 upload is not configured. Set expo.extra.r2UploadEndpoint in app.json.');
  }

  const user = getRNAuth().currentUser;
  if (!user) {
    throw new Error('ログインが必要です。');
  }
  const idToken = await user.getIdToken();

  const presignRes = await fetch(`${ENDPOINT.replace(/\/$/, '')}/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      trackId,
      ext: asset.ext,
      contentType: asset.contentType,
      kind,
    }),
  });

  if (!presignRes.ok) {
    const errBody = await presignRes.text();
    if (presignRes.status === 403) {
      throw new Error('管理者権限がありません。');
    }
    throw new Error(`アップロードURLの取得に失敗しました: ${presignRes.status} ${errBody}`);
  }

  const { uploadUrl, publicUrl, key } = (await presignRes.json()) as {
    uploadUrl: string;
    publicUrl: string;
    key: string;
  };

  const fileResponse = await fetch(asset.uri);
  const blob = await fileResponse.blob();

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', asset.contentType);
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`R2 upload failed: ${xhr.status} ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading to R2'));
    xhr.send(blob);
  });

  return { publicUrl, key };
}
