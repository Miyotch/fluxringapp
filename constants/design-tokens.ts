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
  // 「戻る」リンク専用（tonmana_typography_reference .skback）。
  // textSecondary とは別トーン（やや明るい藤色）で、全画面共通。
  textBack:      '#AEB4D6',

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
// CARD FLIP — ホームのカード（タップで横180°回転）
// ─────────────────────────────────────────────
// components/CardGL.tsx（mode='flip'）が参照する。ここに集約する理由:
// 数値が CardGL 内に直書きだった頃、「回転にかかる時間」と「表面オーバーレイを
// 戻すまでの時間」が別々の値として散っており、片方だけ変えると演出が途中で
// 隠れる事故が起きやすかった。導出関係ごと1か所に置く。

/**
 * 表↔裏の 180° 回転にかける時間(ms)。
 * 旧実装はフレーム依存の補間（k = min(1, dt*9) を毎フレーム目標へ寄せる方式）で、
 * 60fps 実測の所要が約533ms だった。見た目の速さを変えないため、その実測値を
 * ほぼそのまま時間駆動の所要時間として採用する（533 → キリのよい 520）。
 */
export const FLIP_DURATION_MS = 520;

/**
 * 1フレームで進められる時間の上限(ms)＝ useFrame の dt クランプ値。
 * 旧実装は dt が 1/9秒(111ms)を超えると補間係数が 1 に飽和し、1フレームで
 * 裏面へ飛んで回転演出が丸ごと消えていた。時間駆動にしても、素の経過時間で
 * 進めると「1フレームしか描かれない」ケースでは同じく中間姿勢を通れない。
 * そこで 1フレームの進み量に上限を設け、ヒッチが起きても必ず
 * FLIP_DURATION_MS / FLIP_MAX_STEP_MS ≒ 11 フレームは中間姿勢を描くようにする。
 * 50ms = 20fps 相当。これより粗いフレームレートは「アニメーションが見えている」
 * 状態ではないため、そこで頭打ちにしてよいと判断した。
 * （プレイヤー mode='spin' の慣性・減衰・重力復帰にも同じ上限を掛ける。
 *   バックグラウンド復帰直後の巨大な dt でカードが一気に回るのを防ぐため。）
 */
export const FLIP_MAX_STEP_MS = 50;

/**
 * フリップの進捗カーブ（easeInOutCubic）。
 * 旧実装の指数的な寄せ方（初速が最大・末尾が極端に緩慢）は、60fps でも
 * 最初の1フレームでいきなり27°回り、後半は目視できない微差を数十フレーム
 * 続ける配分だった。始点と終点で静止し中盤を最も速く通る対称カーブにして、
 * 「カードが手前で立って裏返る」中間姿勢が確実に見えるようにする。
 */
export const FLIP_EASING = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * 裏面（フリップ後）の表示倍率。**実機調整ポイント**。
 *
 * 見かけのサイズは倍率だけでは決まらず、CardGL のカメラ換算を通る:
 *   px/world = height / (2 · 3.4 · tan(20°)) = height / 2.475
 * ホームの枠は 189×284pt なので px/world = 114.75、カード実体は
 * ワールド 1.3×1.95 ＝ 倍率1で 149×224pt（枠の 78.9%）に描かれる。
 *
 * したがって画面幅 402pt（iPhone 16 Pro）に対する裏面の占有率は
 *   1.10 → 164pt = 40.8%（旧値。指定サイズより明らかに小さかった）
 *   1.75 → 261pt = 64.9%（確定サイズ。指定のスクリーンショット実測と一致）
 *
 * 倍率を上げるときは CardGL 側の描画キャンバス D も連動させること。
 * D はこの値（＋FLIP_LIFT）から算出しており、足りないとカードの対角が
 * キャンバスをはみ出して回転中に四隅が切れる（1.75 倍の対角は 471pt で、
 * 旧 D=350 では確実に切れていた）。
 *
 * 表面は常に倍率1なので、この値を変えても表面のサイズは一切変わらない。
 */
export const FLIP_BACK_SCALE = 1.75;

/** 回転の中腹で「少し浮く」ぶんの倍率加算（進捗0.5でピーク）。旧 CardGL 直書きの 0.09 と同値 */
export const FLIP_LIFT = 0.09;

/**
 * ホーム（ディスカバー）の表面カード幅(pt)。
 * 参照実装は 380x760 の固定枠にカード 188.59 を置いているので、画面の高さを
 * 760 で割った倍率をそのまま掛ける（幅基準にすると設計枠より縦長の端末で
 * カードの縦だけが相対的に縮む。理由は DiscoverScreen のコメント参照）。
 * DiscoverScreen 自身が正だが、他画面（PlayerScreen）が「裏面の絶対サイズを
 * ホームと揃える」ために参照する必要があるため、ここに切り出して共有する。
 */
