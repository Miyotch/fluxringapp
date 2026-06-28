// FLUX RING — デザイントークン V2
// DESIGN.md 準拠。実機調整は各値のコメントを目安に。

// ─────────────────────────────────────────────
// COLOR
// ─────────────────────────────────────────────

export const COLOR = {
  // 基盤
  bg:         '#171430', // 画面全体の地・最深部
  surface:    '#222445', // カード面・面の参考値
  layer:      '#33356B', // 一段上の層・浮かせる要素
  border:     '#3A3D72', // ごく細い境界線

  // オーラ（背景で発光・流れる）
  auraViolet: '#7C62D6',
  auraBlue:   '#4684E0',
  auraCyan:   '#60CEE0', // CTA・選択・作品の縁に一点

  // テキスト
  textPrimary:   '#ECEEF7',
  textSecondary: '#9498BE',

  // 機能記号（世界観とは層が別）
  badge: '#FF3B30', // 未読バッジ
} as const;

// グロー合成用 rgba プリセット（ArtworkCard / PurchaseTransition で利用）
export const GLOW = {
  // カード標準グロー（作品色が未確定のときのフォールバック）
  defaultGlow:  'rgba(96,206,224,0.40)',  // #60CEE0 46px/6px 層
  defaultGlow2: 'rgba(70,132,224,0.16)',  // #4684E0 92px/18px 層
  dropShadow:   'rgba(0,0,0,0.42)',       // 接地影

  // 購入時シアン呼吸
  purchasePulse:  'rgba(120,232,255,0.78)', // 66px/16px 濃い層
  purchasePulse2: 'rgba(96,206,224,0.50)',  // 124px/34px 広い層
  purchaseInset:  'rgba(120,232,255,0.50)', // inset縁

  // ガラス光沢（クリアガラスフィルター）
  glassSheen:  'rgba(255,255,255,0.60)',
  glassEdge:   'rgba(255,255,255,0.40)',
  glassInset:  'rgba(255,255,255,0.10)',
} as const;

// ─────────────────────────────────────────────
// CARD SIZE
// ─────────────────────────────────────────────

// 縦横比は常に 2:3。width だけ変えれば height は自動（width * 1.5）。
export const CARD = {
  large: {
    width:       152,
    height:      228,
    radius:       18, // 台紙の border-radius
    inset:         7, // 台紙→画像の余白
    imageRadius:  11, // 画像の border-radius
    auraBlur:     46, // box-shadow blur 相当（sigma = blur/2 = 23）
    auraBlur2:    92, // 広い層（sigma = 46）
    auraSpread:    6,
    auraSpread2:  18,
  },
  small: {
    width:        96,
    height:      144,
    radius:       14,
    inset:         5,
    imageRadius:   8,
    auraBlur:     28,
    auraBlur2:    56,
    auraSpread:    4,
    auraSpread2:  10,
  },
  // グリッド（コレクション）: width は列幅追従。radius/inset/imageRadius は固定。
  grid: {
    radius:       12,
    inset:         5,
    imageRadius:   8,
  },
} as const;

// ─────────────────────────────────────────────
// ANIMATION — 周期・イージング
// ─────────────────────────────────────────────

export const ANIM = {
  // ヒーロー発光（蛍の明滅）
  heroPeriodMs:     6000,  // 1 呼吸の長さ（DESIGN.md: 6s）
  heroPeakOpacity:  0.40,  // ピーク opacity（DESIGN.md: 0.4）
  heroMinOpacity:   0.00,  // 暗い時の opacity（実機調整）
  // @keyframes 参考: 0%,42%{0}  64%{.4}  86%,100%{0}

  // 購入ボタングロー（呼吸的・約3s）
  btnGlowPeriodMs: 3000,
  btnGlowScale:    1.05,   // scale 上限

  // フッターフェード
  footerExitMs:    160,
  footerEnterMs:   500,

  // 縦スワイプしきい値
  swipeThreshold:  0.20,   // 画面高さに対する比率

  // 横スワイプ（ストーリー）: 1/4 幅で自動確定・オーバーシュートなし
  storySwipeThreshold: 0.25,
} as const;

