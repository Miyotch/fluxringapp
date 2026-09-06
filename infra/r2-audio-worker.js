/**
 * r2-audio-worker.js — FLUX RING フル音源配信 Worker（テンプレート）
 * ==================================================================
 * 役割: 非公開 R2 バケットのフル音源を、
 *   1) Firebase ID トークンを検証（本人確認）
 *   2) 所有権を確認（購入済みか。Firestore users/{uid}/purchases/{audioKey}）
 *   3) 配信するオブジェクトの場所を Firestore sound/{audioKey}.r2_url から解決
 *   4) Range 対応でストリーミング（シーク可能）
 * して返す。試聴（preview/*.wav）は公開バケット/カスタムドメインで別配信。
 *
 * ⚠️ セキュリティ注意（重要・デプロイ前に必ず確認）:
 *   sound/{id} ドキュメントは r2_preview を「未購入ユーザーも含む全員」に
 *   試聴用として公開する必要があるため、Firestore セキュリティルール上
 *   クライアント（Firebase Auth の ID トークン経由）から読み取り可能になって
 *   いるはず。r2_url を同じドキュメント・同じ読み取り権限の場所に置くと、
 *   クライアントが Firestore を直接読むだけで購入前でもフル音源の場所が
 *   見えてしまい、この Worker の所有権確認が無意味になる。
 *   → r2_url は r2_preview と分離し（例: 別ドキュメント／サブコレクション
 *     sound/{id}/private/full）、そちらはクライアントからの読み取りを
 *     `allow read: if false;` にした上で、この Worker（サービスアカウントの
 *     OAuth トークン＝セキュリティルールの対象外）だけが読める運用にすること。
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
 *       FIRESTORE_TOKEN = "..."    # サービスアカウントのOAuth2アクセストークン
 *                                  # （購入確認・r2_url解決の Firestore REST 読み取りに使用。
 *                                  #   有効期限が短いため、実運用では Secrets + 定期更新、
 *                                  #   または Workers から都度 SA 認証してトークンを発行する
 *                                  #   仕組みに置き換えること）
 *
 *   $ wrangler deploy
 *   → app.json の extra.r2.workerUrl にこの Worker の URL を設定。
 *
 * バケット構成（例・sound/{id}.r2_url 未設定時のフォールバック）:
 *   full/{audioKey}.wav     ← フル音源（このWorker経由のみ）
 *   （試聴は別の公開バケット: preview/{audioKey}.wav）
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

    // 2) 所有権確認（購入済みか。Firestore users/{uid}/purchases/{audioKey}）
    const owns = await checkOwnership(env, uid, audioKey);
    if (!owns) return json({ error: 'forbidden' }, 403);

    // 3) 配信するオブジェクトの場所を解決する。
    //    sound/{audioKey}.r2_url が設定されていればそれを優先し（完全URL／
    //    バケット相対パスのどちらでも objectKey として解釈できるようにする）、
    //    未設定・取得失敗時は旧来の固定命名規則 `full/{audioKey}.wav` にフォールバックする。
    //    このFirestore読み取りはサービスアカウントのトークンで行うため、
    //    クライアント（Firebase Authの一般ユーザー）からは r2_url は見えない前提。
    const soundFields = await firestoreGetDoc(env, `sound/${encodeURIComponent(audioKey)}`);
    const r2Url = soundFields ? firestoreFieldString(soundFields, 'r2_url') : null;
    const objectKey = r2Url ? toObjectKey(r2Url) : `full/${audioKey}.wav`;

    // 4) R2 から Range 対応でストリーミング（アプリはこの Worker URL を直接再生してもよい）
    //    ※ アプリの lib/r2.ts は { url } を期待するので、署名URL方式にする場合は
    //      ここで presigned URL を作って json({ url }) を返す実装に差し替える。
    const range = parseRange(request.headers.get('Range'));
    const obj = await env.AUDIO.get(objectKey, range ? { range } : undefined);
    if (!obj) return json({ error: 'object not found', objectKey }, 404);

    const headers = new Headers(CORS);
    obj.writeHttpMetadata(headers);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Content-Type', obj.httpMetadata?.contentType || 'audio/wav');

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
 * - 本番は Firestore の購入レコード users/{uid}/purchases/{audioKey} の存在で判定
 *   （lib/ownership.ts と同じく revokedAt が立っていれば返金・失効として未所有扱い）。
 *   env.FIRESTORE_TOKEN が未設定のときは安全側に倒して未所有扱いにする。
 */
async function checkOwnership(env, uid, audioKey) {
  if (env.DEV_ALLOW_ALL === 'true') return true; // ⚠️ テスト用バイパス（本番で必ず無効化）

  const fields = await firestoreGetDoc(
    env,
    `users/${encodeURIComponent(uid)}/purchases/${encodeURIComponent(audioKey)}`,
  );
  if (!fields) return false; // ドキュメント無し／読み取り不可＝未所有扱い
  return !fields.revokedAt;
}

/**
 * Firestore REST でドキュメント1件を取得する（サービスアカウントの OAuth トークンが必要）。
 * env.FIRESTORE_TOKEN が無い、またはドキュメントが存在しない場合は null を返す。
 * 戻り値は Firestore REST のネイティブ形式（{ フィールド名: { stringValue, booleanValue, ... } }）。
 */
async function firestoreGetDoc(env, path) {
  if (!env.FIRESTORE_TOKEN) return null;
  const pid = env.FIREBASE_PROJECT_ID;
  const url = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${env.FIRESTORE_TOKEN}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.fields || null;
}

/** Firestore REST のフィールド値（stringValue）を取り出す。空文字・未設定は null。 */
function firestoreFieldString(fields, name) {
  const v = fields?.[name]?.stringValue;
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/**
 * sound/{id}.r2_url の値を R2 の objectKey（バケット相対パス）に変換する。
 * 完全URL（例: "https://.../full/blue.wav"）が入っていれば pathname を、
 * バケット相対パス（例: "full/blue.wav"）がそのまま入っていればそれを使う。
 */
function toObjectKey(value) {
  try {
    return new URL(value).pathname.replace(/^\/+/, '');
  } catch {
    return value.replace(/^\/+/, '');
  }
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
