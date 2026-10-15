/**
 * google.js — Firebase ID トークンの検証・サービスアカウントの OAuth・Firestore REST
 */

import { decodeJwt, signRs256, verifyRs256 } from './crypto.js';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwksCache = { keys: null, until: 0 };

async function getJwks(fetchImpl, now) {
  if (jwksCache.keys && now < jwksCache.until) return jwksCache.keys;
  const res = await fetchImpl(JWKS_URL);
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const body = await res.json();
  const m = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
  jwksCache = { keys: body.keys || [], until: now + (m ? Number(m[1]) * 1000 : 3600_000) };
  return jwksCache.keys;
}

export function _resetCaches() {
  jwksCache = { keys: null, until: 0 };
  tokenCache = new Map();
}

/**
 * Firebase Auth の ID トークンを検証して uid を返す。だめなら例外。
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
export async function verifyFirebaseIdToken(idToken, projectId, { fetchImpl = fetch, now = Date.now() } = {}) {
  const d = decodeJwt(idToken);
  const { header, payload } = d;
  if (header.alg !== 'RS256' || !header.kid) throw new Error('bad header');
  const sec = Math.floor(now / 1000);
  const skew = 60;
  if (payload.aud !== projectId) throw new Error('bad aud');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('bad iss');
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) throw new Error('bad sub');
  if (!(payload.exp > sec - skew)) throw new Error('expired');
  if (!(payload.iat <= sec + skew)) throw new Error('bad iat');
  if (payload.auth_time != null && !(payload.auth_time <= sec + skew)) throw new Error('bad auth_time');
  const keys = await getJwks(fetchImpl, now);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('unknown kid');
  if (!(await verifyRs256(d, jwk))) throw new Error('bad signature');
  return payload.sub;
}

// ── サービスアカウント → アクセストークン（スコープごとにキャッシュ） ──

let tokenCache = new Map();

export async function serviceAccountToken(sa, scope, { fetchImpl = fetch, now = Date.now() } = {}) {
  const hit = tokenCache.get(scope);
  if (hit && now < hit.until) return hit.token;
  const iat = Math.floor(now / 1000);
  const assertion = await signRs256(
    { kid: sa.private_key_id },
    { iss: sa.client_email, scope, aud: sa.token_uri || 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 },
    sa.private_key,
  );
  const res = await fetchImpl(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion}`,
  });
  if (!res.ok) throw new Error(`oauth ${res.status}`);
  const body = await res.json();
  tokenCache.set(scope, { token: body.access_token, until: now + (Number(body.expires_in || 3600) - 120) * 1000 });
  return body.access_token;
}

// ── Firestore REST（サービスアカウントで読む＝セキュリティルールの外） ──

const FS_SCOPE = 'https://www.googleapis.com/auth/datastore';

export function firestore(env, { fetchImpl = fetch, now } = {}) {
  const sa = typeof env.GCP_SERVICE_ACCOUNT === 'string' ? JSON.parse(env.GCP_SERVICE_ACCOUNT) : env.GCP_SERVICE_ACCOUNT;
  const project = env.FIREBASE_PROJECT_ID;
  const root = `projects/${project}/databases/(default)/documents`;
  const base = `https://firestore.googleapis.com/v1/${root}`;
  const auth = async () => ({
    Authorization: `Bearer ${await serviceAccountToken(sa, FS_SCOPE, { fetchImpl, now })}`,
  });

  return {
    root,
    /** ドキュメントを読む。無ければ null */
    async get(path) {
      const res = await fetchImpl(`${base}/${path}`, { headers: await auth() });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`firestore get ${res.status}`);
      return fromFields((await res.json()).fields || {});
    },
    /** まとめて書く（全部成功か全部失敗）。writes は REST の Write 形式 */
    async commit(writes) {
      const res = await fetchImpl(`${base}:commit`, {
        method: 'POST',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`firestore commit ${res.status}`);
        err.status = res.status;
        err.body = text;
        throw err;
      }
      return res.json();
    },
  };
}

/** Firestore REST の Value → JS の値 */
export function fromValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return null;
}

export function fromFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = fromValue(v);
  return out;
}

/** JS の値 → Firestore REST の Value（文字列・数・真偽・null だけで足りる） */
export function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  throw new Error(`unsupported value ${typeof v}`);
}

export function toFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = toValue(v);
  return out;
}
