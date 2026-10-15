// node --test infra/audio-gateway/test
// 外部（Google・Apple・R2）はすべて偽物に差し替えて、ゲートウェイの判断だけを確かめる。
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, parseRange, objectKeyFromUrl, trackIdOfProduct } from '../src/index.js';
import { _resetCaches } from '../src/google.js';
import { b64urlJson, b64urlEncode } from '../src/crypto.js';

const PROJECT = 'demo-project';
const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);
const sec = Math.floor(NOW / 1000);

// ── 鍵を作る ──
const rsa = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify'],
);
const jwk = { ...(await crypto.subtle.exportKey('jwk', rsa.publicKey)), kid: 'k1', use: 'sig' };
const pkcs8 = (der) => `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString('base64')}\n-----END PRIVATE KEY-----\n`;
const rsaPem = pkcs8(await crypto.subtle.exportKey('pkcs8', rsa.privateKey));
const ec = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const ecPem = pkcs8(await crypto.subtle.exportKey('pkcs8', ec.privateKey));

async function idToken(uid, over = {}) {
  const h = b64urlJson({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
  const p = b64urlJson({
    aud: PROJECT,
    iss: `https://securetoken.google.com/${PROJECT}`,
    sub: uid,
    iat: sec - 10,
    exp: sec + 3000,
    auth_time: sec - 100,
    ...over,
  });
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', rsa.privateKey, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64urlEncode(sig)}`;
}

// ── 偽の Firestore ──
function fsValue(v) {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  return { nullValue: null };
}

function makeWorld() {
  const docs = new Map(); // path → plain object
  const commits = [];
  const appleTx = new Map(); // transactionId → payload
  const playTx = new Map();
  const acks = [];
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    if (url.startsWith('https://www.googleapis.com/service_accounts/v1/jwk/')) {
      return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'cache-control': 'max-age=600' } });
    }
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'sa-token', expires_in: 3600 });
    }
    const fsBase = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
    if (url === `${fsBase}:commit`) {
      const { writes } = JSON.parse(init.body);
      for (const w of writes) {
        const path = w.update.name.split('/documents/')[1];
        if (w.currentDocument?.exists === false && docs.has(path)) {
          return new Response('{"error":"ALREADY_EXISTS"}', { status: 409 });
        }
      }
      for (const w of writes) {
        const path = w.update.name.split('/documents/')[1];
        const obj = {};
        for (const [k, v] of Object.entries(w.update.fields)) obj[k] = Object.values(v)[0];
        if (obj.integerValue) obj.integerValue = Number(obj.integerValue);
        docs.set(path, obj);
      }
      commits.push(writes);
      return Response.json({ writeResults: [] });
    }
    if (url.startsWith(`${fsBase}/`)) {
      const path = url.slice(fsBase.length + 1);
      const d = docs.get(path);
      if (!d) return new Response('{}', { status: 404 });
      const fields = {};
      for (const [k, v] of Object.entries(d)) fields[k] = fsValue(v);
      return Response.json({ fields });
    }
    const m = /^https:\/\/api\.storekit(-sandbox)?\.itunes\.apple\.com\/inApps\/v1\/transactions\/(\d+)$/.exec(url);
    if (m) {
      assert.match(init.headers.Authorization, /^Bearer ey/);
      const tx = appleTx.get(m[2]);
      const sandbox = !!m[1];
      if (!tx || tx.sandbox !== sandbox) return new Response('{}', { status: 404 });
      const jws = `${b64urlJson({ alg: 'ES256' })}.${b64urlJson(tx.payload)}.sig`;
      return Response.json({ signedTransactionInfo: jws });
    }
    const g = /\/purchases\/products\/([^/]+)\/tokens\/([^/:]+)(:acknowledge)?$/.exec(url);
    if (g) {
      if (g[3]) {
        acks.push(g[2]);
        return Response.json({});
      }
      const p = playTx.get(decodeURIComponent(g[2]));
      if (!p) return new Response('{}', { status: 404 });
      return Response.json(p);
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const blob = new Uint8Array(1000).map((_, i) => i % 256);
  const AUDIO = {
    async head(k) {
      return k === 'full/snow.wav'
        ? { size: blob.length, httpEtag: '"e1"', httpMetadata: { contentType: 'audio/wav' } }
        : null;
    },
    async get(k, opts) {
      if (k !== 'full/snow.wav') return null;
      const r = opts?.range;
      const slice = r ? blob.slice(r.offset, r.offset + r.length) : blob;
      return { body: slice };
    },
  };
  const env = {
    FIREBASE_PROJECT_ID: PROJECT,
    GCP_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'sa@x', private_key: rsaPem, private_key_id: 'p1' }),
    PLAY_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'play@x', private_key: rsaPem, private_key_id: 'p2' }),
    STREAM_SIGNING_KEY: 'test-signing-key-0123456789abcdef',
    APPLE_IAP_ISSUER_ID: 'issuer',
    APPLE_IAP_KEY_ID: 'KEY123',
    APPLE_IAP_PRIVATE_KEY: ecPem,
    APPLE_BUNDLE_ID: 'com.fluxring.app',
    APPLE_ALLOW_SANDBOX: 'true',
    ANDROID_PACKAGE: 'com.fluxring.app',
    PRODUCT_ID_PREFIX: 'com.fluxring.app.track.',
    AUDIO,
  };
  docs.set('tracks/snow', { title: 'Snow in Focus', price: 2500, r2_url: 'https://pub.example.r2.dev/full/snow.wav', artistId: 'oka' });
  docs.set('tracks/free1', { title: 'Free', price: 0, r2_url: 'https://pub.example.r2.dev/full/snow.wav' });
  return { docs, commits, appleTx, playTx, acks, env, fetchImpl, blob };
}

