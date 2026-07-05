/**
 * r2-audio-worker.js — FLUX RING フル音源配信 Worker（テンプレート）
 * ==================================================================
 * 役割: 非公開 R2 バケットのフル音源を、
 *   1) Firebase ID トークンを検証（本人確認）
 *   2) 所有権を確認（購入済みか）
 *   3) Range 対応でストリーミング（シーク可能）
 * して返す。試聴（preview/*.mp3）は公開バケット/カスタムドメインで別配信。
 *
 * ------------------------------------------------------------------
 * デプロイ:
 *   wrangler.toml:
 *     name = "fluxring-audio"
 *     main = "r2-audio-worker.js"
 *     compatibility_date = "2024-11-01"
 *     [[r2_buckets]]
 *       binding = "AUDIO"          # env.AUDIO
 *       bucket_name = "fluxring-audio"
 *     [vars]
 *       FIREBASE_PROJECT_ID = "sound-curtain-5unwwh"
 *       DEV_ALLOW_ALL = "true"     # ⚠️ 購入実装前のテスト用。本番では "false" or 削除
 *
 *   $ wrangler deploy
 *   → app.json の extra.r2.workerUrl にこの Worker の URL を設定。
 *
 * バケット構成（例）:
 *   full/{audioKey}.mp3     ← フル音源（このWorker経由のみ）
 *   （試聴は別の公開バケット: preview/{audioKey}.mp3）
 * ------------------------------------------------------------------
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Range',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const m = url.pathname.match(/^\/track\/(.+)$/);
    if (!m) return json({ error: 'not found' }, 404);
    const audioKey = decodeURIComponent(m[1]);

    // 1) 認証（Firebase ID トークン）
    const authz = request.headers.get('Authorization') || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    let claims;
    try {
      claims = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);
    } catch (e) {
      return json({ error: 'unauthorized', detail: String(e) }, 401);
    }
    const uid = claims.user_id || claims.sub;

    // 2) 所有権確認（購入済みか）
    //    TODO: Firestore REST 等で users/{uid}/purchases/{audioKey} の存在を確認する。
    //    例（Firestore REST・要 SA トークン or ルール）:
    //      GET https://firestore.googleapis.com/v1/projects/{pid}/databases/(default)/documents/users/{uid}/purchases/{audioKey}
    const owns = await checkOwnership(env, uid, audioKey);
    if (!owns) return json({ error: 'forbidden' }, 403);

    // 3) R2 から Range 対応でストリーミング（アプリはこの Worker URL を直接再生してもよい）
    //    ※ アプリの lib/r2.ts は { url } を期待するので、署名URL方式にする場合は
    //      ここで presigned URL を作って json({ url }) を返す実装に差し替える。
    const objectKey = `full/${audioKey}.mp3`;
    const range = parseRange(request.headers.get('Range'));
    const obj = await env.AUDIO.get(objectKey, range ? { range } : undefined);
    if (!obj) return json({ error: 'object not found', objectKey }, 404);

    const headers = new Headers(CORS);
    obj.writeHttpMetadata(headers);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Content-Type', obj.httpMetadata?.contentType || 'audio/mpeg');

    if (range && obj.range) {
      const start = obj.range.offset ?? 0;
      const len = obj.range.length ?? obj.size - start;
      headers.set('Content-Range', `bytes ${start}-${start + len - 1}/${obj.size}`);
      headers.set('Content-Length', String(len));
      return new Response(obj.body, { status: 206, headers });
    }
    headers.set('Content-Length', String(obj.size));
    return new Response(obj.body, { status: 200, headers });
  },
};

// ── ヘルパ ────────────────────────────────────────────────

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function parseRange(h) {
  if (!h) return null;
  const m = /bytes=(\d*)-(\d*)/.exec(h);
  if (!m) return null;
  const start = m[1] ? parseInt(m[1], 10) : undefined;
  const end = m[2] ? parseInt(m[2], 10) : undefined;
  if (start != null && end != null) return { offset: start, length: end - start + 1 };
  if (start != null) return { offset: start };
  if (end != null) return { suffix: end };
  return null;
}

/**
 * 所有権確認: uid が audioKey を購入済みかを返す。
 * - env.DEV_ALLOW_ALL === "true" のときは常に許可（購入実装前のテスト用・本番では外す）。
 * - 本番は Firestore の購入レコード users/{uid}/purchases/{audioKey} の存在で判定。
 *   ・セキュリティルールで本人読み取り可にしておくか、SA トークンで REST を叩く。
 */
async function checkOwnership(env, uid, audioKey) {
  if (env.DEV_ALLOW_ALL === 'true') return true; // ⚠️ テスト用バイパス（本番で必ず無効化）

  // 例: Firestore REST（要 SA アクセストークン env.FIRESTORE_TOKEN、または公開ルール）
  // const pid = env.FIREBASE_PROJECT_ID;
  // const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/users/${uid}/purchases/${audioKey}`;
  // const r = await fetch(url, { headers: { Authorization: `Bearer ${env.FIRESTORE_TOKEN}` } });
  // return r.ok;

  // TODO: 購入データ構造が確定したら上記を有効化する。暫定は未所有扱い。
  return false;
}

// Google securetoken の JWK（WebCrypto で直接 import できる）。短時間キャッシュ推奨。
let JWKS_CACHE = { at: 0, keys: null };
async function getSecureTokenKeys() {
  const now = Date.now();
  if (JWKS_CACHE.keys && now - JWKS_CACHE.at < 60 * 60 * 1000) return JWKS_CACHE.keys;
  const res = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  );
  const data = await res.json();
  JWKS_CACHE = { at: now, keys: data.keys };
  return data.keys;
}

// Firebase ID トークン（RS256）を Google JWK で検証。
async function verifyFirebaseToken(jwt, projectId) {
  const [h, p, s] = (jwt || '').split('.');
  if (!h || !p || !s) throw new Error('malformed token');
  const b64u = (x) => atob(x.replace(/-/g, '+').replace(/_/g, '/'));
  const header = JSON.parse(b64u(h));
  const payload = JSON.parse(b64u(p));

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error('bad aud');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('bad iss');
  if (payload.exp < now) throw new Error('expired');
  if (payload.auth_time > now + 60) throw new Error('bad auth_time');

  const jwk = (await getSecureTokenKeys()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('unknown kid');

  const key = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify'],
  );
  const data = new TextEncoder().encode(`${h}.${p}`);
  const sig = Uint8Array.from(b64u(s), (c) => c.charCodeAt(0));
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
  if (!ok) throw new Error('bad signature');
  return payload;
}
