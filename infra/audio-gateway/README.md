# audio-gateway — フル音源の配信と購入の検証

Cloudflare Workers。旧 `infra/r2-audio-worker.js`（テンプレート・未デプロイ）を置き換える。

```
アプリ ──(Firebase ID トークン)──▶ POST /v1/stream-url {trackId}
                                    │ users/{uid}/purchases/{trackId} を確認（無料曲は price==0 で通す）
                                    │ tracks/{id}/private/audio.objectKey（移行前は r2_url）を読む
                                    ◀── { url: 署名URL（6時間）, expiresAt }
プレイヤー／端末保存 ──▶ GET /v1/stream?k&u&e&s ──▶ R2（非公開）  Range 対応

アプリ ──(ストアの購入)──▶ POST /v1/iap/verify {platform, productId, purchaseToken, transactionId}
                            │ iOS: App Store Server API で取引を引き直す（本番→Sandbox）
                            │ Android: Play Developer API で確認し acknowledge
                            │ 1回の commit で: iap_transactions/{支払い}（使い回し防止）
                            │                 users/{uid}/purchases/{trackId}
                            │                 purchase_history/{自動}（売上の元帳）
                            ◀── 200 verified ／ 202 保留 ／ 402 不正 ／ 409 別アカウントで使用済み
```

## テスト

```bash
cd infra/audio-gateway
npm test
```

Google・Apple・R2 は偽物に差し替えて、判断（401/403/402/409・署名・Range）だけを確かめる。

## 出す順番（古いアプリを鳴らなくしないため、この順を守る）

1. **シークレットを入れてデプロイ**（バケットはまだ公開のまま）
   ```bash
   npx wrangler secret put GCP_SERVICE_ACCOUNT     # Firestore を読み書きできる SA の JSON
   npx wrangler secret put STREAM_SIGNING_KEY      # openssl rand -base64 48
   npx wrangler secret put APPLE_IAP_ISSUER_ID     # App Store Connect › ユーザとアクセス › 統合 › アプリ内課金
   npx wrangler secret put APPLE_IAP_KEY_ID
   npx wrangler secret put APPLE_IAP_PRIVATE_KEY   # .p8 の中身
   npx wrangler secret put PLAY_SERVICE_ACCOUNT    # Play Console で権限を付けた SA の JSON
   npx wrangler deploy
   ```
   `curl https://<worker>/v1/health` → `{"ok":true}`
2. **音源の場所を非公開側へ写す**（公開ドキュメントの r2_url はまだ消さない）
   ```bash
   node scripts/move-audio-keys.mjs <SA.json>          # 表示だけ
   node scripts/move-audio-keys.mjs <SA.json> --write
   ```
3. **ストアに商品を作る** — 有料曲1曲ごとに `com.fluxring.app.track.<tracks のドキュメントID>`。
   iOS は非消費型、Android は1回限りの製品（消費しない）。
4. **アプリを出す** — `app.json` の `extra.r2.workerUrl` に Worker の URL。これで
   `usePurchaseFlow.ts` のモック購入は自動で切れ、本物の課金と署名URLの再生になる。
5. **新しいアプリが行き渡ってから閉じる**
   - `firestore.rules.proposed` を確かめて入れる（管理画面の書き込み方法を先に確認）
   - `node scripts/move-audio-keys.mjs <SA.json> --write --strip`（公開ドキュメントから r2_url を消す）
   - R2 のフル音源バケットの公開アクセス（r2.dev・カスタムドメイン）を切る。
     **試聴が同じバケット（`previewBaseUrl` の pub-…r2.dev）にあるなら、先に試聴を別の公開バケットへ移す**

## まだ無いもの

- 返金・取り消しの反映（App Store Server Notifications V2 / Play の RTDN → purchases に `revoked: true`）。
  gateway は `revoked: true` の購入を通さないところまでは入っている
- 管理画面が新しい曲を `tracks/{id}/private/audio` に書くこと（直すまでは r2_url を読むので鳴る）
- 管理画面が `tracks/{id}.durationSec` を書くこと（無くてもアプリが WAV のヘッダから出す）