const call = (w, path, { method = 'GET', body, token, headers = {}, now = NOW } = {}) =>
  handle(
    new Request(`https://gw.example.com${path}`, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    }),
    w.env,
    { fetchImpl: w.fetchImpl, now },
  );

test.beforeEach(() => _resetCaches());

test('parseRange / objectKeyFromUrl / trackIdOfProduct', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { offset: 0, length: 100 });
  assert.deepEqual(parseRange('bytes=900-', 1000), { offset: 900, length: 100 });
  assert.deepEqual(parseRange('bytes=-10', 1000), { offset: 990, length: 10 });
  assert.equal(parseRange('bytes=2000-', 1000), 'unsatisfiable');
  assert.equal(parseRange(null, 1000), null);
  assert.equal(objectKeyFromUrl('https://a.r2.dev/full/%E9%9B%AA.wav'), 'full/雪.wav');
  assert.equal(trackIdOfProduct('com.fluxring.app.track.snow', 'com.fluxring.app.track.'), 'snow');
  assert.equal(trackIdOfProduct('com.other.snow', 'com.fluxring.app.track.'), null);
  assert.equal(trackIdOfProduct('com.fluxring.app.track.../x', 'com.fluxring.app.track.'), null);
});

test('未ログイン・偽トークン・期限切れは 401', async () => {
  const w = makeWorld();
  assert.equal((await call(w, '/v1/stream-url', { method: 'POST', body: { trackId: 'snow' } })).status, 401);
  const forged = (await idToken('u1')).replace(/\.[^.]+$/, '.AAAA');
  assert.equal((await call(w, '/v1/stream-url', { method: 'POST', body: { trackId: 'snow' }, token: forged })).status, 401);
  const expired = await idToken('u1', { exp: sec - 3600 });
  assert.equal((await call(w, '/v1/stream-url', { method: 'POST', body: { trackId: 'snow' }, token: expired })).status, 401);
  const otherProject = await idToken('u1', { aud: 'evil' });
  assert.equal((await call(w, '/v1/stream-url', { method: 'POST', body: { trackId: 'snow' }, token: otherProject })).status, 401);
});

test('持っていない有料曲は 403、無料曲は通る', async () => {
  const w = makeWorld();
  const t = await idToken('u1');
  assert.equal((await call(w, '/v1/stream-url', { method: 'POST', body: { trackId: 'snow' }, token: t })).status, 403);
  assert.equal((await call(w, '/v1/stream-url', { method: 'POST', body: { trackId: 'free1' }, token: t })).status, 200);
  assert.equal((await call(w, '/v1/stream-url', { method: 'POST', body: { trackId: '../x' }, token: t })).status, 400);
});

