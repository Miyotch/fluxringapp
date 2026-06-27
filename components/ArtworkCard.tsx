/**
 * ArtworkCard.tsx  — FLUX RING 作品フレーム（カード構造）の参照実装
 * ------------------------------------------------------------------
 * 何を: 全画面共通の「額装カード」。外側から ①オーラ ②台紙 ③画像 ④クリアガラス
 *       の四層を Skia で描く。⑤ヒーロー発光は別ファイル(HeroGlow)で上に重ねる。
 *
 * なぜ Skia か: box-shadow のにじむ発光・斜めのガラス光沢・角丸クリップ・screen合成は
 *       React Native 標準スタイルでは綺麗に出ない。Skia なら CSS と同等以上に再現できる。
 *
 * 対応資料: トンマナ仕様 V2「作品フレーム＝カード構造（実装値）」「ぼかしの区別」。
 *       HTMLモック fluxring_discover_swipe_mock.html で検証済みの数値をそのまま移植。
 *
 * 実機調整ポイント（このファイルで“出発点”として置いた値）:
 *   - Blur の sigma は「box-shadowのblur ≈ 2×sigma」で換算（92px→46 / 46px→23 / 34px→17）。
 *     実機で見て、にじみが強すぎ/弱すぎる場合は sigma を増減。
 *   - グラデの角度はヘルパー gradientVec() で CSS角度から厳密に算出している。
 *   - クリアガラスは「色相を変えない・画像をぼかさない」が鉄則（トンマナV2のぼかし区別表）。
 *
 * 依存: @shopify/react-native-skia
 *   yarn add @shopify/react-native-skia
 *
 * 基準サイズ: 152×228（2:3）。width だけ渡せば height は 2:3 で自動。
 *   小サムネ(96×144)やグリッドも同じ比率で縮小されるので width を変えるだけで足りる。
 */

import React from 'react';
import {
  Canvas,
  Group,
  RoundedRect,
  rrect,
  rect,
  LinearGradient,
  vec,
  Image,
  useImage,
  Blur,
} from '@shopify/react-native-skia';
import { HeroGlow, HeroRange } from './HeroGlow';
import { GlassFilter, GlassType } from './GlassFilter';

// ── CSSの linear-gradient 角度（deg, 上=0 時計回り）を Skia の start/end 座標へ ──
// CSS: 140deg / 118deg を“見たまま”移植するためのヘルパー。
// 矩形(x,y,w,h)に対して、その角度のグラデ線が矩形を覆うよう start/end を返す。
function gradientVec(angleDeg: number, x: number, y: number, w: number, h: number) {
  // CSSは「上方向が0°・時計回り」。数学座標(右=0°・反時計回り)へ変換: rad = (angle - 90)°
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const cx = x + w / 2;
  const cy = y + h / 2;
  // グラデ線が矩形の対角を覆う長さ（CSSのグラデ線長と同じ考え方）
  const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const dx = (Math.cos(rad) * len) / 2;
  const dy = (Math.sin(rad) * len) / 2;
  return { start: vec(cx - dx, cy - dy), end: vec(cx + dx, cy + dy) };
}

export type ArtworkCardProps = {
  /** 基準幅。152=大(ディスカバー/プレイヤー/購入) / 96=小(ストーリー上部) / 列幅=グリッド */
  width?: number;
  /** 作品画像URL（CloudFlare配信等）。useImage が解決する */
  imageUri: string;
  /** オーラ主色＝作品の主要色（自動抽出 or 運営登録）。box-shadow 46px/6px 相当の層 */
  glow?: string;
  /** オーラ副色（広く薄い）。box-shadow 92px/18px 相当の層 */
  glow2?: string;
  /** 台紙→画像の余白。基準7（小サムネは5）。画像を一回り小さくして額装に見せる */
  inset?: number;
  /** クリアガラスの強度。運営管理の「強度」に対応（0=なし〜1=既定）。種類は glassType */
  glassOpacity?: number;
  /** フィルター種類。運営管理 config.glassType（既定 clear） */
  glassType?: GlassType;
  /** グリッド等でヒーロー/オーラを抑えたいとき true。負荷と煩雑さ回避（トンマナV2） */
  subdued?: boolean;
  /** ヒーロー発光（蛍の明滅）。enabled時のみ最前面に描画。グリッドでは渡さない */
  hero?: { enabled?: boolean; peak?: number; period?: number; range?: HeroRange };
};

