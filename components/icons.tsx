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
import Svg, { Path, Rect, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
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

// 音の ON/OFF（ホームのカード裏面の右上。2026-09-24）。
// ON=シアンで音の波 2 本 / OFF=グレーで × 印。
export const SpeakerIcon: React.FC<IconProps & { on?: boolean }> = ({ size = 16, on = true }) => {
  const color = on ? COLOR.auraCyan : COLOR.textSecondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 5L6 9H2v6h4l5 4z" stroke={color} strokeWidth={1.6} {...STROKE} />
      {on ? (
        <>
          <Path d="M15.5 9a4 4 0 010 6" stroke={color} strokeWidth={1.6} {...STROKE} />
          <Path d="M18.5 6.5a7.5 7.5 0 010 11" stroke={color} strokeWidth={1.6} {...STROKE} />
        </>
      ) : (
        <Path d="M16 9.5l5 5M21 9.5l-5 5" stroke={color} strokeWidth={1.6} {...STROKE} />
      )}
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

// カード詳細（プレイリストの行の右端）。縦長のカードに文字の行＝曲の情報が書かれた裏面。
// 原本 svg なし（2026-10-13 プレイリスト縦リスト化で追加）
export const CardDetailIcon: React.FC<IconProps> = ({ size = 20, color = COLOR.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={6} y={3} width={12} height={18} rx={2} stroke={color} strokeWidth={1.5} />
    <Path d="M9 8h6M9 11.5h6M9 15h3.5" stroke={color} strokeWidth={1.5} {...STROKE} />
  </Svg>
);

// プレイリストに追加（丸に＋）。原本 svg なし（2026-10-13）
export const AddToListIcon: React.FC<IconProps & { on?: boolean }> = ({
  size = 22,
  color = COLOR.textSecondary,
  on = false,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={on ? COLOR.auraCyan : color} strokeWidth={1.5} fill={on ? 'rgba(96,206,224,0.16)' : 'none'} />
    {on ? (
      <Path d="M8 12.2l2.7 2.6L16 9.5" stroke={COLOR.auraCyan} strokeWidth={1.7} {...STROKE} />
    ) : (
      <Path d="M12 8v8M8 12h8" stroke={color} strokeWidth={1.5} {...STROKE} />
    )}
  </Svg>
);

// 端末に保存（下向きの矢印を丸で囲む）。done で塗りつぶしのシアン。原本 svg なし（2026-10-13）
export const DownloadIcon: React.FC<IconProps & { done?: boolean }> = ({
  size = 22,
  color = COLOR.textSecondary,
  done = false,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={done ? COLOR.auraCyan : color} strokeWidth={1.5} fill={done ? COLOR.auraCyan : 'none'} />
    <Path d="M12 7.5v8M8.5 12.2L12 15.7l3.5-3.5" stroke={done ? '#06222A' : color} strokeWidth={1.6} {...STROKE} />
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

export const TabHomeIcon: React.FC<IconProps> = ({ size = 22, color = COLOR.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4.5 10.25 12 4.25l7.5 6V19a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1z" stroke={color} strokeWidth={1.45} {...STROKE} />
    <Path d="M9.5 20v-6.25h5V20" stroke={color} strokeWidth={1.45} {...STROKE} />
  </Svg>
);

export const TabCollectionIcon: React.FC<IconProps> = ({ size = 22, color = COLOR.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={7} y={3.75} width={13} height={15.5} rx={2.25} stroke={color} strokeWidth={1.45} />
    <Path d="M4 7.5v12.75c0 .83.67 1.5 1.5 1.5H16M10.5 9h6M10.5 12.5h4" stroke={color} strokeWidth={1.45} {...STROKE} />
  </Svg>
);

export const TabMediaIcon: React.FC<IconProps> = ({ size = 22, color = COLOR.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4.5 10v4M8.25 6v12M12 3.75v16.5M15.75 7.5v9M19.5 9.75v4.5" stroke={color} strokeWidth={1.45} {...STROKE} />
  </Svg>
);

export const TabSettingsIcon: React.FC<IconProps> = ({ size = 22, color = COLOR.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 6.25h4.5M12.5 6.25H20M4 12h10.5M18.5 12H20M4 17.75h4.5M12.5 17.75H20" stroke={color} strokeWidth={1.45} {...STROKE} />
    <Circle cx={10.5} cy={6.25} r={2} stroke={color} strokeWidth={1.45} />
    <Circle cx={16.5} cy={12} r={2} stroke={color} strokeWidth={1.45} />
    <Circle cx={10.5} cy={17.75} r={2} stroke={color} strokeWidth={1.45} />
  </Svg>
);

// X（旧Twitter）。角丸スクエアの白枠バッジ＋白いXマーク（添付リファレンス準拠）。
export const XIcon: React.FC<IconProps> = ({ size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={1.6} y={1.6} width={20.8} height={20.8} rx={7} fill="#000000" stroke="#FFFFFF" strokeWidth={1.4} />
    <Path d="M7.6 7.6l8.8 8.8M16.4 7.6l-8.8 8.8" stroke="#FFFFFF" strokeWidth={1.7} strokeLinecap="square" />
  </Svg>
);

// Instagram（公式グリフ）。非公式画像(instagram.png)の代替。
// 角丸スクエア背景（公式のグラデーション: #FEDA75→#D62976→#4F5BD5）
// ＋白線画のカメラ本体（角丸枠＋レンズ円＋右上フラッシュ点）。
export const InstagramIcon: React.FC<IconProps> = ({ size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Defs>
      <RadialGradient id="igGrad" cx="30%" cy="107%" r="150%">
        <Stop offset="0%" stopColor="#FEDA75" />
        <Stop offset="18%" stopColor="#FA7E1E" />
        <Stop offset="42%" stopColor="#D62976" />
        <Stop offset="68%" stopColor="#962FBE" />
        <Stop offset="100%" stopColor="#4F5BD5" />
      </RadialGradient>
    </Defs>
    <Rect x={1.6} y={1.6} width={20.8} height={20.8} rx={7} fill="url(#igGrad)" />
    <Rect x={7} y={7} width={10} height={10} rx={3} stroke="#FFFFFF" strokeWidth={1.6} {...STROKE} />
    <Circle cx={12} cy={12} r={2.9} stroke="#FFFFFF" strokeWidth={1.6} />
    <Circle cx={16.1} cy={7.9} r={1} fill="#FFFFFF" />
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

// 巻き戻し／早送り（再生バナー）。二重の三角
export const RewindIcon: React.FC<IconProps> = ({ size = 18, color = '#BFE8F1' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" opacity={0.85}>
    <Path d="M11 6v12l-7-6zM20 6v12l-7-6z" fill={color} />
  </Svg>
);
export const FastForwardIcon: React.FC<IconProps> = ({ size = 18, color = '#BFE8F1' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" opacity={0.85}>
    <Path d="M13 6v12l7-6zM4 6v12l7-6z" fill={color} />
  </Svg>
);
