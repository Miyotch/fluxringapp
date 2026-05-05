/**
 * Cloudflare Worker: R2 Presigned Upload URL issuer
 *
 * Issues short-lived presigned PUT URLs that the admin frontend can use
 * to upload audio files directly to R2 without exposing R2 credentials.
 *
 * Endpoints:
 *   GET  /              → health check
 *   POST /upload-url    → { trackId, ext, contentType, kind }
 *                         returns { uploadUrl, publicUrl }
 *
 * Required bindings (set via wrangler.toml or dashboard):
 *   - R2 binding: BUCKET (your R2 bucket)
 *   - Vars:       R2_PUBLIC_BASE  (e.g. "https://pub-xxxxxxxx.r2.dev")
 *                 ALLOWED_ORIGIN  (e.g. "https://fluxringweb.vercel.app")
 *                 ADMIN_TOKEN     (shared secret, sent as Authorization header)
 *                 R2_ACCESS_KEY_ID
 *                 R2_SECRET_ACCESS_KEY
 *                 R2_ACCOUNT_ID
 *                 R2_BUCKET_NAME
 */

interface Env {
  BUCKET: R2Bucket;
  R2_PUBLIC_BASE: string;
  ALLOWED_ORIGIN: string;
  ADMIN_TOKEN: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
}

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
});

async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(msg));
}

async function getSignatureKey(secret: string, date: string, region: string, service: string) {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + secret), date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

/**
 * Generate AWS SigV4 presigned URL for PUT to R2 (S3-compatible).
 * Valid for 5 minutes.
 */
async function presignR2PutUrl(
  env: Env,
  key: string,
  contentType: string,
  expiresInSec = 300,
): Promise<string> {
  const region = 'auto';
  const service = 's3';
  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const credential = `${env.R2_ACCESS_KEY_ID}/${dateStamp}/${region}/${service}/aws4_request`;
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresInSec),
    'X-Amz-SignedHeaders': 'host',
  });
  // Query params must be URI-encoded and alphabetically sorted
  const sortedQuery = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalRequest = [
    'PUT',
    `/${env.R2_BUCKET_NAME}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
    sortedQuery,
    `host:${host}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/${region}/${service}/aws4_request`,
    await sha256(canonicalRequest),
  ].join('\n');

  const signingKey = await getSignatureKey(env.R2_SECRET_ACCESS_KEY, dateStamp, region, service);
  const signatureBuf = await hmacSha256(signingKey, stringToSign);
  const signature = [...new Uint8Array(signatureBuf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `https://${host}/${env.R2_BUCKET_NAME}/${encodeURIComponent(key).replace(/%2F/g, '/')}?${sortedQuery}&X-Amz-Signature=${signature}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return new Response('R2 upload service: OK', { headers: cors });
    }

    if (request.method === 'POST' && url.pathname === '/upload-url') {
      // Auth
      const authHeader = request.headers.get('Authorization') ?? '';
      if (authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      try {
        const body = (await request.json()) as {
          trackId: string;
          ext: string;
          contentType: string;
          kind?: 'audio' | 'preview' | 'artwork';
        };
        const { trackId, ext, contentType, kind = 'audio' } = body;
        if (!trackId || !ext || !contentType) {
          return new Response(JSON.stringify({ error: 'Missing fields' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }

        const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) || 'bin';
        const key = `tracks/${trackId}/${kind}.${safeExt}`;
        const uploadUrl = await presignR2PutUrl(env, key, contentType);
        const publicUrl = `${env.R2_PUBLIC_BASE.replace(/\/$/, '')}/${key}`;

        return new Response(JSON.stringify({ uploadUrl, publicUrl, key }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: (err as Error).message }), {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not found', { status: 404, headers: cors });
  },
};