export const ArtworkCard: React.FC<ArtworkCardProps> = ({
  width = 152,
  imageUri,
  glow = 'rgba(96,206,224,0.40)', // #60CEE0
  glow2 = 'rgba(70,132,224,0.16)', // #4684E0
  inset = 7,
  glassOpacity = 1,
  glassType = 'clear',
  subdued = false,
  hero,
}) => {
  const height = width * 1.5; // 2:3 固定

  // オーラ(にじむ発光)はカードの外へ大きくはみ出す。その分を Canvas の余白(PAD)として確保。
  // PAD を取らないと発光が Canvas 端で切れる。92pxブラー＋18px spread が収まる程度。
  const PAD = subdued ? Math.round(width * 0.35) : Math.round(width * 0.6);
  const cw = width + PAD * 2;
  const ch = height + PAD * 2;
  const x = PAD;
  const y = PAD;

  const radius = Math.round(width * 0.118); // 152→18 と同比率（小/グリッドでも自然に縮む）
  const imgX = x + inset;
  const imgY = y + inset;
  const imgW = width - inset * 2;
  const imgH = height - inset * 2;
  const imgRadius = Math.round(width * 0.072); // 152→11 と同比率

  const image = useImage(imageUri);

  // グラデ角度→座標（台紙140deg / ガラス118deg）
  const baseG = gradientVec(140, x, y, width, height);

  return (
    <Canvas style={{ width: cw, height: ch }}>
      {/* ───────────── ① オーラ（作品色のにじむ発光・ぼかしあり） ─────────────
          box-shadow: 0 0 46px 6px glow, 0 0 92px 18px glow2, 0 16px 34px rgba(0,0,0,.42)
          Skiaでは「少し大きい角丸矩形＋Blur」を重ねてグローを表現。
          sigma = box-shadowのblur / 2。 */}
      {!subdued && (
        <Group>
          {/* 広く薄い層（glow2） 92px/18px → sigma46 */}
          <RoundedRect
            rect={rrect(rect(x - 18, y - 18, width + 36, height + 36), radius + 6, radius + 6)}
            color={glow2}
          >
            <Blur blur={46} />
          </RoundedRect>
          {/* 濃い層（glow） 46px/6px → sigma23 */}
          <RoundedRect
            rect={rrect(rect(x - 6, y - 6, width + 12, height + 12), radius + 2, radius + 2)}
            color={glow}
          >
            <Blur blur={23} />
          </RoundedRect>
          {/* 接地影 0 16px 34px rgba(0,0,0,.42) → 下に16pxオフセット, sigma17 */}
          <RoundedRect
            rect={rrect(rect(x, y + 16, width, height), radius, radius)}
            color="rgba(0,0,0,0.42)"
          >
            <Blur blur={17} />
          </RoundedRect>
        </Group>
      )}

      {/* ───────────── ② 台紙（ベース・ほぼ透明の白＋縁の光） ─────────────
          背景 linear-gradient(140deg, rgba(255,255,255,.028), rgba(255,255,255,.006))
          ※ #222445 でベタ塗りしない。濃くするとチープに見える（トンマナV2）。 */}
      <Group>
        <RoundedRect rect={rrect(rect(x, y, width, height), radius, radius)}>
          <LinearGradient
            start={baseG.start}
            end={baseG.end}
            colors={['rgba(255,255,255,0.028)', 'rgba(255,255,255,0.006)']}
          />
        </RoundedRect>
        {/* 縁の光 inset 0 1px 0 rgba(255,255,255,.20) + hairline rgba(255,255,255,.05)。
            Skiaに内側1pxの上辺だけ光らせる直接表現はないので、全周の細いstrokeで近似。
            実機で上辺だけ強調したい場合は上辺に短いLinearGradientのstrokeを足す。 */}
        <RoundedRect
          rect={rrect(rect(x + 0.5, y + 0.5, width - 1, height - 1), radius, radius)}
          style="stroke"
          strokeWidth={1}
          color="rgba(255,255,255,0.12)"
        />
      </Group>

      {/* ───────────── ③ 画像（cover・角丸・台紙よりワンサイズ小） ─────────────
          inset の分だけ内側に置くことで、台紙が外周に覗いて「額装」に見える。
          Group clip で角丸にクリップしてから cover 描画。 */}
      <Group clip={rrect(rect(imgX, imgY, imgW, imgH), imgRadius, imgRadius)}>
        {image && (
          <Image image={image} x={imgX} y={imgY} width={imgW} height={imgH} fit="cover" />
        )}

        {/* ───────── ④ フィルター（運営管理で種類/強度を切替・GlassFilter） ─────────
            クリアガラス（既定）/ グレイン / マット / ヴィネット を切り替える。
            色相不変・画像はぼかさない（トンマナV2）。type/strength は config から渡す。 */}
        <GlassFilter
          type={glassType}
          strength={glassOpacity}
          x={imgX}
          y={imgY}
          w={imgW}
          h={imgH}
          radius={imgRadius}
        />

        {/* シアンの細い縁 inset 0 0 0 1px rgba(96,206,224,.5)。画像領域の内側に1px。 */}
        <RoundedRect
          rect={rrect(rect(imgX + 0.5, imgY + 0.5, imgW - 1, imgH - 1), imgRadius, imgRadius)}
          style="stroke"
          strokeWidth={1}
          color="rgba(96,206,224,0.5)"
        />

        {/* ⑤ ヒーロー発光（最前面・hero.enabled のときのみ）。
            画像領域(imgX,imgY,imgW,imgH)に screen 合成で重ねる。グリッドでは hero を渡さない。 */}
        {hero?.enabled && (
          <HeroGlow
            x={imgX}
            y={imgY}
            w={imgW}
            h={imgH}
            radius={imgRadius}
            enabled
            peak={hero.peak}
            period={hero.period}
            range={hero.range}
          />
        )}
      </Group>
    </Canvas>
  );
};

/**
 * 使い方（例）:
 *
 *   import { ArtworkCard } from './ArtworkCard';
 *
 *   // 大（ディスカバー中央）
 *   <ArtworkCard width={152} imageUri={track.artworkUrl}
 *     glow={track.glow} glow2={track.glow2} />
 *
 *   // 小（ストーリー上部）
 *   <ArtworkCard width={96} inset={5} imageUri={track.artworkUrl} subdued />
 *
 *   // グリッド（コレクション）: 列幅を width に渡す。ヒーロー/オーラは抑える
 *   <ArtworkCard width={columnWidth} inset={5} subdued imageUri={track.artworkUrl} />
 *
 * 注意:
 *   - glow / glow2 は作品ごとの色。未指定ならシアン/ブルーの既定。
 *   - Canvas は PAD ぶん大きい。レイアウト上の“見かけのカード”は中央の width×height。
 *     タップ領域やテキスト配置は PAD を考慮してオフセットする。
 */