// ─────────────────────────────────────────────
// PURCHASE ANIMATION
// ─────────────────────────────────────────────

export const PURCHASE = {
  // ① シアンの呼吸
  breathRiseMs:    550,  // box-shadow .55s ease-in-out
  breathHoldMs:    600,  // ピークを保つ時間（~0.6s）
  breathFallMs:    700,  // 戻し

  // ② 星の一斉点火
  starCount:       340,  // 粒数（DESIGN.md: 約340）
  starDurationMs: 1800,  // 点火〜収束（DESIGN.md: 約1.8s）
  starMinRadius:   0.35, // 最小粒半径
  starMaxRadius:   1.00, // 最大粒半径（0.35 + random*0.65）
  starWhiteRatio:  0.75, // 白粒の比率（残り25%が青み）
  starColorWhite:  [255, 255, 255] as const,
  starColorBlue:   [150, 210, 255] as const,
  // 縁起点伝播: reach = min(1, t/0.25)*1.2
  starReachCoeff:  1.20,
  starReachSpan:   0.25,

  // ③ 拡大トランジション（FLIP）
  expandMs:        620,  // duration
  // cubic-bezier(.2,.7,.25,1) — reanimated では Bezier() で指定
  expandBezier:    [0.2, 0.7, 0.25, 1.0] as const,
  expandOrigin:    'top left' as const,

  // トランスポートフェードイン
  transportRevealDelayMs: 720,
  transportRevealMs:      420,
  transportRevealSlide:    24, // translateY 開始オフセット(dp)

  // 購入後の呼吸ループ（カード拡大後）
  breathLoopMs:    1800, // withRepeat の 1 往復

  // グロー（box-shadow）参考値
  glowNear:  '0 0  66px 16px rgba(120,232,255,.78), 0 0 124px 34px rgba(96,206,224,.50), inset 0 0 0 1px rgba(120,232,255,.50)',
  glowOff:   '0 0   0px  0px rgba(120,232,255,.00), 0 0   0px  0px rgba(96,206,224,.00)',
} as const;

// ─────────────────────────────────────────────
// SPACING
// ─────────────────────────────────────────────

export const SPACE = {
  xs:   4,
  sm:   8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

// ─────────────────────────────────────────────
// BORDER RADIUS
// ─────────────────────────────────────────────

export const RADIUS = {
  sm:      8,
  md:     12,
  lg:     16,  // トランスポート(フロスト)
  card:   18,  // カード大・台紙
  full:  999,  // 円形
} as const;

// ─────────────────────────────────────────────
// TRANSPORT (プレイヤーコントロール)
// ─────────────────────────────────────────────

export const TRANSPORT = {
  bg:                 'rgba(150,160,230,0.08)',
  backdropBlur:       14,   // px
  backdropSaturate:    1.3,
  borderColor:        'rgba(96,206,224,0.16)',
  radius:             16,
  seekBarHeight:       3,   // dp
  seekBarColor:       COLOR.auraCyan,
  seekKnobSize:        8,   // dp・円の直径
  playBtnSize:        40,   // dp
  playBtnBorder:      'rgba(255,255,255,0.40)',
  controlLeftPad:     54,   // dp
} as const;

// ─────────────────────────────────────────────
// GLASS FILTER
// ─────────────────────────────────────────────

// クリアガラス（斜め光沢 118deg）
export const GLASS = {
  shineAngle:  118, // deg
  shineStops: [
    { pos: 0.00, alpha: 0.60 },
    { pos: 0.14, alpha: 0.20 },
    { pos: 0.32, alpha: 0.00 },
    { pos: 0.62, alpha: 0.00 },
    { pos: 0.85, alpha: 0.24 },
    { pos: 1.00, alpha: 0.50 },
  ],
  topEdgeHeight: 0.18, // 上辺グラデの終端（高さ比）
  topEdgeAlpha:  0.22,
  blendMode: 'screen' as const,
} as const;
