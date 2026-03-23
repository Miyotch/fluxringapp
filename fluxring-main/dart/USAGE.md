# Design 08: Lumen Cascade — FlutterFlow CustomWidget

## ファイル構成

- `lumen_cascade.dart` — CustomWidget（バリエーション設定を内蔵）
- `lumen_cascade_variations.dart` — 不要（説明のみ）

## FlutterFlow での使い方

### 1. CustomWidget として登録

1. FlutterFlow の **Custom Code > Custom Widgets** を開く
2. **Create** をクリック
3. Widget 名を `LumenCascade` に設定
4. `lumen_cascade.dart` のコードを貼り付け（ボイラープレート import 込み）
5. パラメータが自動認識される

**重要**: `lumen_cascade_variations.dart` は FlutterFlow に登録しないでください。
バリエーション設定は `lumen_cascade.dart` 内に統合済みです。

### 2. パラメータ一覧

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `width` | `double?` | auto | 幅 |
| `height` | `double?` | auto | 高さ |
| `amplitude` | `double` | 1.0 | 波の強度 (0.2 ~ 4.0) |
| `variationId` | `String` | '08-1' | プリセット ID（下記参照） |
| `hue` | `double` | 280 | 色相 (variationId 未マッチ時に使用) |
| `saturation` | `double` | 75 | 彩度 (variationId 未マッチ時に使用) |
| `interactive` | `bool` | true | ドラッグ操作の有効/無効 |

### 3. variationId プリセット

| ID | 名前 | 概要 |
|---|---|---|
| `08-1` | Violet Torrent | 紫の激流 |
| `08-2` | Cyan Cascade | シアンの柔らかい光の弧 |
| `08-3` | Amber Falls | 金色の波紋、ウォブル強め |
| `08-4` | Rose Spiral | ローズの高速カスケード |
| `08-5` | Emerald Flow | エメラルドのシャープな弧 |
| `08-1-1` | Violet Breeze | 紫の微風、穏やかな加速 |
| `08-1-2` | Violet Stream | 紫の小川、滑らかな流れ |
| `08-1-3` | Violet Torrent | 紫の激流、均整のとれた加速 |
| `08-1-4` | Violet Surge | 紫の奔流、力強い波動 |
| `08-1-5` | Violet Tempest | 紫の嵐、疾走するカスケード |

`variationId` を空文字列やリストにない値に設定すると、
`hue`, `saturation` 等の個別パラメータが直接使用されます。
