/**
 * FLUX RING audio-gateway — フル音源の配信と購入の検証（Cloudflare Workers）
 * ==================================================================
 * 旧 infra/r2-audio-worker.js（テンプレート）を置き換える本番用。
 *
 *   POST /v1/stream-url   { trackId }            要 Firebase ID トークン
 *        → 持っている曲（または無料曲）なら、短い期限つきの署名URLを返す
 *          { url, expiresAt }。プレイヤー・ロック画面・端末保存はこのURLをそのまま使う
 *   GET  /v1/stream?k&u&e&s                       署名だけで通す（Range 対応・シーク可）
 *   POST /v1/iap/verify   { platform, productId, purchaseToken, transactionId }
 *        → ストアに聞き直して本物なら users/{uid}/purchases/{trackId} と
 *          purchase_history を1回の commit で書く。同じ支払いを別アカウントに
 *          使い回させない（iap_transactions/{key} に持ち主を記録）
 *   GET  /v1/health
 *
 * 音源の場所は tracks/{id}/private/audio.objectKey（クライアントからは読めない場所）。
 * 移行が済むまでは tracks/{id}.r2_url の URL のパス部分を objectKey として読む。
 *
 * シークレット（wrangler secret put）:
 *   GCP_SERVICE_ACCOUNT    Firestore を読む・書くサービスアカウントの JSON
 *   STREAM_SIGNING_KEY     署名URLの HMAC 鍵（32 バイト以上のランダム）
 *   APPLE_IAP_ISSUER_ID / APPLE_IAP_KEY_ID / APPLE_IAP_PRIVATE_KEY（.p8 の中身）
 *   PLAY_SERVICE_ACCOUNT   Google Play Developer API を呼べるサービスアカウントの JSON
 */

import { hmacSign, hmacVerify } from './crypto.js';
import { firestore, toFields, verifyFirebaseIdToken } from './google.js';
import { verifyApple, verifyGoogle } from './stores.js';

const STREAM_TTL_SEC = 6 * 3600;
const TRACK_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

export default {
  fetch: (request, env, ctx) => handle(request, env, { fetchImpl: fetch, now: Date.now() }),
};

export async function handle(request, env, opts = {}) {
  const deps = { fetchImpl: opts.fetchImpl ?? fetch, now: opts.now ?? Date.now() };
  const url = new URL(request.url);
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
    if (url.pathname === '/v1/health') return json({ ok: true });
    if (url.pathname === '/v1/stream' && (request.method === 'GET' || request.method === 'HEAD')) {
      return await stream(request, env, url, deps);
    }
    if (url.pathname === '/v1/stream-url' && request.method === 'POST') {
      return await streamUrl(request, env, url, deps);
    }
    if (url.pathname === '/v1/iap/verify' && request.method === 'POST') {
      return await iapVerify(request, env, deps);
    }
    return json({ error: 'not_found' }, 404);
  } catch (e) {
    // 中身は返さない（鍵・内部のパスを漏らさない）
    return json({ error: 'internal' }, 500);
  }
}

// ─────────────────────────────────────────────

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors() },
  });
}

async function requireUid(request, env, deps) {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') || '');
  if (!m) return null;
  try {
    return await verifyFirebaseIdToken(m[1], env.FIREBASE_PROJECT_ID, deps);
  } catch {
    return null;
  }
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > 16_384) throw new Error('too large');
  return JSON.parse(text || '{}');
}

/** r2_url（https://…/foo/bar.wav）→ バケット内のキー（foo/bar.wav） */
export function objectKeyFromUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const u = new URL(value);
    const key = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    return key || null;
  } catch {
    return value.replace(/^\/+/, '') || null;
  }
}

const signMessage = (k, u, e) => `${k}\n${u}\n${e}`;

// ── 署名URLを出す ──

async function streamUrl(request, env, url, deps) {
  const uid = await requireUid(request, env, deps);
  if (!uid) return json({ error: 'unauthenticated' }, 401);
  let body;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const trackId = body?.trackId;
  if (!TRACK_ID_RE.test(String(trackId || ''))) return json({ error: 'bad_request' }, 400);

  const fs = firestore(env, deps);
  const [track, purchase, priv] = await Promise.all([
    fs.get(`tracks/${trackId}`),
    fs.get(`users/${uid}/purchases/${trackId}`),
    fs.get(`tracks/${trackId}/private/audio`),
  ]);
  if (!track) return json({ error: 'not_found' }, 404);
  const free = track.price === 0;
  if (!purchase && !free) return json({ error: 'not_owned' }, 403);
  // 取り消された購入（返金など）は通さない
  if (purchase && purchase.revoked === true) return json({ error: 'not_owned' }, 403);

  const objectKey = priv?.objectKey || objectKeyFromUrl(track.r2_url);
  if (!objectKey) return json({ error: 'no_audio' }, 404);

  const exp = Math.floor(deps.now / 1000) + STREAM_TTL_SEC;
  const sig = await hmacSign(env.STREAM_SIGNING_KEY, signMessage(objectKey, uid, exp));
  const out = new URL('/v1/stream', url.origin);
  out.searchParams.set('k', objectKey);
  out.searchParams.set('u', uid);
  out.searchParams.set('e', String(exp));
  out.searchParams.set('s', sig);
  return json({ url: out.toString(), expiresAt: exp * 1000 });
}

// ── 署名URLで音源を流す（Range 対応） ──

export function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
  if (!m) return null;
  let start;
  let end;
  if (m[1] === '' && m[2] === '') return null;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (!suffix) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return 'unsatisfiable';
  return { offset: start, length: end - start + 1 };
}