test('購入済みなら署名URL → Range で流れる。改ざん・期限切れは 403', async () => {
  const w = makeWorld();
  w.docs.set('users/u1/purchases/snow', { trackId: 'snow' });
  const t = await idToken('u1');
  const res = await call(w, '/v1/stream-url', { method: 'POST', body: { trackId: 'snow' }, token: t });
  assert.equal(res.status, 200);
  const { url, expiresAt } = await res.json();
  assert.ok(expiresAt > NOW);
  const path = url.replace('https://gw.example.com', '');

  const full = await call(w, path);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('accept-ranges'), 'bytes');
  assert.equal((await full.arrayBuffer()).byteLength, 1000);

  const part = await call(w, path, { headers: { Range: 'bytes=10-19' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), 'bytes 10-19/1000');
  assert.deepEqual([...new Uint8Array(await part.arrayBuffer())], [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);

  assert.equal((await call(w, path, { headers: { Range: 'bytes=5000-' } })).status, 416);
  assert.equal((await call(w, path.replace('k=full', 'k=other'))).status, 403);
  assert.equal((await call(w, path, { now: NOW + 7 * 3600_000 })).status, 403);
});

test('private/audio.objectKey があれば r2_url より優先', async () => {
  const w = makeWorld();
  w.docs.set('users/u1/purchases/snow', { trackId: 'snow' });
  w.docs.set('tracks/snow', { title: 'Snow', price: 2500 }); // 公開ドキュメントから r2_url を外した後
  w.docs.set('tracks/snow/private/audio', { objectKey: 'full/snow.wav' });
  const res = await call(w, '/v1/stream-url', { method: 'POST', body: { trackId: 'snow' }, token: await idToken('u1') });
  assert.equal(res.status, 200);
  assert.match((await res.json()).url, /k=full%2Fsnow\.wav/);
});

test('iOS: 本物の購入なら権利と履歴を1回で書く。別アカウントの使い回しは 409', async () => {
  const w = makeWorld();
  w.appleTx.set('2000001', {
    sandbox: true,
    payload: {
      bundleId: 'com.fluxring.app',
      productId: 'com.fluxring.app.track.snow',
      transactionId: '2000001',
      originalTransactionId: '2000001',
      purchaseDate: NOW - 1000,
      type: 'Non-Consumable',
    },
  });
  const body = { platform: 'ios', productId: 'com.fluxring.app.track.snow', transactionId: '2000001' };
  const r1 = await call(w, '/v1/iap/verify', { method: 'POST', body, token: await idToken('u1') });
  assert.equal(r1.status, 200);
  assert.equal((await r1.json()).trackId, 'snow');
  assert.ok(w.docs.has('users/u1/purchases/snow'));
  assert.equal(w.commits.length, 1);
  assert.equal(w.commits[0].length, 3);

  // 同じ人がもう一度 → そのまま成功（finish の取りこぼし対策）
  const r2 = await call(w, '/v1/iap/verify', { method: 'POST', body, token: await idToken('u1') });
  assert.equal(r2.status, 200);
  assert.equal(w.commits.length, 1);

  // 別の人が同じ支払いを送る → 409
  const r3 = await call(w, '/v1/iap/verify', { method: 'POST', body, token: await idToken('u2') });
  assert.equal(r3.status, 409);
  assert.ok(!w.docs.has('users/u2/purchases/snow'));
});

test('iOS: 商品違い・取り消し・存在しない取引は 402', async () => {
  const w = makeWorld();
  const base = { bundleId: 'com.fluxring.app', transactionId: '1', originalTransactionId: '1', type: 'Non-Consumable' };
  w.appleTx.set('1', { sandbox: false, payload: { ...base, productId: 'com.fluxring.app.track.other' } });
  w.appleTx.set('2', { sandbox: false, payload: { ...base, transactionId: '2', productId: 'com.fluxring.app.track.snow', revocationDate: NOW } });
  const t = await idToken('u1');
  for (const id of ['1', '2', '999']) {
    const r = await call(w, '/v1/iap/verify', {
      method: 'POST',
      body: { platform: 'ios', productId: 'com.fluxring.app.track.snow', transactionId: id },
      token: t,
    });
    assert.equal(r.status, 402, `tx ${id}`);
  }
  assert.equal(w.commits.length, 0);
});

test('Android: 購入済みは acknowledge して権利を書く。保留は 202', async () => {
  const w = makeWorld();
  w.playTx.set('tok-ok', { purchaseState: 0, acknowledgementState: 0, orderId: 'GPA.1', purchaseTimeMillis: String(NOW) });
  w.playTx.set('tok-pending', { purchaseState: 2, acknowledgementState: 0, orderId: 'GPA.2' });
  const t = await idToken('u1');
  const ok = await call(w, '/v1/iap/verify', {
    method: 'POST',
    body: { platform: 'android', productId: 'com.fluxring.app.track.snow', purchaseToken: 'tok-ok' },
    token: t,
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(w.acks, ['tok-ok']);
  assert.ok(w.docs.has('users/u1/purchases/snow'));
  const pending = await call(w, '/v1/iap/verify', {
    method: 'POST',
    body: { platform: 'android', productId: 'com.fluxring.app.track.snow', purchaseToken: 'tok-pending' },
    token: t,
  });
  assert.equal(pending.status, 202);
});

test('知らない商品ID・知らない曲は 400', async () => {
  const w = makeWorld();
  const t = await idToken('u1');
  const r = await call(w, '/v1/iap/verify', {
    method: 'POST',
    body: { platform: 'ios', productId: 'com.evil.track.snow', transactionId: '1' },
    token: t,
  });
  assert.equal(r.status, 400);
});
