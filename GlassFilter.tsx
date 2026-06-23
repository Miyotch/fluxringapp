/**
 * GlassFilter.tsx — FLUX RING サムネのフィルター（運営管理で種類/強度を切替）
 * ------------------------------------------------------------------
 * 何を: 作品画像の前面に重ねる質感フィルター。運営が管理画面で「種類」と「強度」を選び、
 *   全画像へ一括反映する（画像非破壊・色相不変）。ArtworkCard の画像領域に差し込む。
 *
 * 4種類:
 *   - clear   クリアガラス … 斜めの白い光沢。透明で画像を鮮明に保つ（既定・確定採用）
 *   - grain   グレイン     … 細かい粒子を薄く乗せる。フィルムの手触り
 *   - matte   マット       … 白を均一に薄く重ね、光沢を抑えたつや消し
 *   - vignette ヴィネット   … 四隅を暗く落とし中央へ視線を集める
 *
 * 共通の原則（トンマナV2）:
 *   - 色相は変えない（白・透明・黒のみ）
 *   - 作品の画像そのものはぼかさない
 *   - strength（強度 0..1）で効きを調整。全画像へ一括反映する想定
 *
 * 使い方: ArtworkCard の画像 Group 内（画像の後・ヒーローの前）に差し込む。
 *   <GlassFilter type={config.glassType} strength={config.glassStrength}
 *     x={imgX} y={imgY} w={imgW} h={imgH} radius={imgRadius} />
 *
 * 依存: @shopify/react-native-skia
 */

import React from 'react';
import {
  Group,
  RoundedRect,
  rrect,
  rect,
  LinearGradient,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';

export type GlassType = 'clear' | 'grain' | 'matte' | 'vignette';

export type GlassFilterProps = {
  type: GlassType;
  /** 効きの強さ 0..1（既定 1） */
  strength?: number;
  /** 画像領域（ArtworkCard の imgX/imgY/imgW/imgH/imgRadius） */
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
};

// CSS角度→Skia座標（ArtworkCard と同じ考え方）
function gradientVec(angleDeg: number, x: number, y: number, w: number, h: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const dx = (Math.cos(rad) * len) / 2;
  const dy = (Math.sin(rad) * len) / 2;
  return { start: vec(cx - dx, cy - dy), end: vec(cx + dx, cy + dy) };
}

export const GlassFilter: React.FC<GlassFilterProps> = ({
  type,
  strength = 1,
  x,
  y,
  w,
  h,
  radius,
}) => {
  const clip = rrect(rect(x, y, w, h), radius, radius);
  const s = Math.max(0, Math.min(1, strength));

  // ── clear: 斜めの白い光沢（screen 合成・確定採用） ──
  if (type === 'clear') {
    const g = gradientVec(118, x, y, w, h);
    return (
      <Group blendMode="screen" clip={clip}>
        <RoundedRect rect={clip} opacity={s}>
          <LinearGradient
            start={g.start}
            end={g.end}
            colors={[
              'rgba(255,255,255,0.60)',
              'rgba(255,255,255,0.20)',
              'rgba(255,255,255,0.00)',
              'rgba(255,255,255,0.00)',
              'rgba(255,255,255,0.24)',
              'rgba(255,255,255,0.50)',
            ]}
            positions={[0, 0.14, 0.32, 0.62, 0.85, 1]}
          />
        </RoundedRect>
      </Group>
    );
  }

  // ── grain: 細かい粒子。Skia 単体でノイズを敷くなら Turbulence シェーダ ──
  // ※ ここでは構造を示す。実機では <Shader> に fractalNoise を使うか、
  //   ノイズ用の小さな PNG テクスチャをタイル状に screen で乗せるのが手堅い。
  if (type === 'grain') {
    return (
      <Group clip={clip}>
        {/* ベースは clear と同じ光沢を弱めに残し、その上に粒子を重ねる想定 */}
        <Group blendMode="screen">
          <RoundedRect rect={clip} opacity={s * 0.4}>
            <LinearGradient
              start={vec(x, y)}
              end={vec(x + w, y + h)}
              colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)']}
            />
          </RoundedRect>
        </Group>
        {/* 粒子レイヤー: 実装メモ参照（Turbulence or ノイズPNGタイル, opacity≈s*0.12, blend overlay） */}
      </Group>
    );
  }

  // ── matte: 白を均一に薄く重ね、つや消し（光沢を出さない） ──
  if (type === 'matte') {
    return (
      <Group clip={clip}>
        <RoundedRect rect={clip} color="rgba(255,255,255,1)" opacity={s * 0.1} />
        {/* 均一な薄い白。clear のような斜め光沢は出さない＝つや消し */}
      </Group>
    );
  }

  // ── vignette: 四隅を暗く落とす（中央透明→外周黒・multiply） ──
  if (type === 'vignette') {
    return (
      <Group blendMode="multiply" clip={clip}>
        <RoundedRect rect={clip} opacity={s}>
          <RadialGradient
            c={vec(x + w / 2, y + h / 2)}
            r={Math.max(w, h) * 0.62}
            colors={[
              'rgba(255,255,255,1)', // 中央=変化なし
              'rgba(255,255,255,1)',
              'rgba(120,120,140,1)', // 外周=暗く
              'rgba(70,70,90,1)',
            ]}
            positions={[0, 0.55, 0.85, 1]}
          />
        </RoundedRect>
      </Group>
    );
  }

  return null;
};

/**
 * 実機調整・実装メモ:
 *
 * grain（粒子）の作り方は2通り:
 *   (A) Skia の Turbulence/FractalNoise シェーダを使う:
 *       const noise = Skia.Shader.MakeTurbulence(0.8, 0.8, 2, 0, w, h) のような形で
 *       <Fill> に shader を与え、Group を screen/overlay で薄く重ねる。
 *   (B) ノイズPNG（256x256程度）を tile して screen で乗せる。手堅く軽い。
 *   いずれも opacity は s*0.1〜0.15 程度。やりすぎると画像が汚れる。
 *
 * vignette の強さは positions と外周色で調整。暗くしすぎると作品が沈むので
 *   外周 rgba(70,70,90) 程度から始め、s で効きを絞る。multiply 合成。
 *
 * matte は「斜め光沢を出さない」のが clear との違い。均一な薄い白だけ。
 *   コントラストをもう少し落としたいなら、上に rgba(20,18,46,s*0.06) を normal で薄く足す。
 *
 * 共通: 色相は変えない（白/黒/グレーのみ）。strength=0 で実質無効。
 *   運営管理の config.glassType / config.glassStrength をそのまま type / strength に渡す。
 */
