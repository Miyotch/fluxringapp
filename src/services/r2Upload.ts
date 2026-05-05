/**
 * Cloudflare R2 upload helper.
 *
 * Authentication: uses the current Firebase user's ID token.
 * The Worker validates the token via Firestore and checks that
 * users/{uid}.admin === true before issuing a presigned URL.
 *
 * Configure via env (Vercel → Project → Environment Variables):
 *   VITE_R2_UPLOAD_ENDPOINT - Worker base URL
 */

import { getAuth } from 'firebase/auth';

const ENDPOINT = import.meta.env.VITE_R2_UPLOAD_ENDPOINT as string | undefined;

export type UploadKind = 'audio' | 'preview' | 'artwork';

export interface UploadResult {
  publicUrl: string;
  key: string;
}

export function isR2Configured(): boolean {
  return Boolean(ENDPOINT);
}

/**
 * Upload a file to R2 via the presigned URL Worker.
 * Reports progress through the optional callback (0–1).
 */
export async function uploadToR2(
  file: File,
  trackId: string,
  kind: UploadKind = 'audio',
  onProgress?: (progress: number) => void,
): Promise<UploadResult> {
  if (!ENDPOINT) {
    throw new Error('R2 upload is not configured. Set VITE_R2_UPLOAD_ENDPOINT.');
  }

  const user = getAuth().currentUser;
  if (!user) {
    throw new Error('ログインが必要です。');
  }
  const idToken = await user.getIdToken();

  const ext = file.name.split('.').pop() ?? 'bin';

  const presignRes = await fetch(`${ENDPOINT.replace(/\/$/, '')}/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      trackId,
      ext,
      contentType: file.type || 'application/octet-stream',
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

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`R2 upload failed: ${xhr.status} ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading to R2'));
    xhr.send(file);
  });

  return { publicUrl, key };
}
