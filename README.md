# FLUX RING — Skia Starter（動く雛形）

4つの参照実装（ArtworkCard / HeroGlow / StarBurst / PurchaseTransition）を、クローンして実機で確認できる Expo プロジェクトにしたものです。上部タブで各部品を切り替えて目視できます。

---

## 重要な前提

- **この雛形は実機ビルドで動作確認していません。** 整合性を取った雛形として用意したもので、バージョンの組み合わせや設定は、お使いの環境に合わせて調整してください（理由：作成環境で RN/Skia の実機ビルドが走らないため）。
- **Expo Go では動きません。** Skia と reanimated（worklet）はネイティブを含むため、**開発ビルド（development build）** が必要です。下記手順参照。
- **New Architecture 前提**です（`app.json` の `newArchEnabled: true`）。Skia 2.x / reanimated 4.x は New Arch を要求します。

## セットアップ

```bash
# 1. 依存を入れる
npm install

# 2. バージョンを環境に合わせて揃え直す（推奨）
#    package.json の固定版が衝突する場合、expo install が SDK に合う版を入れ直す
npx expo install @shopify/react-native-skia react-native-reanimated react-native-worklets

# 3. 開発ビルドを作って実機/シミュレータで起動
npx expo run:ios      # iOS
npx expo run:android  # Android
#    または EAS Build（クラウドビルド）: eas build --profile development
```

`expo start --dev-client` は、開発ビルドを入れた端末に対して使います（Expo Go ではなく）。

## つまずきやすい点（重要）

1. **babel プラグイン**：`babel.config.js` の `react-native-worklets/plugin` は reanimated 4.x 用で、**plugins の最後**に置きます。reanimated 3.x を使う場合は `react-native-reanimated/plugin` に変えてください。入れ忘れると reanimated が動きません。
2. **バージョン整合**：Skia・reanimated・worklets・RN・Expo SDK はバージョンの相性があります。固定版で詰まったら `npx expo install` で揃えるのが速いです。
3. **New Architecture**：無効だと Skia 2.x / reanimated 4.x が動きません。`app.json` の `newArchEnabled` を確認。
4. **StarBurst の colors**：各粒の明るさを Atlas の `colors` で渡しています。Skia のバージョンで挙動が変わるため、最初に確認してください（`components/StarBurst.tsx` 末尾に代替案あり）。
5. **デモ画像**：`App.tsx` の `DEMO_IMG` は確認用のサンプルURLです。実運用では CloudFlare 配信の作品画像に差し替えます。

## 確認できること（App.tsx のタブ）

- **カード**：ArtworkCard（台紙・画像・シアン縁・クリアガラス・オーラ）。
- **ヒーロー**：ArtworkCard に `hero={{ enabled: true }}` を渡し、蛍の明滅を重ねた状態。
- **星点火**：StarBurst。「点火」ボタンで trigger。
- **購入**：PurchaseTransition。「購入する」ボタンで、起点（小さい矩形）から拡大しながら呼吸・点火・トランスポート表示まで再生。

## 本アプリへの組み込み

- 各部品は `components/` に独立しています。本アプリのリポジトリへコピーし、既存の Firebase / CloudFlare 連携や状態管理に繋いでください。
- 数値（発光強度・星の数・タイミング等）は各ファイルのコメントに「実機調整ポイント」を明記しています。
- 仕様の正は `トンマナ仕様V2`（数値）と `UI構造資料V4`（構造）です。

## 構成

```
fluxring-skia-starter/
├─ App.tsx              デモ（4部品をタブ切替）
├─ app.json            Expo設定（newArchEnabled: true）
├─ babel.config.js     reanimated/worklets プラグイン
├─ metro.config.js     既定のまま
├─ package.json        依存（expo install で揃え直し推奨）
├─ tsconfig.json
└─ components/
   ├─ ArtworkCard.tsx       カード構造の土台（hero でヒーロー統合）
   ├─ HeroGlow.tsx          蛍の明滅
   ├─ StarBurst.tsx         星の一斉点火
   └─ PurchaseTransition.tsx 起点可変の拡大＋演出統括
```