async function stream(request, env, url, deps) {
  const k = url.searchParams.get('k') || '';
  const u = url.searchParams.get('u') || '';
  const e = Number(url.searchParams.get('e') || 0);
  const s = url.searchParams.get('s') || '';
  if (!k || !u || !e || !s) return json({ error: 'bad_request' }, 400);
  if (e < Math.floor(deps.now / 1000)) return json({ error: 'expired' }, 403);
  if (!(await hmacVerify(env.STREAM_SIGNING_KEY, signMessage(k, u, e), s))) return json({ error: 'forbidden' }, 403);

  const head = await env.AUDIO.head(k);
  if (!head) return json({ error: 'not_found' }, 404);
  const size = head.size;
  const range = parseRange(request.headers.get('Range'), size);
  if (range === 'unsatisfiable') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}`, ...cors() } });
  }
  const headers = {
    'Content-Type': head.httpMetadata?.contentType || 'audio/wav',
    'Accept-Ranges': 'bytes',
    // 署名URLごとに中身は同じ。端末側のキャッシュは許し、共有キャッシュには置かせない
    'Cache-Control': 'private, max-age=3600',
    ETag: head.httpEtag,
    ...cors(),
  };
  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers: { ...headers, 'Content-Length': String(size) } });
  }
  if (range) {
    const obj = await env.AUDIO.get(k, { range });
    if (!obj) return json({ error: 'not_found' }, 404);
    return new Response(obj.body, {
      status: 206,
      headers: {
        ...headers,
        'Content-Length': String(range.length),
        'Content-Range': `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`,
      },
    });
  }
  const obj = await env.AUDIO.get(k);
  if (!obj) return json({ error: 'not_found' }, 404);
  return new Response(obj.body, { status: 200, headers: { ...headers, 'Content-Length': String(size) } });
}

// ── 購入の検証 → 権利を書く ──

export function trackIdOfProduct(productId, prefix) {
  if (typeof productId !== 'string' || !productId.startsWith(prefix)) return null;
  const id = productId.slice(prefix.length);
  return TRACK_ID_RE.test(id) ? id : null;
}

async function iapVerify(request, env, deps) {
  const uid = await requireUid(request, env, deps);
  if (!uid) return json({ error: 'unauthenticated' }, 401);
  let body;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const { platform, productId, purchaseToken, transactionId } = body || {};
  const trackId = trackIdOfProduct(productId, env.PRODUCT_ID_PREFIX || 'com.fluxring.app.track.');
  if (!trackId) return json({ error: 'unknown_product' }, 400);

  let result;
  if (platform === 'ios') result = await verifyApple(env, { transactionId, productId }, deps);
  else if (platform === 'android') result = await verifyGoogle(env, { purchaseToken, productId }, deps);
  else return json({ error: 'bad_platform' }, 400);
  if (!result.ok) {
    // 保留（コンビニ払いなど）は 202。アプリは finish せずに次回また送る
    if (result.reason === 'pending') return json({ status: 'pending' }, 202);
    return json({ error: 'invalid_purchase', reason: result.reason }, 402);
  }

  const fs = firestore(env, deps);
  const track = await fs.get(`tracks/${trackId}`);
  if (!track) return json({ error: 'unknown_product' }, 400);

  // 同じ支払いで別のアカウントに権利を付けさせない
  const txPath = `iap_transactions/${result.transactionKey.replace(/[^A-Za-z0-9_.-]/g, '_')}`;
  const existing = await fs.get(txPath);
  if (existing && existing.uid !== uid) return json({ error: 'already_claimed' }, 409);
  if (existing && existing.uid === uid) return json({ status: 'verified', trackId, already: true });

  const priceJpy = typeof track.price === 'number' ? track.price : null;
  const historyId = crypto.randomUUID().replace(/-/g, '');
  const name = (p) => `${fs.root}/${p}`;
  const nowIso = { fieldPath: 'verifiedAt', setToServerValue: 'REQUEST_TIME' };
  try {
    await fs.commit([
      {
        update: {
          name: name(txPath),
          fields: toFields({ uid, trackId, productId, platform, environment: result.environment }),
        },
        currentDocument: { exists: false },
        updateTransforms: [nowIso],
      },
      {
        update: {
          name: name(`users/${uid}/purchases/${trackId}`),
          fields: toFields({
            trackId,
            source: 'iap',
            platform,
            transactionKey: result.transactionKey,
            environment: result.environment,
            priceJpy,
          }),
        },
        updateTransforms: [{ fieldPath: 'purchasedAt', setToServerValue: 'REQUEST_TIME' }],
      },
      {
        update: {
          name: name(`purchase_history/${historyId}`),
          fields: toFields({
            uid,
            trackId,
            title: typeof track.title === 'string' ? track.title : '',
            artistId: typeof track.artistId === 'string' ? track.artistId : null,
            priceJpy,
            platform,
            productId,
            transactionKey: result.transactionKey,
            environment: result.environment,
            storePurchasedAtMs: result.purchasedAtMs,
          }),
        },
        currentDocument: { exists: false },
        updateTransforms: [{ fieldPath: 'purchasedAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ]);
  } catch (e) {
    // 同時に2回届いた（txPath がもう在る）→ 先に書いた方を見直す
    if (e.status === 409 || e.status === 400) {
      const again = await fs.get(txPath);
      if (again && again.uid === uid) return json({ status: 'verified', trackId, already: true });
      if (again) return json({ error: 'already_claimed' }, 409);
    }
    throw e;
  }
  return json({ status: 'verified', trackId });
}
