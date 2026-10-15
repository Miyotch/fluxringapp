/**
 * stores.js — App Store / Google Play に購入を問い合わせる
 *
 * どちらも「アプリから届いた値は信用せず、ストアのサーバに聞き直す」。
 * 戻り値はどちらも同じ形:
 *   { ok: true, productId, transactionKey, purchasedAtMs, environment }
 *   { ok: false, reason }
 * transactionKey は「この支払い1件」を表す一意の値（同じ支払いで別アカウントへ
 * 権利を付けさせないための鍵）。
 */

import { decodeJwt, signEs256 } from './crypto.js';
import { serviceAccountToken } from './google.js';

const APPLE_PROD = 'https://api.storekit.itunes.apple.com';
const APPLE_SANDBOX = 'https://api.storekit-sandbox.itunes.apple.com';

async function appleJwt(env, now) {
  const iat = Math.floor(now / 1000);
  return signEs256(
    { kid: env.APPLE_IAP_KEY_ID },
    { iss: env.APPLE_IAP_ISSUER_ID, iat, exp: iat + 600, aud: 'appstoreconnect-v1', bid: env.APPLE_BUNDLE_ID },
    env.APPLE_IAP_PRIVATE_KEY,
  );
}

/**
 * App Store Server API の Get Transaction Info。本番に無ければ Sandbox（TestFlight・審査）に聞く。
 * 応答の signedTransactionInfo は Apple の TLS 越しに Apple から直接受け取ったものなので、
 * x5c の証明書チェーン検証は省き、中身（payload）だけを読む。
 */
export async function verifyApple(env, { transactionId, productId }, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!/^\d{1,32}$/.test(String(transactionId || ''))) return { ok: false, reason: 'bad_transaction_id' };
  const token = await appleJwt(env, now);
  let info = null;
  let environment = 'Production';
  for (const [base, envName] of [
    [APPLE_PROD, 'Production'],
    [APPLE_SANDBOX, 'Sandbox'],
  ]) {
    if (envName === 'Sandbox' && env.APPLE_ALLOW_SANDBOX !== 'true') break;
    const res = await fetchImpl(`${base}/inApps/v1/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) continue;
    if (!res.ok) return { ok: false, reason: `apple_${res.status}` };
    const body = await res.json();
    info = decodeJwt(body.signedTransactionInfo).payload;
    environment = envName;
    break;
  }
  if (!info) return { ok: false, reason: 'not_found' };
  if (info.bundleId !== env.APPLE_BUNDLE_ID) return { ok: false, reason: 'bundle_mismatch' };
  if (info.productId !== productId) return { ok: false, reason: 'product_mismatch' };
  if (info.revocationDate) return { ok: false, reason: 'revoked' };
  if (info.type && info.type !== 'Non-Consumable') return { ok: false, reason: 'not_non_consumable' };
  return {
    ok: true,
    productId: info.productId,
    transactionKey: `apple_${info.originalTransactionId || info.transactionId}`,
    purchasedAtMs: Number(info.purchaseDate) || now,
    environment,
  };
}

const PLAY_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

/** Google Play Developer API purchases.products.get（必要なら acknowledge まで） */
export async function verifyGoogle(env, { purchaseToken, productId }, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!purchaseToken || typeof purchaseToken !== 'string' || purchaseToken.length > 4096) {
    return { ok: false, reason: 'bad_token' };
  }
  const sa = typeof env.PLAY_SERVICE_ACCOUNT === 'string' ? JSON.parse(env.PLAY_SERVICE_ACCOUNT) : env.PLAY_SERVICE_ACCOUNT;
  const token = await serviceAccountToken(sa, PLAY_SCOPE, { fetchImpl, now });
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${env.ANDROID_PACKAGE}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetchImpl(base, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404 || res.status === 400) return { ok: false, reason: 'not_found' };
  if (!res.ok) return { ok: false, reason: `google_${res.status}` };
  const p = await res.json();
  // purchaseState: 0 購入済 / 1 取消 / 2 保留
  if (p.purchaseState === 2) return { ok: false, reason: 'pending' };
  if (p.purchaseState !== 0) return { ok: false, reason: 'cancelled' };
  // 3日以内に acknowledge しないと自動返金される。サーバで確実に済ませる
  if (p.acknowledgementState === 0) {
    const ack = await fetchImpl(`${base}:acknowledge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!ack.ok && ack.status !== 400) return { ok: false, reason: `ack_${ack.status}` };
  }
  return {
    ok: true,
    productId,
    transactionKey: `google_${p.orderId || purchaseToken.slice(0, 64)}`,
    purchasedAtMs: Number(p.purchaseTimeMillis) || now,
    environment: p.purchaseType === 0 ? 'Sandbox' : 'Production',
  };
}
