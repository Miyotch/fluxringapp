/**
 * r2-audio-worker.js — FLUX RING フル音源配信 Worker（テンプレート）
 * ==================================================================
 * 役割: 非公開 R2 バケットのフル音源を、
 *   1) Firebase ID トークンを検証（本人確認）
 *   2) 所有権を確認（購入済みか）
 *   3) Range 対応でストリーミング（シーク可能）
 * して返す。試聴（preview/*.m4a）は公開バケット/カスタムドメインで別配信。
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
 *
 *   $ wrangler deploy
 *   → app.json の extra.r2.workerUrl にこの Worker の URL を設定。
 *
 * バケット構成（例）:
 *   full/{audioKey}.m4a     ← フル音源（このWorker経由のみ）
 *   （試聴は別の公開バケット: preview/{audioKey}.m4a）
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
    const objectKey = `full/${audioKey}.m4a`;
    const range = parseRange(request.headers.get('Range'));
    const obj = await env.AUDIO.get(objectKey, range ? { range } : undefined);
    if (!obj) return json({ error: 'object not found', objectKey }, 404);

    const headers = new Headers(CORS);
    obj.writeHttpMetadata(headers);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Content-Type', obj.httpMetadata?.contentType || 'audio/mp4');

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

// 所有権確認（要実装）: 購入レコードの有無を返す。
async function checkOwnership(env, uid, audioKey) {
  // TODO: Firestore / D1 / KV で uid の購入済みに audioKey が含まれるか確認。
  //   暫定: 未実装のため false（全て 403）。運用前に必ず実装すること。
  return false;
}

// Firebase ID トークン（RS256）を Google 公開鍵で検証。
async function verifyFirebaseToken(jwt, projectId) {
  const [h, p, s] = jwt.split('.');
  if (!h || !p || !s) throw new Error('malformed token');
  const header = JSON.parse(atob(h.replace(/-/g, '+').replace(/_/g, '/')));
  const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error('bad aud');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('bad iss');
  if (payload.exp < now) throw new Error('expired');

  // Google の公開証明書（securetoken）から header.kid に一致する鍵で検証
  const certs = await (await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
  )).json();
  const pem = certs[header.kid];
  if (!pem) throw new Error('unknown kid');

  const key = await importX509(pem);
  const data = new TextEncoder().encode(`${h}.${p}`);
  const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
  if (!ok) throw new Error('bad signature');
  return payload;
}

async function importX509(pem) {
  const b64 = pem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  // X.509 証明書から SPKI を取り出すのは煩雑なため、実運用では
  // jose ライブラリ（importX509）や PUBLIC KEY(JWK) エンドポイントの利用を推奨。
  // ここでは JWK 版のエンドポイントを使う実装に差し替えるのが簡単:
  //   https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com
  throw new Error('importX509 は jose 等で実装してください（コメント参照）');
}
