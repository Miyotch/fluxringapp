/**
 * Flux Ring Design System — Color Style: bluegray
 *
 * 3-layer design:
 *   Glassmorphism (構造層) — navigation, global UI frames
 *   Neumorphism   (操作層) — buttons, sliders, interactive controls
 *   Flat/Minimal  (情報層) — text, lists, data display
 */
export const colors = {
  // ── Primary Color ──
  primary: '#9178BD',       // ブランドアクセント
  primaryLight: 'rgba(145, 120, 189, 0.4)',
  primaryMuted: 'rgba(145, 120, 189, 0.5)',

  // ── Text Color ──
  textPrimary: '#7B7CA6',   // main — 見出し・強調テキスト
  textSecondary: 'rgba(123, 124, 166, 0.64)', // sub — 補足説明・キャプション
  textMuted: 'rgba(123, 124, 166, 0.4)',
  textInverse: '#FFFFFF',   // inverse — 濃い背景上のテキスト

  // ── Background Color ──
  backgroundBase: '#E6EBF1',  // ページ全体の基調背景
  backgroundDither: 'rgba(143, 143, 143, 0.16)', // 非活性時の背景色
  // Legacy gradient aliases
  backgroundStart: '#E6EBF1',
  backgroundEnd: '#dde3ed',
  backgroundMid: '#E6EBF1',

  // ── Effect ──
  glass: 'rgba(255, 255, 255, 0.6)',      // Glassmorphism 背景
  glassBorder: 'rgba(255, 255, 255, 0.7)', // Glassmorphism ボーダー
  neumorphShadowDark: 'rgba(155, 141, 255, 0.4)', // Drop Shadow
  neumorphShadowLight: 'rgba(255, 255, 255, 0.8)',
  overlay: 'rgba(0, 0, 0, 0.2)',           // Overlay

  // ── Card / Glass ──
  cardBackground: 'rgba(255, 255, 255, 0.6)',
  cardBorder: 'rgba(255, 255, 255, 0.7)',
  cardActiveBackground: 'rgba(255, 255, 255, 0.72)',

  // ── Tab bar ──
  tabBarBackground: 'rgba(255, 255, 255, 0.9)',
  tabBarBorder: 'rgba(200, 190, 220, 0.3)',
  tabActive: '#9178BD',
  tabInactive: '#b0a8c8',

  // ── Ring ──
  ringGlow: 'rgba(145, 120, 189, 0.7)',
  ringBezel: 'rgba(255, 255, 255, 0.85)',

  // ── Buttons ──
  buttonPlay: '#9178BD',
  buttonHeart: '#d4a0c8',
  buttonPlus: '#a898d0',

  white: '#ffffff',
} as const;

export type ColorKey = keyof typeof colors;
