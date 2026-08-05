/**
 * icons.tsx — FLUX RING 共通アイコン（react-native-svg）
 * ------------------------------------------------------------------
 * 形状の正は `assets/icons/*.svg`（_icons_manifest.json に用途を記載）。
 * RN は .svg を直接 import できない（svg-transformer 未導入）ため、
 * 各ファイルの path / rect / circle をこのファイルへ 1:1 で書き写す。
 * 色とサイズだけを props で外出しし、形状は原本から変えない。
 *
 * 発光は RN の drop-shadow が使えないため、Svg の外側 View に近似の
 * glow（下地の薄いシアン）を必要に応じて重ねる（各利用側で対応）。
 */

import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { COLOR } from '../constants/design-tokens';

type IconProps = { size?: number; color?: string };

// 線画アイコン共通の描画属性（原本の stroke-linecap/linejoin=round に対応）
const STROKE = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

// 再生マーク（PLAY_HTML）— 全ての「再生」表現で共通。白芯＋シアン外光。
export const PlayMark: React.FC<IconProps> = ({ size = 19, color = '#E9FBFE' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M8 5v14l11-7z" fill={color} />
  </Svg>
);

// 通知ベル（線画）。assets/icons/bell.svg
export const BellIcon: React.FC<IconProps> = ({ size = 17, color = COLOR.textPrimary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth={1.5} {...STROKE} />
    <Path d="M13.7 21a2 2 0 01-3.4 0" stroke={color} strokeWidth={1.5} {...STROKE} />
  </Svg>
);

// 試聴（スピーカー）。on でシアン。assets/icons/speaker_preview.svg
export const PreviewIcon: React.FC<IconProps & { on?: boolean }> = ({
  size = 17,
  on = false,
}) => {
  const color = on ? COLOR.auraCyan : COLOR.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 5L6 9H2v6h4l5 4z" stroke={color} strokeWidth={1.5} {...STROKE} />
      <Path d="M15 9a3 3 0 010 6" stroke={color} strokeWidth={1.5} {...STROKE} />
    </Svg>
  );
};

// ループ。ON=発光シアン / OFF=グレー。
export const LoopIcon: React.FC<IconProps & { on?: boolean }> = ({ size = 16, on = true }) => {
  const color = on ? '#9FE0EC' : '#6E7796';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 2l4 4-4 4" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 11v-1a4 4 0 0 1 4-4h14" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 22l-4-4 4-4" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 13v1a4 4 0 0 1-4 4H3" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

// 一時停止（共通）。assets/icons/pause_mark.svg
export const PauseMark: React.FC<IconProps> = ({ size = 19, color = '#E9FBFE' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 5h4v14H6zM14 5h4v14h-4z" fill={color} />
  </Svg>
);

// 曲送り（次へ）。assets/icons/skip_next.svg
export const SkipIcon: React.FC<IconProps> = ({ size = 16, color = '#BFE8F1' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" opacity={0.8}>
    <Path d="M5 5v14l9-7z" fill={color} />
    <Rect x={16.2} y={5} width={1.8} height={14} rx={0.9} fill={color} />
  </Svg>
);

// 曲戻し（前へ）。assets/icons/skip_prev.svg
export const SkipPrevIcon: React.FC<IconProps> = ({ size = 16, color = '#BFE8F1' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" opacity={0.8}>
    <Path d="M19 5v14l-9-7z" fill={color} />
    <Rect x={6} y={5} width={1.8} height={14} rx={0.9} fill={color} />
  </Svg>
);

// 出力／共有。assets/icons/export.svg
export const ShareIcon: React.FC<IconProps> = ({ size = 18, color = COLOR.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 15V4" stroke={color} strokeWidth={1.6} {...STROKE} />
    <Path d="M8 8l4-4 4 4" stroke={color} strokeWidth={1.6} {...STROKE} />
    <Rect x={4} y={13} width={16} height={8} rx={2} stroke={color} strokeWidth={1.6} {...STROKE} />
  </Svg>
);

// ロック（VIP / 行 / 見出し共通形状。色とサイズは利用側で指定）。assets/icons/lock.svg
export const LockIcon: React.FC<IconProps> = ({ size = 16, color = COLOR.auraCyan }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={5} y={11} width={14} height={9} rx={2} stroke={color} strokeWidth={1.6} {...STROKE} />
    <Path d="M8 11V8a4 4 0 018 0v3" stroke={color} strokeWidth={1.6} {...STROKE} />
  </Svg>
);

// シャッフル
export const ShuffleIcon: React.FC<IconProps> = ({ size = 14, color = COLOR.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M16 3h5v5" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M4 20L21 3" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M21 16v5h-5" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M15 15l6 6" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M4 4l5 5" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Google ロゴ（4色・fr_launch_v5.html のインライン SVG）
export const GoogleIcon: React.FC<IconProps> = ({ size = 15 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path fill="#ECEEF7" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
    <Path fill="#9BB2E8" d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
    <Path fill="#7C62D6" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" />
    <Path fill="#60CEE0" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.6 9.4 5.9 12 5.9z" />
  </Svg>
);

// ── フッタータブ（assets/icons/tab_*.svg）──
// 原本は stroke="currentColor"。RN は currentColor を継承しないため色は props 必須。

export const TabHomeIcon: React.FC<IconProps> = ({ size = 20, color = COLOR.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 11l9-8 9 8" stroke={color} strokeWidth={1.5} {...STROKE} />
    <Path d="M5 10v10h14V10" stroke={color} strokeWidth={1.5} {...STROKE} />
  </Svg>
);

export const TabCollectionIcon: React.FC<IconProps> = ({ size = 20, color = COLOR.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={3} width={7} height={7} rx={1.5} stroke={color} strokeWidth={1.5} {...STROKE} />
    <Rect x={14} y={3} width={7} height={7} rx={1.5} stroke={color} strokeWidth={1.5} {...STROKE} />
    <Rect x={3} y={14} width={7} height={7} rx={1.5} stroke={color} strokeWidth={1.5} {...STROKE} />
    <Rect x={14} y={14} width={7} height={7} rx={1.5} stroke={color} strokeWidth={1.5} {...STROKE} />
  </Svg>
);

export const TabMediaIcon: React.FC<IconProps> = ({ size = 20, color = COLOR.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} {...STROKE} />
    <Path d="M10 9l5 3-5 3z" stroke={color} strokeWidth={1.5} {...STROKE} />
  </Svg>
);

export const TabSettingsIcon: React.FC<IconProps> = ({ size = 20, color = COLOR.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.5} {...STROKE} />
    <Path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke={color} strokeWidth={1.5} {...STROKE} />
  </Svg>
);

// X（旧Twitter）。角丸スクエアの白枠バッジ＋白いXマーク（添付リファレンス準拠）。
export const XIcon: React.FC<IconProps> = ({ size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={1.6} y={1.6} width={20.8} height={20.8} rx={7} fill="#000000" stroke="#FFFFFF" strokeWidth={1.4} />
    <Path d="M7.6 7.6l8.8 8.8M16.4 7.6l-8.8 8.8" stroke="#FFFFFF" strokeWidth={1.7} strokeLinecap="square" />
  </Svg>
);

// ウィッシュリスト星。on で塗り。assets/icons/wishstar.svg
export const StarIcon: React.FC<IconProps & { filled?: boolean }> = ({
  size = 19,
  filled = false,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 3.4l2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 16.93l-5.3 2.78 1.01-5.9-4.29-4.18 5.93-.86z"
      fill={filled ? COLOR.auraCyan : 'none'}
      stroke={COLOR.auraCyan}
      strokeWidth={1.5}
      {...STROKE}
    />
  </Svg>
);
