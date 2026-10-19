# FLUX RING — プロジェクト仕様（Claude 参照用）

このファイルは Claude がコードを生成・修正する際に参照する、アプリ全体の仕様書です。

---

## スタック

| 項目 | 値 |
|------|-----|
| フレームワーク | Expo SDK 56 (New Architecture `newArchEnabled: true`) |
| 言語 | TypeScript |
| レンダリング | @shopify/react-native-skia 2.6.2 |
| アニメーション | react-native-reanimated 4.3.1 + react-native-worklets 0.8.3 |
| エントリポイント | `index.js` → `registerRootComponent(App)` |
| バンドル ID (iOS) | `com.fluxring.app` |
| パッケージ名 (Android) | `com.fluxring.app` |
| EAS projectId | `d94a1082-9da2-459a-88b4-cd593c16eed3` |
| ビジュアルテーマ | ダーク (`userInterfaceStyle: "dark"`, 背景 `#0E0C20`) |

---

## 画面遷移図（確定済み・VIPまで）

```
起動
 └─► オンボーディング P0（情景×3）
      └─► サインアップ / ログイン
           └─► [ハブ] ディスカバー（ホーム）P2
                │   ※横スワイプ＝曲切替、スピーカーアイコン＝試聴（同画面内）
                │
                ├─► [ハブ] ストーリー P2.1 ◄──（同画面操作で相互）──► ディスカバー
                │         └─► 通知一覧
                │
                └─► 購入トランジション
                         └─► 再生画面
```

### フッター 5 タブ

- **4 タブ（ホーム/コレクション/VIP/メディア/設定）はいつでも相互遷移可**
- **プレイヤー画面・ストーリー画面・購入完了画面ではフッター非表示**

```
フッター
 ├─ ホーム ─────────────────────► ディスカバー（ホーム）P2
 │
 ├─ コレクション ─────────────────► コレクション P3（2列グリッド）
 │                                    └─► 再生画面
 │
 ├─ VIP ──────────────────────────► VIPロック（未成約）
 │                                    └─► VIP解放：カード表↔裏（めくり）
 │                                         └─► コード入力
 │
 ├─ メディア ──────────────────────► メディア（記事 / SNS）
 │
 └─ 設定 ────────────────────────► アカウント / 購入の復元
                                    │    └─► 作家一覧
                                    │         └─► 作家プロフィール
                                    │              └─► 楽曲一覧（所有=明/未所有=影）
                                    │                   └─► ストーリー P2.1
                                    ├─► Artistのご紹介
                                    └─► 言語 / サポート / 情報
```

---

## 画面一覧と役割

| 画面 ID | 画面名 | 役割 |
|---------|--------|------|
| P0 | オンボーディング | 情景3枚のスライド。初回起動のみ |
| — | サインアップ / ログイン | 認証フロー |
| P2 | ディスカバー（ホーム）| **ハブ画面**。横スワイプで曲切替、試聴ボタン同画面 |
| P2.1 | ストーリー | **ハブ画面**。ディスカバーから展開。通知一覧へ遷移可 |
| — | 通知一覧 | ストーリーから遷移 |
| — | 購入トランジション | 購入演出（PurchaseTransition コンポーネント）|
| — | 再生画面（プレイヤー）| フッター非表示。コレクション / 購入後に遷移 |
| P3 | コレクション | 2列グリッド。所有楽曲一覧 |
| — | VIPロック | 未成約状態のVIPタブ |
| — | VIP解放 | カード表↔裏めくりアニメーション |
| — | コード入力 | VIPコード入力 |
| — | メディア | 記事・SNS コンテンツ |
| — | 設定 | アカウント / 作家紹介 / 言語・サポート |
| — | 作家一覧 | Artist 一覧 |
| — | 作家プロフィール | 個別Artist |
| — | 楽曲一覧 | 所有=明るい表示、未所有=暗い表示 |

---

## コンポーネント構成（`components/`）

| ファイル | 役割 |
|----------|------|
| `ArtworkCard.tsx` | カード構造の土台（台紙・画像・シアン縁・クリアガラス・オーラ）。`hero` propでヒーロー統合 |
| `GlassFilter.tsx` | ガラス効果 4種（clear / grain / matte / vignette）|
| `HeroGlow.tsx` | 蛍の明滅グロー（reanimated SharedValue + screen blend + RadialGradient）|
| `StarBurst.tsx` | 星の一斉点火。`forwardRef` で `trigger()` を外部公開 |
| `PurchaseTransition.tsx` | 起点可変の拡大＋呼吸＋星点火＋トランスポート表示を統括 |

---

## 画面構成（`screens/`）

ワイヤーフレーム V4 / 各画面モックに基づくスケルトン実装。`App.tsx` が state ベースで結線。

