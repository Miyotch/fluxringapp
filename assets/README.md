# FR Assets — アート画像

## 同梱アート画像（モック用）

作品カードに差し込む 2:3 の作品画像。**このフォルダに実ファイルを配置**する。

| ファイル | サイズ | 用途 | オーラ色 rgb |
|---|---|---|---|
| `art_blue.jpg`  | 640×960 (2:3) | 冬明け（track: blue）   | rgb(96,206,224) |
| `art_white.jpg` | 640×960 (2:3) | 薄明（track: white）     | rgb(179,199,235) |
| `art_red.jpg`   | 640×960 (2:3) | 遠い灯（track: red）     | rgb(219,120,150) |

> 現状はモック確認用のリモート画像（picsum）で代替。実 jpg を上記名でこのフォルダに置き、
> `constants/stubData.ts` の `artworkSource` を `require('../assets/art_blue.jpg')` に差し替える。

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
