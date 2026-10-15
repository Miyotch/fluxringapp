/**
 * crypto.js — JWT・署名まわり（Workers と Node 20+ の WebCrypto だけで動く）
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlEncode(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const b64urlJson = (obj) => b64urlEncode(enc.encode(JSON.stringify(obj)));

export function decodeJwt(jwt) {
  const parts = String(jwt || '').split('.');
  if (parts.length !== 3) throw new Error('malformed jwt');
  return {
    header: JSON.parse(dec.decode(b64urlDecode(parts[0]))),
    payload: JSON.parse(dec.decode(b64urlDecode(parts[1]))),
    signingInput: enc.encode(`${parts[0]}.${parts[1]}`),
    signature: b64urlDecode(parts[2]),
  };
}

function pemToDer(pem) {
  const body = String(pem)
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  return b64urlDecode(body.replace(/\+/g, '-').replace(/\//g, '_'));
}

/** RS256 で署名した JWT（Google サービスアカウントの OAuth 用） */
export async function signRs256(header, payload, pkcs8Pem) {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(pkcs8Pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const input = `${b64urlJson({ alg: 'RS256', typ: 'JWT', ...header })}.${b64urlJson(payload)}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(input));
  return `${input}.${b64urlEncode(sig)}`;
}

/** ES256 で署名した JWT（App Store Server API 用。.p8 の PKCS8 鍵） */
export async function signEs256(header, payload, pkcs8Pem) {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(pkcs8Pem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const input = `${b64urlJson({ alg: 'ES256', typ: 'JWT', ...header })}.${b64urlJson(payload)}`;
  // WebCrypto の ECDSA 署名は r||s（IEEE P1363）で、JWS の形そのまま
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(input));
  return `${input}.${b64urlEncode(sig)}`;
}

/** RS256 の検証（鍵は JWK） */
export async function verifyRs256(decoded, jwk) {
  const key = await crypto.subtle.importKey(
    'jwk',
    { ...jwk, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decoded.signature, decoded.signingInput);
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function hmacSign(secret, message) {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(message));
  return b64urlEncode(sig);
}

/** 時間が一定の比較（crypto.subtle.verify に任せる） */
export async function hmacVerify(secret, message, sigB64url) {
  let sig;
  try {
    sig = b64urlDecode(sigB64url);
  } catch {
    return false;
  }
  return crypto.subtle.verify('HMAC', await hmacKey(secret), sig, enc.encode(message));
}
