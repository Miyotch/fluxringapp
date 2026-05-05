/**
 * Cloudflare R2 upload helper.
 *
 * Calls the R2 upload Worker to obtain a presigned PUT URL,
 * then uploads the file directly to R2.
 *
 * Configure via environment variables (see .env):
 *   VITE_R2_UPLOAD_ENDPOINT - Worker base URL
 *   VITE_R2_ADMIN_TOKEN     - shared secret for authenticating with the Worker
 */

const ENDPOINT = import.meta.env.VITE_R2_UPLOAD_ENDPOINT as string | undefined;
const ADMIN_TOKEN = import.meta.env.VITE_R2_ADMIN_TOKEN as string | undefined;

export type UploadKind = 'audio' | 'preview' | 'artwork';

export interface UploadResult {
  publicUrl: string;
  key: string;
}

export function isR2Configured(): boolean {
  return Boolean(ENDPOINT && ADMIN_TOKEN);
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
  if (!ENDPOINT || !ADMIN_TOKEN) {
    throw new Error('R2 upload is not configured. Set VITE_R2_UPLOAD_ENDPOINT and VITE_R2_ADMIN_TOKEN.');
  }

  const ext = file.name.split('.').pop() ?? 'bin';

  const presignRes = await fetch(`${ENDPOINT.replace(/\/$/, '')}/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_TOKEN}`,
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
    throw new Error(`Failed to get upload URL: ${presignRes.status} ${errBody}`);
  }

  const { uploadUrl, publicUrl, key } = (await presignRes.json()) as {
    uploadUrl: string;
    publicUrl: string;
    key: string;
  };

  // Upload via XHR so we can report progress
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
