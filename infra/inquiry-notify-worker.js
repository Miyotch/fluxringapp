/**
 * inquiry-notify-worker.js — お問い合わせ受信時の管理者メール通知 Worker（テンプレート）
 * ==================================================================
 * 役割:
 *   1) Firebase ID トークンを検証（ログイン中のアプリユーザーからの呼び出しだけを許可。
 *      認証を挟まないと誰でもエンドポイントを叩けて Resend の送信コストが食い荒らされる）
 *   2) 本文を整形し、Resend（https://resend.com）経由で管理者へメール通知
 *
 * 呼び出し元: lib/submitInquiry.ts が、Firestore の inquiries コレクションへの
 * 書き込みが成功した"あと"に、ベストエフォートでこの Worker を叩く。
 *   → 通知メールの送信に失敗しても、お問い合わせ自体は Firestore に必ず残る
 *     （運営は Firestore を見れば拾える。メールは「早く気づくための」保険）。
 *
 * ------------------------------------------------------------------
 * デプロイ:
 *   wrangler.toml（同梱）:
 *     name = "fluxring-inquiry-notify"
 *     main = "inquiry-notify-worker.js"
 *     compatibility_date = "2024-11-01"
 *     [vars]
 *       FIREBASE_PROJECT_ID = "sound-curtain-5unwwh"
 *       FROM_EMAIL = "FLUX RING <notify@yourdomain>"   # Resend で送信ドメイン認証が必要
 *       ADMIN_EMAIL = "admin@example.com"              # カンマ区切りで複数可
 *
 *   Secrets（値をコードや wrangler.toml に直書きしない）:
 *     $ wrangler secret put RESEND_API_KEY
 *       → Resend ダッシュボード（https://resend.com/api-keys）で発行した
 *         API キー（re_ から始まる文字列）を入力
 *
 *   $ wrangler deploy
 *   → 発行された Worker の URL を app.json の extra.inquiry.notifyWorkerUrl に設定。
 *     （constants/inquiryConfig.ts が読む。未設定のあいだは通知を試みず、
 *      お問い合わせの Firestore への記録だけは従来どおり動く）
 *
 * 事前準備（Resend 側）:
 *   1. https://resend.com でアカウント作成
 *   2. 送信元に使うドメインを Domains から追加し、指示される DNS レコード
 *      （SPF/DKIM）をドメインの DNS に設定して認証を通す
 *      （認証前のドメインからは実運用の送信ができない／制限が強い）
 *   3. API Keys から Sending 権限のキーを発行 → 上記 Secrets に設定
 * ------------------------------------------------------------------
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const TYPE_LABEL = {
  bug: '不具合の報告',
  billing: '支払いに関して',
  other: 'その他',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS });
    }

    // ── 1) 認証（ログイン中のアプリユーザーのみ）──
    const authz = request.headers.get('Authorization') || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    if (!token) {
      return new Response('Unauthorized', { status: 401, headers: CORS });
    }
    let claims;
    try {
      claims = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);
    } catch (e) {
      return new Response(`Unauthorized: ${e.message}`, { status: 401, headers: CORS });
    }

    // ── 2) 本文の受け取り ──
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad Request: invalid JSON', { status: 400, headers: CORS });
    }
    const type = typeof body?.type === 'string' ? body.type : 'other';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return new Response('Bad Request: message is required', { status: 400, headers: CORS });
    }

    // メールアドレスはトークンの検証済みクレームを正とする
    // （クライアントが送ってきた値は信用しない＝なりすまし防止）。
    const senderEmail = claims.email || '（メールアドレス未設定）';
    const senderUid = claims.user_id || claims.sub || '不明';
    const typeLabel = TYPE_LABEL[type] || type;

    if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !env.ADMIN_EMAIL) {
      return new Response('Server not configured (RESEND_API_KEY/FROM_EMAIL/ADMIN_EMAIL)', {
        status: 500,
        headers: CORS,
      });
    }

    // ── 3) Resend でメール送信 ──
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: env.ADMIN_EMAIL.split(',').map((s) => s.trim()).filter(Boolean),
        // 返信すればそのまま問い合わせ主へ届くように reply_to を立てる
        reply_to: senderEmail !== '（メールアドレス未設定）' ? senderEmail : undefined,
        subject: `[FLUX RING] 新しいお問い合わせ（${typeLabel}）`,
        text:
          `種類: ${typeLabel}\n` +
          `送信元: ${senderEmail}（uid: ${senderUid}）\n` +
          `\n---\n${message}\n---\n`,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text().catch(() => '');
      return new Response(`Resend error: ${resendRes.status} ${errText}`, {
        status: 502,
        headers: CORS,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  },
};

// ── Firebase ID トークン検証（infra/r2-audio-worker.js と同じ実装） ──
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