export const homeCardWidth = (screenH: number): number =>
  Math.round(188.59 * (screenH > 0 ? screenH / 760 : 1));

/**
 * 裏→表に戻すとき、表面の実体オーバーレイを復帰させるまでの**最短**待ち時間(ms)。
 * 回転が終わる前に戻すとオーバーレイが演出を隠すので、必ず回転時間より後にする。
 * 独立した数値にすると FLIP_DURATION_MS を変えたときに整合が崩れるため導出値にする。
 * +30ms は 60fps で約2フレームぶんの余裕（旧実装の 550ms と同値になる）。
 */
export const FLIP_OVERLAY_RESTORE_MS = FLIP_DURATION_MS + 30;

/**
 * オーバーレイ復帰の再確認間隔(ms)。
 * FLIP_OVERLAY_RESTORE_MS の一発 setTimeout だけでは足りない理由:
 * useFrame の dt は FLIP_MAX_STEP_MS で頭打ちにしてあるため、20fps を割る、
 * または途中で 1 回でも 250ms 級のヒッチが入ると、回転の所要が**実時間**で
 * 550ms を超える（計算上 15fps で約734ms・8fps で約1375ms・60fps＋300ms
 * ヒッチで約784ms）。その間に表面オーバーレイが戻ると、まだ横を向いている
 * カードの上に表の作品画像が突然現れる。そこで CardGL 側は
 * FLIP_OVERLAY_RESTORE_MS 経過後に spin.animating を見て、まだ回っていれば
 * この間隔で再確認する。60ms = 60fps で約4フレームぶん（人が段差として
 * 知覚しない範囲で、かつ再確認の回数を増やしすぎない値）。
 * 通常時（20fps 以上・ヒッチ無し）は 1 回目の判定で必ず抜けるので、
 * 従来と同じ 550ms 復帰のまま挙動は変わらない。
 */
export const FLIP_OVERLAY_RECHECK_MS = 60;

/**
 * オーバーレイ復帰の打ち切り時間(ms)。この時間を過ぎたら回転中でも復帰させる。
 * useFrame が止まる状況（Canvas の一時停止・GL コンテキスト喪失）で
 * animating が true のまま残ると、再確認が永久に続いて表面が戻らなくなる。
 * 3000ms は 5fps（1フレーム200ms＝実時間で約2200ms）でも通常復帰が先に来る値で、
 * これを下回るフレームレートはアニメーションとして成立していない領域。
 */
export const FLIP_OVERLAY_MAX_WAIT_MS = 3000;

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

  // 購入モーダルの待機呼吸（OS 課金シートの起動待ち）。1往復 2400ms。
  // btnGlowPeriodMs=3000 は「待たせていない状態」の呼吸で、待機中に 3s だと
  // 止まって見える。ActivityIndicator は灰色スピナーがダークトンマナから
  // 浮くため使わず、確定ボタンの枠 opacity を 0.30↔0.58 で呼吸させる。
  // （キー名は ANIM 内の他要素に合わせて camelCase。デザイナー指示の
  //   BUY_BUSY_PULSE_MS と同一の値・同一の意味）
  buyBusyPulseMs:  2400,

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

  // ④ 購入成立後の待ち（ホームの完了演出）
  // モーダルを fade out させてから泡を立てるまでの待ち時間。Modal の
  // animationType="fade" の消え際と、OS 課金シートの dismiss に演出を
  // 重ねないための間。**実測ではなく iOS 標準モーダルの dismiss 相当としての
  // 推定値**（本環境では実機の課金シートを出せず計測できていない）。
  sheetSettleMs:        320,
  // 泡をマウントしてから購入ボタンを「再生」へ変えるまでの待ち。
  // 泡が立ち切る前にボタンが変わると、演出が事後報告に見えるため遅らせる。
  ownedRevealDelayMs:   600,

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

// ─────────────────────────────────────────────
// CARD AURA（カード周りの色付き靄）
// ─────────────────────────────────────────────

/**
 * カード周りの「色付きオーラ（靄）」を描くか。
 *
 * false = 靄なし（現在の指定）。ホーム（CardAura）と再生画面（CardBackdrop）の
 * どちらも、auraA/auraB の色付きグロー層を描画しない。
 *
 * 落影・接地影・外周ハロは靄ではなくカードを空間に置くための影なので残す。
 * これらまで消すとカードが背景に貼り付いて見える。
 *
 * v98 参照実装（内 39/6・外 84/21 の2層 box-shadow 相当）はコードとして
 * 保持してあるので、戻すときはこのフラグを true にするだけでよい。
 */
export const CARD_AURA_ENABLED: boolean = false;
