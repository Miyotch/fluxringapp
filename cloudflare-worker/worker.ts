/**
 * Cloudflare Worker: R2 Presigned Upload URL issuer (Firebase auth)
 *
 * Auth flow:
 *   1. Frontend gets the current user's Firebase ID token
 *   2. Sends it as `Authorization: Bearer <idToken>`
 *   3. Worker decodes the UID from the token (without verifying signature)
 *   4. Worker calls Firestore REST API with the SAME token to read
 *      users/{uid}. Firestore validates the token signature + expiration.
 *   5. Worker checks `admin === true` in the returned doc.
 *   6. If admin, issues a short-lived presigned PUT URL for R2.
 *
 * This delegation means we never have to verify Firebase JWT signatures
 * ourselves — Firestore does it. If the token is invalid/expired,
 * Firestore returns 401 and the Worker rejects.
 *
 * Endpoints:
 *   GET  /              → health check
 *   POST /upload-url    → { trackId, ext, contentType, kind }
 *                         returns { uploadUrl, publicUrl, key }
 *
 * Required vars (wrangler.toml):
 *   - FIREBASE_PROJECT_ID
 *   - R2_PUBLIC_BASE     (e.g. "https://pub-xxxxxxxx.r2.dev")
 *   - ALLOWED_ORIGIN     (e.g. "https://fluxringweb.vercel.app")
 *
 * Required secrets (wrangler secret put):
 *   - R2_ACCESS_KEY_ID
 *   - R2_SECRET_ACCESS_KEY
 *   - R2_ACCOUNT_ID
 *   - R2_BUCKET_NAME
 */

interface Env {
  BUCKET: R2Bucket;
  FIREBASE_PROJECT_ID: string;
  R2_PUBLIC_BASE: string;
  ALLOWED_ORIGIN: string;
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

/* ── Firebase auth (delegated to Firestore) ────────────────────── */

function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(padded)) as T;
  } catch {
    return null;
  }
}

interface FirebaseIdTokenPayload {
  user_id?: string;
  sub?: string;
  iss?: string;
  aud?: string;
  exp?: number;
}

/**
 * Verify the user is an admin by:
 *  1. Decoding the UID from the ID token (no signature check)
 *  2. Calling Firestore REST API with the token (which validates it)
 *  3. Checking that users/{uid}.admin === true
 *
 * Returns the UID if admin, null otherwise.
 */
async function verifyAdmin(idToken: string, projectId: string): Promise<string | null> {
  const payload = decodeJwtPayload<FirebaseIdTokenPayload>(idToken);
  if (!payload) return null;
  const uid = payload.user_id || payload.sub;
  if (!uid) return null;

  // Sanity check: the token should be issued for this Firebase project
  const expectedIss = `https://securetoken.google.com/${projectId}`;
  if (payload.iss !== expectedIss || payload.aud !== projectId) return null;
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;

  // Firestore REST API — Firestore will reject invalid/expired tokens
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { fields?: { admin?: { booleanValue?: boolean } } };
  const isAdmin = data.fields?.admin?.booleanValue === true;
  return isAdmin ? uid : null;
}

/* ── R2 SigV4 presign ──────────────────────────────────────────── */

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

async function presignR2PutUrl(
  env: Env,
  key: string,
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

/* ── Request handler ───────────────────────────────────────────── */

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
      const authHeader = request.headers.get('Authorization') ?? '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!idToken) {
        return new Response(JSON.stringify({ error: 'Missing token' }), {
          status: 401,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const adminUid = await verifyAdmin(idToken, env.FIREBASE_PROJECT_ID);
      if (!adminUid) {
        return new Response(JSON.stringify({ error: 'Forbidden — admin only' }), {
          status: 403,
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
        const uploadUrl = await presignR2PutUrl(env, key);
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