| ファイル | 画面 | 役割 |
|----------|------|------|
| `OnboardingScreen.tsx` | P0 | 情景3枚の横スワイプ → サインアップ/ログイン |
| `AuthScreen.tsx` | — | サインアップ / ログイン（メール・Google・Apple） |
| `DiscoverScreen.tsx` | P2 | ハブ。横スワイプ曲切替・試聴・購入トランジション。起動後1回だけ intro（暗転→星空→調律陣→カード→文字の順に点灯。定数は `HOME_INTRO`）|
| `StoryScreen.tsx` | P2.1 | サムネ→Story→調律素材→Artist（フロスト分離・固定位置） |
| `PlayerScreen.tsx` | — | 再生画面。共有カード＋フロストのトランスポート |
| `CollectionScreen.tsx` | P3 | プレイリスト画面。タブ＝所有カード／プレイリスト▾／すべて。行はタップ＝再生・長押し＝「プレイリストに追加」（所有カード・保存した曲）。**自分のプレイリストの中では長押し＝その曲のメニュー**（このリストから外す／ほかのプレイリストにも追加／曲順を並べ替える、`TrackActionSheet`）。「すべて」の板はシリーズごとの塊（新しいシリーズが上・中は番号の大きい順・見出しは上に留まり押すと開閉・右に「所有 / 全曲」・空席なし）。曲名（通し番号・作家名も当たる）の検索と、1 行の「すべてのシリーズ ▾」→ 選ぶシートで絞り込める。2026-10-18・10-19。新規・編集のシート（`PlaylistEditor`）は一枚の画面：下線だけの名前欄（「新規プレイリスト名」）・「合計：n曲　m分s秒」・右端の丸い＋で入れる／外す・サムネの再生ボタン・行は 上＝曲名／下＝シリアル · 作家名。2026-10-19。見出しの名前（▾）から出るシート（`PlaylistMenu`）は見出し「プレイリスト」・右上の「編集」なし・自分のプレイリストの行に常に「⋮」（押すと編集／削除）。2026-10-19 |
| `MediaScreen.tsx` | — | SNS常設＋記事一覧（入れた要素だけ表示） |
| `NotificationsScreen.tsx` | — | ベルから。時系列降順・未読は赤点のみ |
| `SettingsScreen.tsx` | P5 | 静かなリスト（確定8項目）・サインアウト・バージョン |
| `ArtistScreen.tsx` | — | 三階層: 作家一覧→プロフィール→楽曲一覧 |
| `VipScreen.tsx` | P4 | ロック / 解放（カード表↔裏フリップ）/ コード入力 |
| `ComponentGallery.tsx` | — | 旧 App.tsx の部品デモ（実機目視確認用） |

共有部品: `components/Footer.tsx`（5タブ）、スタブデータ: `constants/stubData.ts`、トークン: `constants/design-tokens.ts`。

---

## デザイントンマナ

- **背景色**: `#0E0C20`（深紺）
- **アクセント**: シアン系（縁取り・グロー）
- **カードオーラ**: Skia の RadialGradient + screen ブレンド
- **アニメーション方針**: reanimated worklet ベース（UIスレッド駆動）

---

## ビルド・デプロイ

```bash
# 開発ビルド（実機 / シミュレータ）
npx expo run:ios
npx expo run:android

# EAS クラウドビルド
eas build --platform ios --profile production
eas build --platform android --profile production

# EAS Submit（App Store Connect へ提出）
eas submit --platform ios --latest

# 検証用 APK をこの PC で作る（EAS に送らない。パッケージ名 com.fluxring.tsubasa・表示名「FluxRing 検証」）
# → apk-builds/FluxRing-verify-<version>-<日時>.apk（arm64-v8a のみ・デバッグ鍵）
npm run apk:verify
```

- `npm run apk:verify` は `scripts/build-apk-verify.mjs`。`app.config.js` が `APP_VARIANT=verify` のときだけパッケージ名を切り替え、`google-services.verify.json` を作る（それ以外のビルドには影響しない）。前提は Android SDK と JDK 17（`JAVA17_HOME` で指定可）。2026-10-18 に `build/tsubasa-card-swap` から main へ取り込んだ

- Expo Go 不可（Skia / reanimated worklet はネイティブ必須）
- New Architecture 必須（`newArchEnabled: true`）
- babel プラグイン: `react-native-worklets/plugin` を **plugins の末尾** に配置
- **iOS ビルドイメージは `macos-tahoe-26.5-xcode-26.6` 固定**（`eas.json` の `base` プロファイル。2026-10-18 に `latest` が Xcode 27.1 RC へ移り、Pods の一部（GoogleUtilities・RNSVG・AsyncStorage 等）の配置先 iOS 15 未満がエラーになってビルドが落ちたため、`latest` から固定へ変更）。`expo-iap` が依存する `openiap` は iOS 26 SDK の StoreKit API（`Product.SubscriptionInfo.PricingTerms` / `BillingPlanType` / `RenewalInfo.commitmentInfo` / `Transaction.billingPlanType`）を使うため、既定イメージ（Xcode 26 未満）では Swift のコンパイルが通らない
- EAS CLI は `npx eas-cli@latest ...` で呼ぶ。`npx eas ...` は npm 上の**別パッケージ**（`eas@0.1.0`）を取ってきて `could not determine executable to run` で落ちる

---

## 注意事項

- `StarBurst` の `colors`（粒の明るさ）は Skia バージョンで挙動が変わるため実機確認必須
- `DEMO_IMG` は確認用サンプルURL。本番は CloudFlare 配信の作品画像に差し替え
- 数値（発光強度・星の数・タイミング）は各ファイルの「実機調整ポイント」コメントを参照
- 仕様の正: `トンマナ仕様V2`（数値）・`UI構造資料V4`（構造）・`PRICING.md`（価格）
- 価格: toC 買い切り ¥2,500/曲（無料 ¥0）・toB 年間ライセンス ¥36,000/年・カスタム制作は価格協議中。定数は `constants/pricing.ts`、詳細は `PRICING.md`。月額サブスクは無し・「サブスク」語は対外的に使わない
