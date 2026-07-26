# FR Assets — アート画像

## 同梱アート画像（v98_FIX ハンドオフ実ファイル）

`assets/art/` に FR_engineering_handoff_v98_FIX の実アートを同梱済み（683×1024・2:3・計18点）。
参照は `constants/artwork.ts`（`artUri('blue')` 等）。picsum のダミーは廃止。

| key | ファイル | 作品 | オーラ auraA / auraB |
|---|---|---|---|
| `blue`  | `art/blue.jpg`  | 冬明け No.001        | rgba(96,206,224,.42) / rgba(70,132,224,.16) |
| `white` | `art/white.jpg` | 薄明 No.002          | rgba(180,200,230,.4) / rgba(150,170,210,.16) |
| `mesh`  | `art/mesh.jpg`  | 白鉛筆 I（仮）No.003 | rgba(232,226,210,.40) / rgba(180,174,158,.16) |
| `kite`  | `art/kite.jpg`  | 白鉛筆 II（仮）No.004| rgba(214,218,226,.40) / rgba(160,164,176,.16) |
| `bloom` | `art/bloom.jpg` | 白鉛筆 III（仮）No.005| rgba(196,210,228,.40) / rgba(146,160,186,.16) |

各 `*_thumb.jpg`（107×160）はコレクション等の軽量表示用。
`pool*_art.jpg` / `pool*_thumb.jpg` はスワップ用プール（data/swap_pool.json 相当）。

> リリースビルドでは `prefetchArtwork()`（App 起動時）が `downloadAsync()` を実行し、
> localUri（file://）を確定させる。Skia / GL テクスチャは file:// でのみ確実に読めるため必須。

## 本番アート画像の要件

- **比率**: 2:3（縦長）必須（横比率が違うとカードで歪む）
- **推奨解像度**: 長辺 2048px（2048 × 3072）
- **形式**: JPEG（quality 90+）または PNG
- **色空間**: sRGB
- **命名規則**: `art_{track_key}.jpg`（例: `art_track_001.jpg`）
- 本番画像は Midjourney + Brushup Tool で制作し、管理画面から登録する

## オーラカラー（楽曲データに含む）

各楽曲に 3 種のオーラ色を設定（`constants/stubData.ts` の各トラック）。

```json
{
  "auraA": "rgba(96,206,224,.42)",   // プライマリ Blob（シアン系）
  "auraB": "rgba(70,132,224,.16)",   // セカンダリ Blob（青系）
  "rgb":   [0.376, 0.808, 0.878]     // 3rd Blob & ベゼルティント（0-1 float）
}
```

**制約**: 色は必ず **藍紫〜シアン範囲**に収める（暖色・金は憲法上禁止）。

## 音源ファイル（Cloudflare R2）

画像とは別に、音源は R2 バケット（`music-app-storage`）に配置する。**形式は MP3**。

| パス | 公開範囲 | 用途 |
|---|---|---|
| `preview/{key}.mp3` | 公開（r2.dev） | 試聴30秒。誰でも取得可 |
| `full/{key}.mp3` | 非公開 | フル音源。`infra/r2-audio-worker.js` 経由のみ |

`key` は `blue` / `white` / `red`（`constants/stubData.ts` の `audioKey` と一致させる）。
詳細は `lib/r2.ts` / `infra/r2-audio-worker.js` を参照。
