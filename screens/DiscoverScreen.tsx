/**
 * DiscoverScreen.tsx — ディスカバー（ホーム）P2 / 楽曲購入画面
 * ------------------------------------------------------------------
 * 参考: fr_discover_v50.html + component_catalog v50（HTMLは移植せず RN 化）。
 *
 * レイアウト（固定クローム＋横スワイプのカードページャ）:
 *   ・ブランド「Flux Ring」左上
 *   ・右上: 試聴中の EQ / 通知ベル(未読赤点) / 試聴スピーカー
 *   ・タイトル＋情景の言葉 左上
 *   ・中央: v98準拠カード（角丸作品画像＋オーラ。アクティブ面は実3D）
 *   ・下部: 発光する購入ボタン ＋ ウィッシュリスト星（所有時は再生＝星非表示）
 *   ・横スワイプで曲切替（左=次 / 右=前）
 *
 * フッターは App.tsx が描画（この画面は body 内・フッターの上に収まる）。
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  LayoutChangeEvent,
  useWindowDimensions,
  AccessibilityInfo,
  // 起動時の intro だけは reanimated ではなく RN 本体の Animated で書く
  // （PR #105 と同じ理由。launch→app の境界でワークレットを走らせない）。
  // この画面は reanimated の Animated / Easing も使うので別名で取り込む。
  Animated as RNAnimated,
  Easing as RNEasing,
  Image,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  cancelAnimation,
  runOnJS,
  runOnUI,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useIdleFloat } from '../lib/useIdleFloat';
import { useBackdropClock } from '../lib/usePausableClock';
import { useAudioPlayer } from 'expo-audio';
import { previewUrl } from '../lib/r2';
import { CardFace } from '../components/CardFace';
import { BackdropSky } from '../components/BackdropSky';
import { BackdropVeil } from '../components/BackdropVeil';
import { CardVeil } from '../components/CardVeil';
import { CardGround } from '../components/CardGround';
import { StarSeal, type SealInkImage } from '../components/StarSeal';
import {
  CardGL,
  CARD_ASPECT,
} from '../components/CardGL';
import { OrbitBuyButton } from '../components/OrbitBuyButton';
import { FavBead, FlyDot, BEAD_HIT } from '../components/FavBead';
import { SpeakerIcon } from '../components/icons';
import { computeBackScale } from '../components/CardGL';
import { PurchaseModal } from '../components/PurchaseModal';
import { EqBars } from '../components/EqBars';
import { useTopInset } from '../lib/safeArea';
import { useT } from '../lib/i18n';
import { usePlaybackOptional } from '../lib/playback';
import { PurchaseParticles } from '../components/PurchaseParticles';
import { PURCHASE, HOME_INTRO, homeCardWidth } from '../constants/design-tokens';
import { formatPrice, TRACK_PRICE_JPY } from '../constants/pricing';
import { JP_SERIF_FONT } from '../constants/fonts';
import { useBackgroundLayersConfig } from '../lib/backgroundLayers';
import { useLayoutAdjustConfig } from '../lib/layoutAdjust';
import type { PurchaseController } from '../lib/usePurchaseFlow';

// ── 表示スイッチ ──────────────────────────────────────────────
// true にするとカード層（ページャ・接地影・固定クローム）を丸ごと外し、
// 背景ブロック D と調律陣ブロック C だけを表示する。
// 参照 fr_v98-2_FIX（Cardless).html と 1:1 で見比べるときもこれを true にする。
// 天の川の明るさ・星の径・調律陣の焼き上がり・粒状感の確認用。
//
// ※ カードなし（星だけ）のビルドは 0.2.0 (14)〜(16)、および
//   perf/seal-pulse-thinning / perf/seal-static-bake ブランチに保存してある。
const DEBUG_BACKDROP_ONLY = false;

// ── v98 カルーセル（参照 fr_v98_FIX.html 710-731行）────────────────
// 曲送りは FlatList の pagingEnabled ではなく、参照と同じ dragX モデルで動かす。
// paging では確定しきい値が実質「画面幅の半分」になり、参照の 37.7px＋速度
// 500px/s より 5 倍以上重かった（＝「フリックがきかない」の直接原因）。
const CAR_THRESH_R = 0.20;   // 確定しきい値（カード幅比・参照 THRESH=CARDW*0.20）
const CAR_FAST_MIN_R = 0.06; // 速度成立時の最小移動量（参照 CARDW*0.06）
// 中央カードが消えきる距離。参照は CARDW*0.55（＝隣の札との間隔 STEP の 1/3）
// だったが、実機で「スワイプの途中、画面の真ん中に札が1枚も無い時間」ができた
// （2026-09-07 岡さん指摘）。参照は札どうしが STEP＝札幅の 1.7 倍も離れている
// ので、出ていく札が STEP の 1/3 で消えてしまうと、入ってくる札が届くまでの間が
// 空になる。消えきる距離を STEP そのものにすると、出ていく札は隣のスロットへ
// 着いた瞬間にちょうど 0 になる＝中央がいつもどちらかの札で埋まる。
const CAR_FADE_R = 0.55; // ※ 現在は未使用（carGeo.fade は step を使う）
const CAR_VEL = 500;         // フリック速度しきい値 px/s（参照 0.5px/ms）
// 指を離したあとの寄せ（2026-09-22 から UI スレッドの withTiming）。
// 参照は毎フレーム dragX += (target-dragX)*0.22 の指数ラープで、残りの割合は
// 0.78^(60t) = e^(-14.9t)。これは 2^(-10t/T) と T≈0.465 秒で一致するので、
// 距離によらず長さ固定で同じ減り方になる。
const CAR_SETTLE_MS = 470;
// 1 - 2^(-10t) を t=1 でちょうど 1 になるよう割り戻した ease-out。素の
// Easing.out(Easing.exp) は t=1 で 0.999 までしか進まず、最後に残りを一度に吸着する
// （参照の整定しきい値 0.8px と同じ「止まる直前にカクッと跳ぶ」になる）。
const CAR_SETTLE_EASE = (t: number) => {
  'worklet';
  return (1 - Math.pow(2, -10 * t)) / (1 - Math.pow(2, -10));
};
// 着地フェード。参照 landT0 は 800ms かけて 0→1 だが、実機で「入れ替わった札が
// 一瞬消える」と見えた（2026-09-07 岡さん指摘）。中央スロットを 0 から立ち上げる
// 目的は「通し番号(pos)の反映が 1〜2 フレーム遅れる間、古い絵柄を中央で光らせない」
// ことだけなので、その数フレームさえ隠せれば長さは要らない。
// ease-in（立ち上がりが遅い曲線）と組み合わせて、最初の 3 フレームはほぼ 0、
// 200ms で完全に戻る＝目には「沈まずにそのまま入れ替わる」ようにする。
const CAR_LAND_MS = 200; // ※ 現在は未使用（着地の暗転そのものを廃止した）
const CAR_AXIS = 6;          // 軸判定＝タップ境界（参照 moved の 6px）
// ※ 裏面を横に払って次の札へ送る動き（CAR_AXIS_BACK）と、強く払ったときの
//   2 枚送り（CAR_VEL2）は 2026-09-24 に外した。裏面を指で回して眺める操作と
//   取り合い、2 枚送りは不自然に見えたため（岡さんとの打ち合わせで合意）。
/**
 * カードの輪の枚数（2026-09-23）。7 枚を輪にして並べ、画面の外（中央から 3.5 枚
 * ぶん離れた所）で札を反対側へ回して絵柄を差し替える。見えている札の絵柄は
 * 動いている間いっさい変わらない。見えるのは中央 ±0.9 枚ぶんだけなので、
 * 受け渡し（React の再描画）が 2.6 枚ぶん遅れても画面は壊れない。
 */
const RING = 7;
// 縦にこれだけ先行したらスワイプを諦める（2026-09-15 に 6 → 24）。
// 6px だと親指の弧で縦に先にブレただけで失敗し、指はカードの Pressable に残って
// 離した瞬間に「タップ」＝裏返しになっていた。ホームには縦の操作が無いので緩めてよい。
const CAR_FAIL_Y = 24;

// ── 待機中の星の流れ（2026-09-14 代表指示「ホームにもっと没入感を」）──
// カードと調律陣は固定のまま、後ろの星だけを左へゆっくり流し続ける。
// 速さは近景の星を基準に「1秒で画面幅の何割進むか」。0.0125 ＝ 約80秒で画面を横切る
// （2026-09-22 に 0.025 から半分へ）。層ごとの比（遠 0.6 / 中 0.8 / 近 1.0）は
// StarField の LayerSpec.parallax が掛かる。
//
// 星をカードの横スワイプに付けて動かすこと、天の川を流すことはしない（2026-09-22、
// 発熱の再発で外した）。付けるとスワイプ中は指の 60fps で全画面 Canvas 3 枚を
// 塗り直し、天の川を流すには雲と星を 3 組ずつ描く必要があった。天の川は 0.1.0 (100)
// と同じく、雲がその場でそよぐだけ。
const DRIFT_R_PER_S = 0.0125;
// 流れの値を書き換える間隔(ms)。100 ＝ 10 回/秒。星の Canvas の塗り直し回数は
// この値が変わった回数で決まる（下の starDrift のコメント）。
const DRIFT_STEP_MS = 100;
// 参照 2999行: card.style.transform ... scale(1 - press*.035)
const CARD_PRESS_SCALE = 0.035;
/** 試聴を鳴らし始めるまでの間(ms)。カードが止まってから */
const PREVIEW_START_MS = 300;
/** 試聴を止めるときのフェード(ms)と、その刻み */
const PREVIEW_FADE_MS = 160;
const PREVIEW_FADE_STEP_MS = 40;
/**
 * 試聴の鳴り始めのフェードイン(ms)。以前は 400ms で、曲の頭の一音（アタック）が
 * 削れて聞こえた（2026-09-24）。切り出しの頭でプツッと鳴らない最小限だけ残す
 */
const PREVIEW_FADE_IN_MS = 80;
/** カードがこれ以上傾いたら（裏返し始めたら）★を消す(度) */
const FAV_HIDE_DEG = 6;
/**
 * 裏面の右上の音の ON/OFF ボタン（2026-09-24）。
 * 裏面がほぼ正面を向いている（表から 171° 以上回っている）ときだけ出す。
 * 裏面を指で傾けて眺めている間は、刻印の上に浮いて見えないよう消す。
 */
const SPK_SHOW_DEG = 171;
/** ボタンの当たり判定の一辺と、裏面の角からボタン中心までの距離(px) */
const SPK_HIT = 44;
const SPK_INSET = 26;
// 参照 2995行: 指が 7px 動いたら「押した」を取り消す（＝スワイプの入り口）
const CARD_PRESS_SLOP = 7;

// カードが表からこれ以上傾いたら接地影を消して固定する（参照の hideEls 相当）
const GROUND_HIDE_DEG = 8;
// これ以上傾いている間は背景（天の川・星・調律陣の光点）の時計を止める
const SPIN_PAUSE_DEG = 2;

// ホーム左上の曲名タイトルの位置調整に使う「1文字分」の基準値。
// styles.title の fontSize と同じにして、和文全角1文字ぶん
// 下げる／内側へ寄せるという指示をそのまま数値化する。
const TITLE_CHAR_SIZE = 20;

const C = {
  page: '#0E0C20',
  text: '#ECEEF7',
  sub: '#9498BE',
  cyan: '#60CEE0',
  badge: '#E0584E',
} as const;

export type Track = {
  id: string;
  title: string;
  subtitle?: string;        // 情景の言葉（効能は語らない）
  artistName: string;
  artistId?: string;         // artists コレクションのドキュメントID（作家紹介の紐付け用）
  artworkUrl: string;
  audioKey: string;         // R2 音源キー（試聴は公開・フルは署名付き）
  previewUrl: string | null;
  priceLabel: string;
  /** 購入時点の価格（円）。purchase_history への記録用。未設定は標準単価扱い。
   *  Firestore tracks/{id}.price から。 */
  priceJpy?: number;
  owned?: boolean;
  glowColor?: string;
  glowColor2?: string;
  /** 販売期間。startAt は type によって意味が変わる（同じフィールドを兼用する運用）:
   *    type==='limited' → 販売開始日（〜endAt の間だけ販売。どちらも未設定側は無期限扱い）
   *    type==='always'  → 公開日（この日以降ずっと表示。endAt は使わない）
   *  Firestore tracks/{id}.sale から。 */
  sale?: { type: 'always' | 'limited'; startAt: number | null; endAt: number | null };
  /** ホームでの並び順の種類。未設定は 'fixed' 扱い。
   *  Firestore tracks/{id}.homeOrderMode から。 */
  homeOrderMode?: 'fixed' | 'random';
  /** homeOrderMode==='fixed' のときの表示順（1以上・小さい順）。
   *  0 または未設定は「固定の曲の中で末尾」。'random' のときは未使用。
   *  Firestore tracks/{id}.homeOrder から。 */
  homeOrder?: number;
  // 裏面（タップで表示する説明）
  back?: {
    serial?: string;         // 'No. 001'
    story?: string;          // 情景の言葉（裏面の本文）
    materials?: string[];    // 原材料（例: ['朝の空気', '低い持続音']）
    tuning?: string;         // 調律名（例: '純正律'）
    frequencies?: string[];  // 周波数のみ（例: ['432 Hz', '7.83 Hz']）
    artist?: string;         // 'NAOKI OKA'
    useCases?: string[];     // 用途タグ（例: ['睡眠', '勉強', '集中力']）
  };
};

/**
 * 現在この楽曲をホームに出してよいか。
 *   type==='limited' → startAt（販売開始日）〜endAt（販売終了日）の間だけ true
 *   type==='always'  → startAt（公開日）以降ずっと true（endAtは見ない）
 *   sale未設定       → 常に true（従来どおり）
 * startAt/endAtの「未設定」は各側とも無期限（下限／上限なし）として扱う。
 */
export function isTrackOnSale(track: Pick<Track, 'sale'>, now: number = Date.now()): boolean {
  const sale = track.sale;
  if (!sale) return true;
  if (sale.startAt != null && now < sale.startAt) return false;
  if (sale.type === 'limited' && sale.endAt != null && now > sale.endAt) return false;
  return true;
}

/**
 * ホームの表示順を確定する（2026-09-21 指示）。
 *   1. homeOrderMode==='fixed'（未設定も含む・既定）の曲を homeOrder 昇順で
 *      先に並べる。homeOrder が 0 または未設定の曲は、固定の曲の中で末尾に回す。
 *   2. homeOrderMode==='random' の曲は、そのあとにランダムな順で並べる。
 *
 * ランダムの並びそのものはこの関数では作らない（呼び出し側の App.tsx が、
 * 対象の曲集合が変わらない限り同じ並びを使い回して安定させる。毎レンダーで
 * シャッフルし直すと、スワイプ中にカードが入れ替わって見えてしまうため）。
 * ここでは受け取った randomOrderIds の並びどおりに差し込むだけ。
 */
export function orderHomeTracks<T extends Pick<Track, 'id' | 'homeOrderMode' | 'homeOrder'>>(
  tracks: T[],
  randomOrderIds: string[],
): T[] {
  const fixed = tracks
    .filter((t) => (t.homeOrderMode ?? 'fixed') !== 'random')
    .map((t, i) => ({ t, i })) // 安定ソート用に元の順序を保持（同順位はこの順のまま）
    .sort((a, b) => {
      const oa = a.t.homeOrder && a.t.homeOrder > 0 ? a.t.homeOrder : Number.POSITIVE_INFINITY;
      const ob = b.t.homeOrder && b.t.homeOrder > 0 ? b.t.homeOrder : Number.POSITIVE_INFINITY;
      return oa !== ob ? oa - ob : a.i - b.i;
    })
    .map(({ t }) => t);
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const random = randomOrderIds.map((id) => byId.get(id)).filter((t): t is T => !!t);
  return [...fixed, ...random];
}

type Props = {
  tracks?: Track[];
  /** 購入が**成立した**ときだけ呼ばれる（キャンセル・失敗では呼ばない） */
  onBuy?: (track: Track) => void;
  /** 起動時に最初に表示するカードの id（コレクションのウィッシュから飛んできたとき用） */
  focusTrackId?: string | null;
  /** 所有している trackId（App.tsx の usePurchaseFlow から。Firestore が正） */
  ownedIds?: Set<string>;
  /**
   * ウィッシュリストに置かれている trackId。App.tsx の useWishlist が正。
   * 未指定のときだけ画面内のローカル state にフォールバックする（部品デモ用）。
   * ここを props にするまで★はこの画面に閉じていて、コレクションのウィッシュリストへ届かなかった。
   */
  wishlistIds?: Set<string>;
  /** ★のトグル。未指定ならローカル state を切り替える（保存されない） */
  onToggleWishlist?: (trackId: string) => void;
  /** 購入フロー。未指定なら購入ボタンは押しても何も起きない（ギャラリー表示用） */
  purchase?: PurchaseController;
  /** 所有済みカードの「再生」ボタン押下 → 再生画面を開く。未指定なら何も起きない */
  onPlay?: (trackId: string) => void;
  /**
   * カードの★でウィッシュリストに入れ、光の粒がフッターのプレイリストタブに
   * 着いたとき。App.tsx がタブを一度脈打たせる。
   */
  onWishAdded?: () => void;
  /** カード裏面の作家名タップ → 作家画面へ。未指定ならタップは常時フリップに戻る */
  onOpenArtist?: (artistId: string) => void;
  /**
   * 起動後の最初のマウントで、暗転から段階的に灯す intro を走らせる。
   * App.tsx が起動直後の 1 回だけ true を渡す（タブ移動や再生画面から戻った
   * 再マウントでは false ＝ 全層すぐに表示）。
   */
  introOnMount?: boolean;
  /** intro が終わった（または reduce-motion で一斉フェードし終えた）ことを親へ返す */
  onIntroDone?: () => void;
  /**
   * フッターがこの画面の上へ重なって描かれるときの、その高さ(px)。
   *
   * フッターを透明にして星空を透かすため、App.tsx はホームでだけフッターを
   * 絶対配置でかぶせる＝この画面の描画領域が画面の高さいっぱいになる。
   * 背景（星・天の川・調律陣の Canvas）はその全面を使い、**カードと下部
   * クロームの位置決めだけ** この値を差し引いて、従来と同じ見えを保つ。
   */
  bottomInset?: number;
  /**
   * フッターの上に出ている再生バナーの高さ(px)。0 なら出ていない（0.2.0 第 2 段階）。
   * 購入ボタンがバナーと重なるときだけ、その分を上へ逃がす。カードは動かさない。
   */
  bannerInset?: number;
};

// フォールバック用スタブ（App からは stubData を渡す）
const FALLBACK: Track[] = [
  {
    id: 't1', title: '冬明け', subtitle: '夜明け前、まだ青い部屋に最初の光がにじむ',
    artistName: '岡ナオキ', artworkUrl: 'https://picsum.photos/seed/fuyuake/640/960',
    audioKey: 'blue', previewUrl: null, priceLabel: '¥2,500',
    glowColor: 'rgba(96,206,224,0.42)', glowColor2: 'rgba(70,132,224,0.16)',
    back: {
      serial: 'No. 001',
      story: '夜明け前、まだ青い部屋に最初の光がにじむ。音は何も足さず、ただ部屋の温度をわずかに上げていく。',
      materials: ['純正律'],
      frequencies: ['432 Hz', '7.83 Hz'],
      artist: 'NAOKI OKA',
    },
  },
];

export const DiscoverScreen: React.FC<Props> = ({
  tracks = FALLBACK,
  onBuy,
  focusTrackId,
  ownedIds,
  wishlistIds,
  onToggleWishlist,
  purchase,
  onPlay,
  onWishAdded,
  onOpenArtist,
  introOnMount = false,
  onIntroDone,
  bottomInset = 0,
  bannerInset = 0,
}) => {
  // ウィッシュから飛んできたときは、その曲のカードを最初に表示する。
  const initialIndex = focusTrackId
    ? Math.max(0, tracks.findIndex((t) => t.id === focusTrackId))
    : 0;
  // タイトルはセーフエリア下へ寄せる。右上のEQメーターと同じ top
  // （topRightY + 5 + TITLE_CHAR_SIZE）を使い、高さを揃える。
  const t = useT();
  const topRightY = useTopInset(8);
  const [slideH, setSlideH] = useState(0);
  // 調律陣が焼いた彫刻シルエット。星の平面をこの形で削るためだけに使う。
  // 調律陣そのものの描画には関与しない（BackdropSky → StaticStars の SealOccluder）。
  const [sealInk, setSealInk] = useState<SealInkImage>(null);
  // setState をそのまま渡すと、関数を「更新関数」と解釈されてしまう。
  // 参照も固定して StarSeal の React.memo を壊さない。
  const handleSealInk = useCallback((ink: SealInkImage) => setSealInk(ink), []);
  /**
   * いま中央にいる札の通し番号。札を送るたびに ±1 され、曲は tracks[通し番号 mod 曲数]。
   * 隣のスロットも「通し番号 ± k」で引くので、どのスロットに何の絵が載るかは
   * この 1 つの数だけで決まる（位置は下の dragX＋スロット固定の並び）。
   */
  const [pos, setPos] = useState(initialIndex);
  /** pos の JS 側の写し。受け渡しの前でも「いま何番へ向かっているか」を数えるのに使う */
  const posRef = useRef(initialIndex);
  /** 起動時の通し番号。dragX = -(通し番号 - これ) × STEP の関係になる */
  const posAtMountRef = useRef(initialIndex);
  const posAtMount = posAtMountRef.current;
  /** 指を離した時点で見込んだ行き先（chromePos の写し） */
  const aimRef = useRef(initialIndex);
  /**
   * 曲名・ボタン・試聴が指している札の通し番号。
   *
   * カード本体の pos は「寄せ終わって受け渡したとき」に進むが、こちらは
   * **指を離した時点**で行き先へ進める（2026-09-23 代表指示）。送ったのに
   * 0.5 秒ほど前の曲名が出たままなのを消すため。カードの絵（pos）と
   * 曲名（chromePos）が食い違うのは、滑っている最中の 0.5 秒弱だけ。
   */
  const [chromePos, setChromePos] = useState(initialIndex);
  const [flipped, setFlipped] = useState(false); // アクティブカードが裏面か（横スクロール可否用）
  // アクティブカードの表面からの回転角（度）。focus-dim（背景暗転）の駆動用
  const cardRotation = useSharedValue(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  // 試聴のオン／オフはカードごとにリセットせず、アプリ全体で一貫させる
  // （2026-09-19 指示）。スピーカーボタンで一度オフにしたら、曲を送っても
  // オンには戻らない。既定はオン（従来どおり自動で鳴り始める）。
  const [previewEnabled, setPreviewEnabled] = useState(true);
  // ウィッシュリストは App.tsx の useWishlist が正。props が無いとき（部品デモ）だけローカルに持つ。
  const [localWishlist, setLocalWishlist] = useState<Set<string>>(new Set());
  const wishlist = wishlistIds ?? localWishlist;

  // 購入の光粒子演出（元のカード位置から下部いっぱいに舞い上がる）
  const [showPurchaseFx, setShowPurchaseFx] = useState(false);
  // 購入確認ポップアップの対象（null=非表示）
  const [purchaseTarget, setPurchaseTarget] = useState<Track | null>(null);
  // 購入は成立したが、まだ「再生」表示に切り替えていない trackId。
  // 演出が立ち切る前にボタンが変わると、事後報告に見えるため一拍待たせる。
  const [pendingReveal, setPendingReveal] = useState<Set<string>>(new Set());

  // ── 起動時 intro（暗転から段階的に灯す）────────────────────────
  // 各層を opacity 0 のラッパへ入れ、重い層がコミットされてから 0→1 で灯す。
  // 値は 0..1 の進行度で、opacity はそのまま、位置・拡大は interpolate で作る。
  //
  // introOnMount=false（タブや再生画面から戻ってきた再マウント）のときは初期値 1 の
  // 静止した値になるので、ラッパは残るが見た目もコストも従来どおり。
  //
  // DEBUG_BACKDROP_ONLY のときも 1 から始める。カード層は描かれないが背景と調律陣は
  // 描かれるので、0 から始めると背景確認用のビルドが真っ暗になってしまう。
  const introFrom = introOnMount && !DEBUG_BACKDROP_ONLY ? 0 : 1;
  const intro = useRef({
    sky: new RNAnimated.Value(introFrom),
    seal: new RNAnimated.Value(introFrom),
    card: new RNAnimated.Value(introFrom),
    top: new RNAnimated.Value(introFrom),
    bottom: new RNAnimated.Value(introFrom),
  }).current;
  const introStarted = useRef(false);
  // 完了通知は ref 経由で読む。deps に入れると、親がインライン関数を渡している
  // 場合に再レンダーごとへ effect が張り直され、cleanup が rAF を潰して
  // intro が永久に始まらなくなる。
  const onIntroDoneRef = useRef(onIntroDone);
  onIntroDoneRef.current = onIntroDone;

  // ── カードを開いているあいだの暗転（参照 .device.ca-detail）──────
  // 参照 2878行: .ca-veil は opacity .8s cubic-bezier(.2,.7,.2,1) で 0→1、
  // 同時に調律陣（#frSeal*）が .32 まで沈む（2881行）。
  // 値は JS 側の RNAnimated で持ち、消費側はラッパの opacity だけ＝
  // ネイティブドライバで完結し、Skia の Canvas は一切塗り直されない。
  const detail = useRef(new RNAnimated.Value(0)).current;
  const sealDim = useRef(
    detail.interpolate({ inputRange: [0, 1], outputRange: [1, 0.32] }),
  ).current;
  // 左上の曲名は表面のときだけ出す。裏面へ回すとフェードアウトし、表へ戻ると
  // フェードインする（参照 .device.ca-detail .texts）。裏面は刻印面そのものが
  // 主役なので、表の情報を残すと二重に読ませることになる。
  const titleFade = useRef(
    detail.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
  ).current;
  useEffect(() => {
    RNAnimated.timing(detail, {
      toValue: flipped ? 1 : 0,
      duration: flipped ? 800 : 650,
      easing: RNEasing.bezier(0.2, 0.7, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [flipped, detail]);

  const sealScale = useRef(
    intro.seal.interpolate({ inputRange: [0, 1], outputRange: [HOME_INTRO.sealScaleFrom, 1] }),
  ).current;
  const cardRise = useRef(
    intro.card.interpolate({ inputRange: [0, 1], outputRange: [HOME_INTRO.cardRiseFrom, 0] }),
  ).current;
  const topDrop = useRef(
    intro.top.interpolate({ inputRange: [0, 1], outputRange: [HOME_INTRO.topDropFrom, 0] }),
  ).current;
  const bottomRise = useRef(
    intro.bottom.interpolate({ inputRange: [0, 1], outputRange: [HOME_INTRO.bottomRiseFrom, 0] }),
  ).current;

  useEffect(() => {
    // DEBUG_BACKDROP_ONLY では値が 1 から始まるので、走らせても見た目は変わらない
    // （完了通知だけが親へ返る）。ここで弾くと onIntroDone が永久に来ない。
    if (!introOnMount || introStarted.current || slideH <= 0) return;
    introStarted.current = true;
    let cancelled = false;

    const run = (reduced: boolean) => {
      if (cancelled) return;
      const t = (
        v: RNAnimated.Value,
        duration: number,
        delay: number,
        easing: (value: number) => number = RNEasing.out(RNEasing.quad),
      ) =>
        RNAnimated.timing(v, { toValue: 1, duration, delay, easing, useNativeDriver: true });

      const anim = reduced
        ? // 「視差効果を減らす」設定では順序も移動も捨て、一斉に明るくするだけにする
          RNAnimated.parallel([
            t(intro.sky, HOME_INTRO.quickMs, 0),
            t(intro.seal, HOME_INTRO.quickMs, 0),
            t(intro.card, HOME_INTRO.quickMs, 0),
            t(intro.top, HOME_INTRO.quickMs, 0),
            t(intro.bottom, HOME_INTRO.quickMs, 0),
          ])
        : // 奥から手前へ・下から上へ（DESIGN.md「灯る・昇る」）
          RNAnimated.parallel([
            t(intro.sky, HOME_INTRO.skyMs, 0),
            t(intro.seal, HOME_INTRO.sealMs, HOME_INTRO.sealDelayMs),
            t(intro.card, HOME_INTRO.cardMs, HOME_INTRO.cardDelayMs, RNEasing.out(RNEasing.cubic)),
            t(intro.top, HOME_INTRO.topMs, HOME_INTRO.topDelayMs),
            t(intro.bottom, HOME_INTRO.bottomMs, HOME_INTRO.bottomDelayMs),
          ]);

      anim.start(() => {
        if (!cancelled) onIntroDoneRef.current?.();
      });
    };

    // 重い層（星空・調律陣・カード）はこの render でマウントされ、StarSeal の
    // 彫刻・発光画像のベイクが JS スレッドで同期実行される。コミット後に rAF を
    // 2 回またいでから灯し始めることで、ベイクで JS が止まっている間は opacity 0 の
    // まま＝「フェード途中の濃さで全層がいきなり現れる」が起きない。
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        AccessibilityInfo.isReduceMotionEnabled()
          .then(run)
          .catch(() => run(false));
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [slideH, introOnMount, intro]);

  const { width: screenW, height: screenH } = useWindowDimensions();
  const count = tracks.length;
  /**
   * 通し番号 → 曲（循環）。番号は送るたびに際限なく増減するので、曲を引くときは
   * 必ずここを通す。中央は pos、隣は pos±1、その外は pos±2。
   */
  const trackAt = (p: number) => tracks[(((p % count) + count) % count)];
  const active = trackAt(pos) ?? tracks[0];
  /** 曲名・ボタン・試聴が指している札（指を離した時点で切り替わる） */
  const shown = trackAt(chromePos) ?? active;
  // 試聴のタイマーから読む用の写し（仕掛けた時点の値で固まらないように）
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const previewEnabledRef = useRef(true);
  const isOwnedRef = useRef<(t: Track) => boolean>(() => false);
  // 参照はカード 188.6px を 380x760 の固定デバイス枠の中で見せている。
  // その設計をそのまま実画面へ等比フィットさせ、カード幅から調律陣・カルーセル
  // 距離・接地影まで全部を同じ倍率で連動させる。
  //
  // 基準は「画面の高さ÷760」。幅基準（min）だと Pixel 6（411x914・比 2.22）の
  // ように設計枠（比 2.00）より縦長の端末では、幅の比率は参照と一致するのに
  // 縦は相対的に 11% 小さくなり「カードの縦が短い」と見えていた。
  //   参照: カード高 282.9 / 枠高 760 = 37.2%
  //   幅基準のアプリ: 306 / 914 = 33.5%
  // 端末の形が設計と違う以上どちらかしか合わないので、実機で違和感の出た
  // 縦を優先する（そのぶん幅は画面の 49.6% → 55% と参照より広くなる）。
  // フッターは設計枠 380x760 の内側にあるので、割る相手は表示領域ではなく
  // 画面の高さ。
  const cardW = homeCardWidth(screenH);
  // 比率は CardGL の CARD_ASPECT が唯一の正（GL メッシュと必ず揃える）
  const cardH = Math.round(cardW * CARD_ASPECT);
  // 参照のデバイス枠に相当する矩形。裏面の拡大率 S と持ち上げ量はここ基準で決まる
  // （参照 _dv3d.layout: S = min(1.28, 枠幅*0.86/カード幅, 枠高*0.82/カード高)）。
  // CardGL 自身に frame を渡し、裏面の実倍率は CardGL 内部の computeBackScale に
  // 任せる（下部クロームは固定位置になったので、ここで揃えて計算する必要はない）。
  // フッターがかぶさるぶんを差し引いた「カードの居場所」。背景 Canvas は
  // slideH（画面いっぱい）のままで、位置決めだけこちらを使う。
  const contentH = Math.max(0, slideH - bottomInset);
  const cardCenterY = contentH / 2;

  // 星雲・魔法陣（調律陣）レイヤーの運営調整（設定→背景レイヤー調整のスライダー）。
  // 既定値(offsetX/Y=0・scale=1)では今の位置・大きさのまま変わらない。
  const layerAdjust = useBackgroundLayersConfig();
  // カード本体／下部ボタン行の縦位置の運営調整（設定→ボタン位置調整のスライダー）。
  // 既定値(0)では今の位置のまま変わらない。
  const layoutAdjust = useLayoutAdjustConfig();
  const cardFrame = useMemo(
    () => ({ width: screenW, height: contentH }),
    [screenW, contentH],
  );

  // 購入ボタン／ウィッシュ星の位置は裏返し時も動かさず固定にする
  // （iPhone 16 で、裏面のカードが拡大されるのに合わせてボタンが下へスライドし、
  // ガタつくとの指摘のため）。裏面は computeBackScale で枠内に収まるよう
  // クランプ済みなので、固定位置のままでも大きくはみ出さない。
  const BOTTOM_BASE_RAW = bottomInset + 100 + contentH * 0.02;
  // 再生バナーが出ているとき、購入ボタンの下端がバナーに掛かる分だけ上げる
  // （今の寸法では 100px の余白で足りており、ふだんは動かない）
  const BOTTOM_BASE = Math.max(BOTTOM_BASE_RAW, bottomInset + bannerInset + 12);

  // 購入確定時のカード発光・浮遊。発光は CardGL の purchaseGlow（枠＋外周グロー）へ
  // 渡し、浮遊は中央スロットの transform（centerStyle）へ合成する。
  const cardGlow = useSharedValue(0);
  const cardTranslateY = useSharedValue(0);
  const cardScale = useSharedValue(1);

  // フェーズ1(0-400ms)発光イン＋持ち上げ／フェーズ2(400-1000ms)微浮遊のまま保持／
  // フェーズ3(1000-1600ms)発光・位置ともに元へ収束
  const triggerCardGlow = useCallback(() => {
    const rise = { duration: 400, easing: Easing.out(Easing.quad) };
    const settle = { duration: 600, easing: Easing.inOut(Easing.quad) };
    cardGlow.value = withSequence(withTiming(1, rise), withDelay(600, withTiming(0, settle)));
    cardTranslateY.value = withSequence(withTiming(-10, rise), withDelay(600, withTiming(0, settle)));
    cardScale.value = withSequence(withTiming(1.02, rise), withDelay(600, withTiming(1, settle)));
  }, [cardGlow, cardTranslateY, cardScale]);

  // ── v98 カルーセルの状態（参照 710-731行）──────────────────────
  const carGeo = useMemo(
    () => ({
      thresh: cardW * CAR_THRESH_R,
      fastMin: cardW * CAR_FAST_MIN_R,
      // 参照 STEP = 190 + CARDW/2 + THRESH（隣カードとの中心間距離）。
      // 先頭の 190 は参照デバイス(380px幅)基準の実寸なので、カードと同じ
      // 倍率（cardW/188.59）でスケールする
      step: (190 + 188.59 / 2 + 188.59 * CAR_THRESH_R) * (cardW / 188.59),
    }),
    [cardW],
  );
  // 出ていく札が消えきる距離＝隣のスロットまでの距離。中央が空く時間をなくす
  const carFade = carGeo.step;
  /**
   * カード層の横位置(px)。指に 1:1 で追従し、離すと STEP の倍数へ寄る。
   * 札を送るたびに ∓STEP ずつ積み上がっていき、0 へ戻すことはしない。
   * 中央にいる札の通し番号（小数）は posAtMount - dragX / STEP。
   *
   * ★ 札の位置は **UI スレッドだけ**で決める（下の輪 useRingSlotStyle）。
   *   React の state を位置の計算に混ぜると、絵柄（React のコミット）と位置
   *   （Reanimated の書き込み）が別の経路で届き、着地の 1 フレームだけ
   *   「次のカード」が中央に出る。2026-09-23 に 2 回、形を変えて直しても
   *   出続けた（13:39 収録 12 回中 4 回・14:09 収録 10 回中 9 回）。
   *   経路のずれそのものは消せないので、ずれても見えない作りにした:
   *   絵柄を差し替えるのは画面の外にいる札だけ、が輪の要。
   */
  const dragX = useSharedValue(0);
  /**
   * 受け渡し済みの札の位置(px)。dragX と同じ空間で、UI スレッドから読む。
   * 寄せ先の基準と「±2 枚まで」の制限にだけ使う（見た目には出ない）ので、
   * React の再描画を待たずに commitCarousel から直接書いてよい。
   */
  const committedSV = useSharedValue(0);
  /** 指の移動量の原点（onUpdate で dragX = gestureStart + translationX） */
  const gestureStart = useSharedValue(0);
  /** このジェスチャで寄せる基準の位置（掴んだ時点の寄せ先、止まっていれば最寄りの札） */
  const grabOrigin = useSharedValue(0);
  /** 1 = 寄せのアニメ中。次のスワイプで掴まれたら止めて 0 に戻す */
  const settleActive = useSharedValue(0);
  /** 走っている寄せの行き先 */
  const settleTarget = useSharedValue(0);
  /**
   * 1 = カードが横に動いている、または送った札の受け渡し待ち（React の再描画待ち）。
   * 隣の札を出しておく・フロートを止める・背景の時計を止める、の判断に使う。
   * 指が触れただけでは立てない（フリップ目的のタップで背景の一時停止がトグルしない）。
   *
   * 以前は参照 down() どおり、この間に来たタッチを無視していた。整定の開始も
   * 受け渡しも JS 経由だったので、JS が混むと（実機収録で最大約 0.5 秒）連続スワイプが
   * 効かず、指を離したカードもその場で止まっていた（2026-09-22 代表指摘）。
   */
  const carBusy = useDerivedValue(() =>
    settleActive.value > 0.5 || Math.abs(dragX.value - committedSV.value) > 0.5 ? 1 : 0,
  );
  /**
   * 1 = 中央を 3D カード（CardGL）が描いている。0 = 輪の札（CardFace）が描いている。
   *
   * 両者は静止時まったく同じ見た目（CardAura＋作品画像 cover・角丸 0.085＋
   * CardSurface）。CardGL は輪の **下** にいて、glOn = 1 のあいだだけ輪の中央の
   * 札が外れて CardGL が見える。CardGL 自身は不透明度で出し入れしない
   * （下の「書き戻し」の注意を参照）。
   *
   *   ・札を送り終えた瞬間（UI スレッド）に 0。CardGL はまだ前の曲で、1 枚ぶん
   *     外（committedSV がまだ前の位置）にいるので見えない
   *   ・受け渡しが済み、CardGL が新しい曲の絵を出し終えたら、committedSV を
   *     新しい位置へ送るのと glOn = 1 を **同じ worklet で**行う（revealGL）。
   *     CardGL が中央へ来るのと、輪の中央の札が外れるのが同じフレームになる
   *
   * ★ 書き戻し: Reanimated の Animated.View は、アニメが止まってしばらくした
   *   ところで再描画されると、**マウント時の値**をネイティブへ書き戻す
   *   （1 本目の収録で 3 枚ぶんずれた原因）。静止中に再描画されうる view には、
   *   マウント時の値がそのまま正しい値になるものだけを持たせる。
   */
  const glOn = useSharedValue(0);
  /** 0 = マウント直後。輪の札のマウント時の値を「非表示」にしておくため */
  const ringReady = useSharedValue(0);
  useEffect(() => {
    ringReady.value = 1;
  }, [ringReady]);
  /** 1 = 指でカードを動かしている最中（成立してから離すまで） */
  const dragging = useSharedValue(0);
  /** このジェスチャが操作権を取ったか */
  const claimed = useSharedValue(0);
  /**
   * 着地フェード（参照 lk = 着地からの経過/800ms）。
   *
   * 2026-09-07 以降は常に 1。札の受け渡しは commitCarousel が
   * 「絵柄の差し替えと原点の送りを同じ React のコミットでやる」ことで
   * 継ぎ目なく済ませており、中央スロットを暗転させる必要がなくなった。
   * 購入演出など別の用途で使う余地を残して値だけ置いてある。
   */
  const landFade = useSharedValue(1);
  /** 0..1 のカードの押し込み量（参照 state.press） */
  const cardPress = useSharedValue(0);

  // ── アイドルフロート（v99-tsubasa）──────────────────────────
  // 参照は dragging / carouselActive / 裏返し中(aProg>0.02) で 0 へ収束させる。
  const scrolling = useSharedValue(0);
  const damp = useDerivedValue<number>(() => {
    const aProg = Math.abs(cardRotation.value) / 180;
    // 参照は dragging だけでなく carouselActive（送り/戻りアニメ中）でも止める。
    // 滑っている最中に上下へ浮くと、動きが二重になって落ち着かない。
    return scrolling.value > 0.5 || carBusy.value > 0.5 || aProg > 0.02 ? 0 : 1;
  }, [scrolling, carBusy, cardRotation]);
  // カードを出さないビルドではフロートの消費者が居ないので、フレームコールバックごと止める
  const floatY = useIdleFloat(damp, !DEBUG_BACKDROP_ONLY);
  // 接地影は床に留めたまま、フロートと逆相で反応させる（lift = floatY/3.0）
  const lift = useDerivedValue(() => floatY.value / 3.0, [floatY]);
  // 参照 690行: ground.opacity = 0.78 * slideFade * fore
  //   fore      = |cos(回転角)| … 裏返り中は接地影を弱める
  //   slideFade = カード本体と同じ横スワイプのフェード
  // カードは中央スロットの opacity でフェードするが、接地影はスロットの外側
  // （全画面レイヤー）にあるので、同じ係数をここで掛けないと影だけ残る。
  //
  // ★ 回転が始まったら 0 を返して「固定」する。参照は 3D ビューを開くとき
  //   接地影を visibility:hidden にして、回転中は一切さわらない（704/1891行）。
  //   RN Skia は Canvas 単位でしか再描画できないので、値が毎フレーム変わると
  //   全画面 Canvas が clear + ガウシアン込みで塗り直される。値が変わらなければ
  //   mapper ごと止まり、再描画がゼロになる。
  //
  // ★ 接地影は「いま中央にいちばん近い札」の影として、位置も濃さも UI スレッド
  //   だけで決める（2026-09-22）。以前は baseShift（React の state）基準で、送った
  //   札が止まってから React の再描画が済むまで影が消えたまま、済んだ瞬間に
  //   フェードなしで出ていた。その遅れは JS の混み具合で 1〜22 フレーム
  //   （実機収録で最大約 0.5 秒）ばらつき、止まったあとに影がポンと出て見えた。
  //   いまは dragX 自体が「中央からのズレ」なので、そのまま使えば札の受け渡しと
  //   無関係に、いつでも中央にいちばん近い札の足元に付く。
  const groundX = useDerivedValue(() => {
    const d = dragX.value;
    return d - Math.round(d / carFade) * carFade;
  }, [dragX, carFade]);
  const groundFade = useDerivedValue(() => {
    if (Math.abs(cardRotation.value) > GROUND_HIDE_DEG) return 0;
    const fore = Math.abs(Math.cos((cardRotation.value * Math.PI) / 180));
    // 隣の札との中間（step/2）で 0 になり、来る札に付いて戻ってくる
    const slide = Math.min(
      Math.max(0, 1 - Math.abs(groundX.value) / (carFade / 2)),
      landFade.value,
    );
    return fore * slide;
  }, [cardRotation, groundX, landFade, carFade]);

  // 回転中（＝表を向いていない）かどうか。true の間は背景の時計を止める。
  // 参照の星と天の川は CSS コンポジタで回るのでメインスレッド負荷が構造的に
  // ゼロだが、Skia は全画面 Canvas の再ラスタライズになる。同じ土俵に立つ
  // 唯一の方法が「回している間は止める」。
  // 止める条件は「カードが動いている間」全部。以前は回転（cardRotation）だけを
  // 見ていたので、曲送りの横スワイプでは止まらなかった。あちらは cardRotation が
  // 0 のままなので判定に引っかからず、179本の derived と全画面 Skia 2枚が
  // 回り続けたうえに、指追従ぶんの仕事が上乗せされていた。
  //
  // carBusy を使うのは scrolling より正確だから。scrolling はジェスチャの onBegin
  // ＝指が触れた瞬間に立つので、フリップ目的のタップでも一瞬 pause がトグルする。
  // carBusy は「カードが原点から横にずれている／寄せている／受け渡し待ち」の間だけ立つ。
  //
  // React の state にはしない（2026-09-22）。state だとスワイプの始まりと終わりの
  // たびにホーム全体が再描画されていた。値のまま BackdropSky へ渡し、時計の
  // 止め・再開は BackdropSky の中だけで切り替える。
  const skyPaused = useDerivedValue(
    () => Math.abs(cardRotation.value) > SPIN_PAUSE_DEG || carBusy.value > 0.5,
  );

  // ── 調律陣は「裏返している間」だけ止める ───────────────────────
  //
  // 2026-09-07 岡さん指摘。横スワイプ中は星も天の川もカードも動いているのに、
  // 調律陣だけ paused で時計ごと止まり、呼吸も走る光点もスパークも凍っていた。
  // 画面で唯一まったく生きていない層になるので、位置が同じでも「描き割り」に
  // 見え、星が手前にあるという読みを強めていた。
  //
  // 横スワイプ中は動かし続ける。裏返しの最中は
  //   ・カードの GL（3D・テクスチャ）が重い
  //   ・調律陣自体が sealDim で 0.32 まで沈むので、動いていても見えない
  // ので従来どおり止める。止める条件から曲送りぶん（offsetX / carBusy）だけを
  // 外した形で、発熱対策の効きどころは残している。
  const [cardFlipping, setCardFlipping] = useState(false);
  useAnimatedReaction(
    () => Math.abs(cardRotation.value) > SPIN_PAUSE_DEG,
    (now, prev) => {
      if (prev !== null && now !== prev) runOnJS(setCardFlipping)(now);
    },
    [],
  );

  // ── 待機中の星の流れ ──────────────────────────────────────
  // 時計は調律陣と同じ条件で止める（裏返している間・アプリが背面・視差を減らす設定）。
  // 横スワイプ中は止めない。裏面を開いている間は背景が幕で沈んでいるので、
  // 流れを止めても目に付かず、発熱対策の効きどころは残る。
  // 時計は動いていた時間だけを積むので、表へ戻したときに位置が飛ばない。
  const reduceMotion = useReducedMotion();
  const { clock: driftClock } = useBackdropClock(cardFlipping || reduceMotion);
  /** 近景の星が 1ms で流れる量(px) */
  const driftK = (screenW * DRIFT_R_PER_S) / 1000;
  /**
   * 星の平面の待機中の流れ(px・負＝左)。層ごとの速度比（遠 0.6 / 中 0.8 / 近 1.0）は
   * BackdropSky が掛ける。画面幅の余りへ畳んで Skia の transform で消費する。
   *
   * ★ 値が変わるのは DRIFT_STEP_MS ごと（10 回/秒）。
   *   この値は「明滅しない星」の Canvas（components/StaticStars.tsx・約 400 星＋
   *   調律陣の彫刻抜き）にも渡る。あちらは本来まったく塗り直されない前提の
   *   Canvas で、流れる値を 1 つ渡しただけで毎フレーム側へ落ちる（ファイル冒頭の
   *   警告どおり）。待機中の流れは毎秒 13px ほどなので、10 回/秒の刻みでも
   *   1 回あたり 1px 前後。見た目は流れたままで、塗り直しは 1/2 になる
   *   （2026-09-23 発熱の再発を受けて）。
   */
  const starDrift = useDerivedValue(() => {
    const t = Math.floor(driftClock.value / DRIFT_STEP_MS) * DRIFT_STEP_MS;
    return -t * driftK;
  }, [driftClock, driftK]);
  // 調律陣は固定（2026-09-15）。StarSeal の shiftX / 星の彫刻抜きの occluderX は
  // 渡さない＝陣も抜き形も画面に固定され、陣を外周まで広げて焼く処理も走らない。
  // 試聴プレイヤー（30秒・公開URL）
  const preview = useAudioPlayer();

  // カード裏面の刻印データ。renderItem 内でオブジェクトリテラルを組むと
  // 再レンダーのたびに参照が変わり、CardGL 内の裏面テクスチャ生成 useEffect
  // （依存に backData を持つ）が毎回走ってしまう。刻印は 1024×1536 の Skia
  // サーフェスを同期生成するため、タップ直後にこれが挟まると数十〜百ms級の
  // ヒッチになり、フリップ演出のフレームを丸ごと食う。曲一覧が変わらない限り
  // 同じ参照を返して再生成を止める。
  const onRootLayout = (e: LayoutChangeEvent) => setSlideH(e.nativeEvent.layout.height);

  // ── 試聴の鳴らし方（2026-09-23 改訂）────────────────────────────
  //
  // 以前は「札が入れ替わった瞬間に前の曲をぶつ切りで止めて、次の曲をすぐ鳴らす」
  // だった。連続で送ると鳴っては切れを繰り返し、作品の第一印象がいちばん荒い
  // ところで聞こえていた（代表指摘）。
  //
  //   ・スワイプを始めた時点で、短くフェードして止める（下の hushPreview。
  //     ジェスチャの onStart から呼ぶ）
  //   ・鳴らし始めるのはカードが止まってから PREVIEW_START_MS 後
  //
  // タイマーの中で使う値は ref から読む。タイマーを仕掛けたときの値で固まると、
  // 待っている間に札が変わったときに前の曲を鳴らしてしまう。
  // ※フェードインは音源ファイル側で定義する方針のため、アプリ側では行わない。
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const playingRef = useRef<string | null>(null);
  playingRef.current = playingId;
  /** true = カードが動いている（鳴らし直しは止まってから） */
  const cardMovingRef = useRef(false);

  const cancelPreviewTimers = useCallback(() => {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
    if (fadeTimer.current) {
      clearInterval(fadeTimer.current);
      fadeTimer.current = null;
    }
  }, []);

  /** いま鳴っている試聴を止める（fade=true なら短くフェードしてから） */
  const stopPreview = useCallback(
    (fade: boolean) => {
      cancelPreviewTimers();
      if (!fade || !playingRef.current) {
        try {
          preview.pause();
          preview.volume = 1;
        } catch {}
        playingRef.current = null;
        setPlayingId(null);
        return;
      }
      let v = 1;
      fadeTimer.current = setInterval(() => {
        v -= PREVIEW_FADE_STEP_MS / PREVIEW_FADE_MS;
        try {
          if (v <= 0) {
            if (fadeTimer.current) clearInterval(fadeTimer.current);
            fadeTimer.current = null;
            preview.pause();
            preview.volume = 1;
            playingRef.current = null;
            setPlayingId(null);
            return;
          }
          preview.volume = v;
        } catch {
          if (fadeTimer.current) clearInterval(fadeTimer.current);
          fadeTimer.current = null;
        }
      }, PREVIEW_FADE_STEP_MS);
    },
    [preview, cancelPreviewTimers],
  );

  /** スワイプを始めた合図（ジェスチャの onStart から runOnJS で呼ぶ） */
  const hushPreview = useCallback(() => {
    cardMovingRef.current = true;
    if (!playingRef.current && !previewTimer.current) return;
    stopPreview(true);
  }, [stopPreview]);

  /** カードが止まったあと、少し置いてから試聴を鳴らす */
  const schedulePreview = useCallback(() => {
    cancelPreviewTimers();
    previewTimer.current = setTimeout(() => {
      previewTimer.current = null;
      // プレイリストが鳴っている間は自動で試聴しない
      if (pbRef.current?.isPlayingNow()) return;
      const t = shownRef.current;
      const url =
        t && !isOwnedRef.current(t) && previewEnabledRef.current
          ? t.previewUrl ?? previewUrl(t.audioKey)
          : null;
      if (!t || !url) {
        stopPreview(false);
        return;
      }
      try {
        // 鳴り始めは 0.4 秒でフェードイン（2026-09-24）。音源は 30 秒の素材を
        // そのまま上げればよく、頭にフェードを作り込まなくてよい。
        preview.volume = 0;
        preview.replace({ uri: url });
        preview.play();
      } catch {}
      let v = 0;
      fadeTimer.current = setInterval(() => {
        v += PREVIEW_FADE_STEP_MS / PREVIEW_FADE_IN_MS;
        try {
          preview.volume = Math.min(1, v);
        } catch {}
        if (v >= 1 && fadeTimer.current) {
          clearInterval(fadeTimer.current);
          fadeTimer.current = null;
        }
      }, PREVIEW_FADE_STEP_MS);
      playingRef.current = t.id;
      setPlayingId(t.id);
    }, PREVIEW_START_MS);
  }, [preview, cancelPreviewTimers, stopPreview]);

  /** カードが止まった（または送るのをやめた）ときに鳴らし直す */
  const resumePreview = useCallback(() => {
    cardMovingRef.current = false;
    schedulePreview();
  }, [schedulePreview]);

  // 曲が変わった／スピーカーを切り替えたときの入口。鳴らす場合だけ間を置く。
  // カードが動いている間は仕掛けない（止まった時点で resumePreview が仕掛ける）。
  useEffect(() => {
    const t = shownRef.current;
    const url =
      t && !isOwnedRef.current(t) && previewEnabled
        ? t.previewUrl ?? previewUrl(t.audioKey)
        : null;
    if (!url) {
      stopPreview(false);
      return;
    }
    if (cardMovingRef.current) return;
    schedulePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chromePos, shown?.id, shown?.previewUrl, shown?.audioKey, previewEnabled]);

  // 画面を離れるときにタイマーを落とす
  useEffect(() => cancelPreviewTimers, [cancelPreviewTimers]);

  // ── アプリ全体の再生（プレイリスト）との調整（0.2.0 第 2 段階）──
  //   ・プレイリストが鳴っている間は、止まったカードでも試聴を自動で始めない
  //   ・右上の EQ を押したときだけ、プレイリストを一時停止して試聴する
  //   ・プレイリストが鳴り始めるときは、鳴っている試聴を短くフェードして止める
  const pb = usePlaybackOptional();
  const pbRef = useRef(pb);
  pbRef.current = pb;
  const onPbWillPlay = pb?.onWillPlay;
  useEffect(() => {
    if (!onPbWillPlay) return;
    return onPbWillPlay(() => {
      if (playingRef.current || previewTimer.current) stopPreview(true);
    });
  }, [onPbWillPlay, stopPreview]);

  // ── カルーセルの駆動（参照 stepCarousel / applyCarousel）──────────
  // 寄せは指を離した瞬間に UI スレッドで始める（onEnd の withTiming）。JS を待つのは
  // 札の受け渡し（下の commitCarousel）だけで、その間も次のスワイプを受け付ける。

  /**
   * 寄せ終わった位置で札を受け渡す（JS）。
   *
   * ここがカードの受け渡しの要。**通し番号(pos)を送る**と、各スロットに載る絵が
   * 1 つずつ内側へずれる。同時に dragX を送ったぶんだけ 0 へ戻すので、画面の絵は
   * 前後でまったく同じ＝継ぎ目が出ない。
   *
   *   直前: 中央＝古い札(dragX=-STEP の位置)／右隣＝新しい札(ちょうど画面中央)
   *   直後: 中央＝新しい札(dragX=0 の位置＝画面中央)／右隣＝その次の札
   *
   * dragX には触らない。打ち消し(shiftPx)が pos と同じコミットで増えるので、
   * 位置は勝手に揃う。UI スレッドへ書くのは committedSV（寄せ先の基準）だけで、
   * これは見た目に出ないので、届くのが 1 フレーム前後しても画面は壊れない。
   *
   * なお React が再レンダーすると、Reanimated は Animated.View の transform を
   * マウント時の値（dragX 0 ＋ shiftPx 0 ＝ 画面中央）へ 1 フレームだけ書き戻す。
   * 受け渡し後の正しい位置がまさにそれなので、この書き戻しは画面を壊さない。
   */
  const commitCarousel = useCallback(
    (target: number) => {
      // 寄せ先から通し番号を直に決める（差分を足し込まないので取り違えない）
      const next = posAtMountRef.current + Math.round(-target / carGeo.step);
      // committedSV（CardGL の位置の基準）はここでは送らない。CardGL が新しい絵を
      // 出し終えてから revealGL が glOn と一緒に送る。
      if (next === posRef.current) return;
      posRef.current = next;
      // 参照 ORDER は循環（端で止まらない）。番号を送るだけで、隣の札の絵も
      // 打ち消し(shiftPx)も同じコミットで一緒に動く。
      setPos(next);
      // 指を離した時点で先に進めてあるが、寄せの途中で掴み直された場合など、
      // 予測と食い違ったまま終わることがある。着いた先で合わせる。
      // ただし次のスワイプがもう行き先を見込んでいるときは触らない
      // （受け渡しが 1 枚遅れているだけで、曲名を戻してはいけない）。
      if (aimRef.current === posRef.current) setChromePos(posRef.current);
      setFlipped(false);
      // 旧カードの回転角が残ると落影・接地影が戻らないのでリセット
      cardRotation.value = 0;
      // 購入の呼吸が途中でも、曲が変わったら消す（次のカードへ持ち越さない）
      cardGlow.value = 0;
    },
    [carGeo, posRef, posAtMountRef, aimRef, cardRotation, cardGlow],
  );

  /**
   * 指を離した時点で、曲名・ボタン・試聴の指す札を行き先へ進める（JS）。
   * カード本体（pos）は寄せ終わってから進むので、滑っている 0.5 秒弱だけ
   * 両者がずれる。ずれている間に押したボタンは、必ず行き先の曲に効く。
   */
  const aimChrome = useCallback(
    (target: number) => {
      const next = posAtMountRef.current + Math.round(-target / carGeo.step);
      aimRef.current = next;
      setChromePos(next);
    },
    [carGeo, posAtMountRef, aimRef],
  );

  /**
   * CardGL がいま表に出している絵（CardGL の onFrontShown から）。
   * これが受け渡し済みの曲の絵と一致したら、中央を CardGL に戻してよい。
   */
  const glShownRef = useRef<string | null>(null);
  const activeUriRef = useRef<string | undefined>(undefined);
  activeUriRef.current = active?.artworkUrl;
  const revealRaf = useRef(0);

  /**
   * 中央を CardGL に戻す（glOn = 1）。条件がそろっているときだけ。
   *   ・CardGL が受け渡し済みの曲の絵を出し終えている
   *   ・カードが止まっている（UI スレッドで確かめる）
   * 2 フレーム待つのは、輪の札の「どれが中央か」（pos に依存するスタイル）の
   * 更新が UI スレッドへ届くのを待つため。届く前に反転すると、1 フレームだけ
   * 中央を二重に描く（絵は同じなので影が濃くなるだけだが、避ける）。
   */
  const revealFallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 受け渡し済みの札の静止位置（dragX の空間） */
  const restXOf = useCallback(
    () => -(posRef.current - posAtMountRef.current) * carGeo.step,
    [posRef, posAtMountRef, carGeo],
  );
  // 条件がそろわず見送ったときの再試行（2026-09-24）。
  // 以前は 1 回見送るとそれきりで、次に曲を送るまで中央は輪の札（平らな絵）の
  // ままだった。起動直後の最初のカードで起きやすく、その状態で裏返すと、
  // 平らな表の絵が手前に残ったまま、後ろで 3D の裏面だけが回って見えた。
  // 0.2.0 で全作品の絵を起動時に先読みするようにしてから、最初の絵の
  // 「出し終えた」が早く届き、まだ落ち着いていない間に当たりやすくなった。
  const revealRetry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTries = useRef(0);
  const revealGLRef = useRef<() => void>(() => {});
  const retryReveal = useCallback(() => {
    if (revealRetry.current) clearTimeout(revealRetry.current);
    if (revealTries.current >= 30) return; // 約 4.5 秒で諦める（送れば戻る）
    revealTries.current += 1;
    revealRetry.current = setTimeout(() => {
      revealRetry.current = null;
      revealGLRef.current();
    }, 150);
  }, []);
  const revealGL = useCallback(() => {
    if (!glShownRef.current || glShownRef.current !== activeUriRef.current) return;
    cancelAnimationFrame(revealRaf.current);
    revealRaf.current = requestAnimationFrame(() => {
      revealRaf.current = requestAnimationFrame(() => {
        if (glShownRef.current !== activeUriRef.current) return;
        if (revealFallback.current) {
          clearTimeout(revealFallback.current);
          revealFallback.current = null;
        }
        runOnUI((restX: number) => {
          'worklet';
          if (
            settleActive.value > 0.5 ||
            dragging.value > 0.5 ||
            Math.abs(dragX.value - restX) > 0.5
          ) {
            // まだ動いている。少し置いてもう一度確かめる
            runOnJS(retryReveal)();
            return;
          }
          // CardGL を中央へ送るのと、輪の中央の札を外すのを同じフレームで
          committedSV.value = restX;
          glOn.value = 1;
        })(restXOf());
      });
    });
  }, [settleActive, dragging, dragX, committedSV, glOn, restXOf, retryReveal]);
  revealGLRef.current = revealGL;

  /**
   * 逃げ道: CardGL が 0.5 秒たっても新しい絵を出せない（読み込みが遅い）ときは、
   * 位置の基準だけ先に送る。中央は輪の札が描いたままなので見た目は正しく、
   * 背景の時計やフロートも止まったままにならない。
   */
  const armRevealFallback = useCallback(() => {
    if (revealFallback.current) clearTimeout(revealFallback.current);
    revealFallback.current = setTimeout(() => {
      revealFallback.current = null;
      runOnUI((restX: number) => {
        'worklet';
        if (settleActive.value > 0.5 || dragging.value > 0.5) return;
        if (Math.abs(dragX.value - restX) > 0.5) return;
        committedSV.value = restX;
      })(restXOf());
    }, 500);
  }, [settleActive, dragging, dragX, committedSV, restXOf]);
  useEffect(
    () => () => {
      cancelAnimationFrame(revealRaf.current);
      if (revealFallback.current) clearTimeout(revealFallback.current);
      if (revealRetry.current) clearTimeout(revealRetry.current);
    },
    [],
  );

  const handleFrontShown = useCallback(
    (uri: string) => {
      glShownRef.current = uri;
      revealTries.current = 0;
      revealGL();
    },
    [revealGL],
  );
  // 受け渡しで曲が変わったとき、CardGL が先読み済みでもう出せていれば、ここで戻す
  useEffect(() => {
    revealTries.current = 0;
    revealGL();
  }, [active?.artworkUrl, revealGL]);

  /**
   * 寄せ終わったときにやること（JS）。札の受け渡しと、試聴の鳴らし直し。
   */
  const onSettled = useCallback(
    (target: number) => {
      commitCarousel(target);
      resumePreview();
      // 同じ札へ戻っただけのときは CardGL を隠していないので何も起きない
      revealGL();
      armRevealFallback();
    },
    [commitCarousel, resumePreview, revealGL, armRevealFallback],
  );

  /**
   * 指を離したあとの寄せ（UI スレッド）。onEnd と、受け渡しが寄せの最中に届いた
   * ときの引き直しの両方から呼ぶ。寄せ終わったら札を受け渡す。
   */
  const startSettle = useCallback(
    (target: number, duration: number) => {
      'worklet';
      settleTarget.value = target;
      settleActive.value = 1;
      dragX.value = withTiming(
        target,
        { duration, easing: CAR_SETTLE_EASE },
        (finished) => {
          'worklet';
          if (!finished) return; // 寄せの途中で次のスワイプに掴まれた
          settleActive.value = 0;
          // 別の札に着いた: CardGL はまだ前の曲なので、中央を輪の札に任せる。
          // 同じフレームで反転するので画面は変わらない（CardGL は 1 枚ぶん外にいる）。
          if (Math.abs(target - committedSV.value) > 0.5) glOn.value = 0;
          runOnJS(onSettled)(target);
        },
      );
    },
    [dragX, settleActive, settleTarget, committedSV, glOn, onSettled],
  );

  /**
   * 札の間隔(STEP)が変わったとき（画面の回転・サイズ変更）に、積み上がった位置を
   * 新しい間隔で取り直す。静止しているときだけでよい。
   */
  useEffect(() => {
    if (settleActive.value > 0.5 || scrolling.value > 0.5) return;
    const rest = -(posRef.current - posAtMountRef.current) * carGeo.step;
    dragX.value = rest;
    committedSV.value = rest;
  }, [carGeo.step, dragX, committedSV, settleActive, scrolling, posRef, posAtMountRef]);

  // ── ジェスチャ（参照 down/move/up = 722-728行）────────────────────
  //   ・6px 動くまで活性化しない＝タップは CardGL 側のフリップへ通る
  //   ・縦に CAR_FAIL_Y 先行したら失敗（参照の |ax|>=|ay| 軸判定を親指の弧ぶん緩めたもの）
  //   ・裏面では丸ごと無効（参照 aProg<0.5 の条件）。★の角は押しても沈めない
  const carouselGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!flipped)
        .activeOffsetX([-CAR_AXIS, CAR_AXIS])
        .failOffsetY([-CAR_FAIL_Y, CAR_FAIL_Y])
        .onBegin((e) => {
          'worklet';
          // 送りの最中・受け渡し待ちでも操作権を渡す（参照 down() はアニメ中の
          // タッチを無視するが、それだと連続スワイプが止まる）。
          // 裏返し中（|回転| >= 90°）は渡さない。裏面の指なぞりはカードを回して
          // 眺める操作なので、送りとは取り合わない（2026-09-24）。
          claimed.value = Math.abs(cardRotation.value) < 90 ? 1 : 0;
          if (!claimed.value) return;
          scrolling.value = 1;
          // 参照 2993行: card への pointerdown で pressTo=1。ステージ全面ではなく
          // カードの矩形に触れたときだけ沈める（周りの余白を押しても反応しない）。
          // 右下の角の★（FavBead）を押したときは沈めない。
          const onBead =
            Math.abs(e.x - (screenW / 2 + cardW / 2)) <= BEAD_HIT / 2 &&
            Math.abs(e.y - (cardCenterY + cardH / 2)) <= BEAD_HIT / 2;
          if (
            !onBead &&
            Math.abs(e.x - screenW / 2) <= cardW / 2 &&
            Math.abs(e.y - cardCenterY) <= cardH / 2
          ) {
            cardPress.value = withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) });
          }
        })
        .onStart((e) => {
          'worklet';
          if (!claimed.value) return;
          // 鳴っている試聴は、スワイプが成立したこの時点で短くフェードして止める。
          // 札が入れ替わるまで鳴らし続けると、連続で送ったときに鳴っては切れを
          // 繰り返して聞こえる（2026-09-23 代表指示）。
          runOnJS(hushPreview)();
          dragging.value = 1;
          // 走っている寄せはスワイプが成立したここで止める。onBegin で止めると、
          // 寄せの途中のタップ（成立しない）で札がその場に取り残される。
          const wasSettling = settleActive.value > 0.5;
          cancelAnimation(dragX);
          settleActive.value = 0;
          if (wasSettling) {
            // 動いている札を掴んだ: いまの位置から指に付ける（飛ばない）。
            // 寄せる基準は、その寄せの行き先（払った向きの続きとして数える）
            grabOrigin.value = settleTarget.value;
            gestureStart.value = dragX.value - e.translationX;
          } else {
            // 止まっている札: 最寄りの札の位置を基準に、指の移動量をそのまま足す
            // （参照 move() の 1:1。成立までの 6px もここで反映される）
            const s = carGeo.step;
            const b = committedSV.value;
            grabOrigin.value = b + Math.round((dragX.value - b) / s) * s;
            gestureStart.value = dragX.value;
          }
        })
        .onUpdate((e) => {
          'worklet';
          if (!claimed.value) return;
          // 参照 move(): 見た目の位置＝指の移動量そのまま（1:1・上限なし）
          dragX.value = gestureStart.value + e.translationX;
          // 参照 2995行: 7px 動いたら「押した」を取り消す
          if (
            Math.abs(e.translationX) > CARD_PRESS_SLOP ||
            Math.abs(e.translationY) > CARD_PRESS_SLOP
          ) {
            cardPress.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
          }
        })
        .onEnd((e) => {
          'worklet';
          dragging.value = 0;
          if (!claimed.value) return;
          const mag = Math.abs(e.translationX);
          const dir = e.translationX < 0 ? 1 : -1;
          // 参照は「押してから離すまでの総時間」で平均速度を出しており、
          // ゆっくり掴んでから素早く払うと成立しない欠陥がある。ここは
          // RNGH の瞬時速度を使い、しきい値 500px/s だけ参照に合わせる。
          const fast = Math.abs(e.velocityX) > CAR_VEL;
          const s = carGeo.step;
          let target = grabOrigin.value;
          // 1 曲だけのときは隣の札が無いので送らない（元の位置へ戻すだけ）。
          // 強く払っても 1 枚ずつ（2 枚送りは 2026-09-24 に外した）
          if (count > 1 && (mag >= carGeo.thresh || (fast && mag > carGeo.fastMin))) {
            target -= dir * s;
          }
          // 隣の札は ±2 枚まで描いてある。受け渡しがそれより遅れたら、そこで止める
          const b = committedSV.value;
          target = Math.min(b + 2 * s, Math.max(b - 2 * s, target));
          runOnJS(aimChrome)(target);
          startSettle(target, CAR_SETTLE_MS);
        })
        .onFinalize(() => {
          'worklet';
          scrolling.value = 0;
          claimed.value = 0;
          dragging.value = 0;
          // 参照 release(): pointerup / cancel / blur のいずれでも押し込みを戻す
          cardPress.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });
        }),
    [
      flipped,
      carGeo,
      claimed,
      dragging,
      committedSV,
      cardRotation,
      scrolling,
      settleActive,
      settleTarget,
      startSettle,
      aimChrome,
      hushPreview,
      count,
      dragX,
      gestureStart,
      grabOrigin,
      cardPress,
      screenW,
      cardW,
      cardH,
      cardCenterY,
    ],
  );

  // ── スロットの見た目（参照 applyCarousel 710-718行）──────────────
  //
  // ★ 札の並び（中央・±1・±2）は **素の style の固定値**、横のズレ(dragX)は
  //   カード層をまるごと包む 1 枚の animated だけが持つ。
  //
  //   なぜこう分けるか: 素の style は絵柄と同じ経路（UIManager のコミット）で
  //   ネイティブへ届くので、どのスロットに何が載るかと、その位置が **必ず同じ
  //   フレーム**で入れ替わる。もう一方の animated は静止時つねに 0 なので、
  //   Reanimated が再レンダーのたびにマウント時の値を書き戻しても画面は動かない。
  //
  //   以前は animated 側に累積した絶対位置を載せていた。その書き戻しに当たった
  //   1 フレームだけカード層が累積ぶん（実機で 3 枚ぶん＝約 3048px）飛び、
  //   関係ない札が中央に出たり画面が空になっていた（2026-09-23 収録）。
  /**
   * 輪の札 i の位置と出し入れ（UI スレッドだけで決まる）。
   *
   *   c  = 中央にいる札の通し番号（小数）= posAtMount - dragX / STEP
   *   t  = この札が受け持つ通し番号 = c に最も近い「i と RING で合同な整数」
   *   位置 = (t - c) × STEP  … 中央から ±3.5 枚の範囲。越えたら反対側へ回る
   *
   * 回るのは中央から 3.5 枚ぶん離れた画面の外。絵柄（React）は受け渡しのときに
   * ringTracks で同じ t を使って決めるので、見えている札の絵柄と位置が
   * 食い違うことはない。
   *
   * 出し入れ:
   *   ・静止中、中央以外の札は外す（隣の札の落影が画面の縁に出ないように）
   *   ・中央の札は、CardGL が描いているあいだ外す（glOn）
   *   ・マウント時の値は「非表示」（ringReady = 0）。札は 1 枚ずつ memo して
   *     あり、再描画されるのは絵柄を差し替える画面外の札だけなので、書き戻されても
   *     画面外の札が 1 フレーム消えるだけで済む
   */
  const useRingSlotStyle = (i: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => {
      const st = carGeo.step;
      const c = posAtMount - dragX.value / st;
      const t = i + RING * Math.round((c - i) / RING);
      const rel = t - c;
      let op = ringReady.value;
      if (Math.abs(rel) > 0.5 && carBusy.value < 0.5) op = 0;
      if (t === pos && glOn.value > 0.5) op = 0;
      // 最後の砦: カードが傾き始めたら（＝裏返している）、3D カードが中央に
      // いるかぎり中央の札は外す。受け渡しが済んでいなくても、平らな表の絵が
      // 回っている 3D カードの手前に残ることはない
      if (
        t === pos &&
        Math.abs(cardRotation.value) > FAV_HIDE_DEG &&
        Math.abs(dragX.value - committedSV.value) < 0.5
      )
        op = 0;
      return { opacity: op, transform: [{ translateX: rel * st }] };
    }, [pos, carGeo.step, posAtMount]);
  const ring0 = useRingSlotStyle(0);
  const ring1 = useRingSlotStyle(1);
  const ring2 = useRingSlotStyle(2);
  const ring3 = useRingSlotStyle(3);
  const ring4 = useRingSlotStyle(4);
  const ring5 = useRingSlotStyle(5);
  const ring6 = useRingSlotStyle(6);
  const ringStyles = useMemo(
    () => [ring0, ring1, ring2, ring3, ring4, ring5, ring6],
    [ring0, ring1, ring2, ring3, ring4, ring5, ring6],
  );
  /**
   * 3D カードの位置。受け渡し済みの札の位置（committedSV）に付いて動くので、
   * 送っている最中は輪の札と一緒に滑って出ていく（裏面から払ったとき、
   * 表へ戻りながら滑っていくのが見える）。
   * 不透明度は持たない。マウント時の値（dragX 0 − committedSV 0 = 中央）は
   * 静止時の正しい位置と常に一致するので、書き戻されても困らない。
   */
  const glStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value - committedSV.value }],
  }));
  const centerStyle = useAnimatedStyle(() => ({
    // 参照の slideFade（消えていくフェード）は掛けない。中央が空く時間を作らない
    // ためで、札は消えずにそのまま画面外へ滑って出ていく。
    opacity: landFade.value,
    // 購入演出の持ち上げ(cardTranslateY)・拡大(cardScale)もここへ合成する。
    // style 配列を足すと transform ごと後勝ちで置き換わるため、1本にまとめる。
    // 横位置は持たない（外側の glStyle が持つ）。
    transform: [
      { translateY: floatY.value + cardTranslateY.value },
      // 参照 2999行: scale(1 - press*.035)。購入演出の cardScale へ乗算で合成する
      { scale: cardScale.value * (1 - cardPress.value * CARD_PRESS_SCALE) },
    ],
  }));
  /**
   * ★（カードの右下の角のお気に入り）の層。カード層の中には入れず、隣に置いて
   * 同じ値で動かす（2026-09-24）。カード層の中に入れると、★を押すたびに
   * カード層（cardLayer の useMemo）が作り直され、スワイプ中にカードが
   * 一瞬静止位置へ戻る（上の cardLayer の注意を参照）。
   *
   * 位置: カード本体と同じ横ズレ（dragX - committedSV）・浮遊・押し込みの縮み。
   * 層はカードと同じ中心の全面なので、縮みの中心もカードの中心に揃う。
   * 出し入れ: 止まっていて、表を向いているときだけ出す（160ms で出入り）。
   * 受け渡しの間（CardGL が新しい絵を出すまで）は carBusy が立っているので出ない。
   */
  const favVis = useSharedValue(1);
  useAnimatedReaction(
    () => (carBusy.value < 0.5 && Math.abs(cardRotation.value) < FAV_HIDE_DEG ? 1 : 0),
    (now, prev) => {
      if (now !== prev) favVis.value = withTiming(now, { duration: 160 });
    },
  );
  // 裏面の右上の音の ON/OFF（★と同じくカード層の外に置き、同じ値で動かす）
  const spkVis = useSharedValue(0);
  useAnimatedReaction(
    () => (Math.abs(cardRotation.value) > SPK_SHOW_DEG ? 1 : 0),
    (now, prev) => {
      if (now !== prev) spkVis.value = withTiming(now, { duration: now ? 180 : 90 });
    },
  );
  const spkLayerStyle = useAnimatedStyle(() => ({
    opacity: spkVis.value,
    transform: [
      { translateY: floatY.value + cardTranslateY.value },
      { scale: cardScale.value },
    ],
  }));
  const favLayerStyle = useAnimatedStyle(() => ({
    opacity: favVis.value,
    transform: [
      { translateX: dragX.value - committedSV.value },
      { translateY: floatY.value + cardTranslateY.value },
      { scale: cardScale.value * (1 - cardPress.value * CARD_PRESS_SCALE) },
    ],
  }));
  /**
   * 輪の札 i の絵柄。位置（useRingSlotStyle）と同じ式で「受け持つ通し番号」を
   * 決める。中心は受け渡し済みの pos。pos が 1 進むと、絵柄が変わるのは
   * 中央から 3〜4 枚ぶん離れた 1 枚だけ（画面の外）。
   */
  const ringTracks = Array.from({ length: RING }, (_, i) =>
    trackAt(i + RING * Math.round((pos - i) / RING)),
  );

  // 中央の 3D カードへ、隣の札の絵も先に渡しておく。CardGL 側が不透明度 0 で
  // 重ねて読み込んでおくので、着地したあと CardGL が新しい絵を出すまでが短い。
  // （出すまでの間は輪の札が中央を描いているので、待ちは画面に出ない）
  const prevUri = trackAt(pos - 1)?.artworkUrl;
  const nextUri = trackAt(pos + 1)?.artworkUrl;
  const prev2Uri = trackAt(pos - 2)?.artworkUrl;
  const next2Uri = trackAt(pos + 2)?.artworkUrl;
  const peekUris = useMemo(
    () =>
      count > 1
        ? ([prevUri, nextUri, prev2Uri, next2Uri].filter(Boolean) as string[])
        : [],
    [count, prevUri, nextUri, prev2Uri, next2Uri],
  );
  // 輪の絵柄の並び（memo の比較用に文字列 1 本へ）
  const ringKey = ringTracks.map((t) => t?.artworkUrl ?? '').join('|');

  // 裏面の刻印テクスチャ（1024x1536）は backData が変わるたび同期生成される。
  // インラインのオブジェクトリテラルだと再レンダーのたびに別物と見なされ、
  // フリップのたびに 6MB のラスタライズで JS が止まり、その直後の 1 フレームで
  // カードが一気に回っていた。曲が変わったときだけ作り直す。
  const backData = useMemo(
    () =>
      active
        ? {
            title: active.title,
            serial: active.back?.serial,
            story: active.back?.story ?? active.subtitle,
            materials: active.back?.materials,
            tuning: active.back?.tuning,
            frequencies: active.back?.frequencies,
            artist: active.back?.artist,
            useCases: active.back?.useCases,
          }
        : undefined,
    [active],
  );

  // スピーカーボタン。アプリ全体で一貫させるため、この曲だけでなく
  // 以降の曲送りにも及ぶ「試聴オン/オフ」を切り替えるだけにする
  // （実際の再生・停止は上の effect が previewEnabled を見て行う）。
  const togglePreview = useCallback(() => {
    if (!shown) return;
    // プレイリストが鳴っているときの EQ は「このカードを試聴する」。プレイリストを
    // 一時停止して、試聴をオンにしたうえでこのカードを鳴らす
    const engine = pbRef.current;
    if (engine?.isPlayingNow()) {
      engine.pause();
      setPreviewEnabled(true);
      schedulePreview();
      return;
    }
    setPreviewEnabled((prev) => !prev);
  }, [shown, schedulePreview]);

  const toggleWishlist = useCallback(
    (id: string) => {
      if (onToggleWishlist) {
        onToggleWishlist(id);
        return;
      }
      setLocalWishlist((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    },
    [onToggleWishlist],
  );

  // 所有判定。pendingReveal に居る間は「まだ所有していない」ように見せる（演出の順序のため）
  previewEnabledRef.current = previewEnabled;
  const isOwned = useCallback(
    (track?: Track | null) => {
      if (!track) return false;
      if (pendingReveal.has(track.id)) return false;
      return track.owned === true || ownedIds?.has(track.id) === true;
    },
    [ownedIds, pendingReveal],
  );
  isOwnedRef.current = isOwned;

  // 「購入する」押下 → まず購入確認ポップアップを開く（所有済みは再生画面へ）
  // 曲名・ボタンと同じ札（shown）を買う。カード本体（active）はまだ滑っている
  // ことがあるので、押したボタンの曲と食い違わないほうを採る。
  const handleBuy = useCallback(() => {
    if (!shown) return;
    if (isOwned(shown)) {
      onPlay?.(shown.id);
      return;
    }
    purchase?.dismiss(); // 前回の失敗表示を持ち越さない
    setPurchaseTarget(shown);
  }, [shown, isOwned, purchase, onPlay]);

  // ポップアップの金額 or 確定ボタン → OS の課金シートへ。
  // ここでは所有状態も演出も動かさない。成立したかどうかは purchase.onSuccess で受ける
  // （requestPurchase の戻り値は結果ではないため）。
  const confirmPurchase = useCallback(() => {
    const target = purchaseTarget;
    if (!target) return;
    setPlayingId(null);
    purchase?.start(target.id, target.priceJpy);
  }, [purchaseTarget, purchase]);

  // モーダルを閉じる（キャンセル／閉じる／暗幕タップ）。所有状態は変えない
  const closePurchase = useCallback(() => {
    setPurchaseTarget(null);
    purchase?.dismiss();
  }, [purchase]);

  // ── 購入成立後の順序 ──
  // (1) モーダルを fade out → (2) PURCHASE.sheetSettleMs 待つ（Modal の消え際と
  // OS 課金シートの dismiss に演出を重ねない）→ (3) 光粒子をマウント＋カード発光/浮遊を
  // トリガー → (4) PURCHASE.ownedRevealDelayMs 後に所有済み化して購入ボタンを「再生」へ →
  // (5) onDone で光粒子をアンマウント、画面遷移はしない（ホームに留まる）。
  //
  // PurchaseTransition（拡大＋星点火＋トランスポート）はここでは使わない。
  // ホームの完了演出は PurchaseParticles＋カード自身の発光を正とする（元のカード位置
  // で光粒子が舞い上がり、カード自身がふわっと発光・浮遊する。複製カードは出さない
  // 方針を維持するため）。発光は CardGL の purchaseGlow（枠＋外周グロー）で描く。PurchaseTransition は ComponentGallery の部品デモとして据え置き。
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onBuyRef = useRef(onBuy);
  onBuyRef.current = onBuy;

  useEffect(() => {
    if (!purchase) return;
    return purchase.onSuccess((trackId) => {
      const bought = tracks.find((tr) => tr.id === trackId);
      setPurchaseTarget(null);
      setPlayingId(null);
      setPendingReveal((prev) => new Set(prev).add(trackId));
      if (bought) onBuyRef.current?.(bought);

      timersRef.current.push(
        setTimeout(() => {
          setShowPurchaseFx(true);
          triggerCardGlow();
          timersRef.current.push(
            setTimeout(() => {
              setPendingReveal((prev) => {
                const next = new Set(prev);
                next.delete(trackId);
                return next;
              });
            }, PURCHASE.ownedRevealDelayMs),
          );
        }, PURCHASE.sheetSettleMs),
      );
    });
  }, [purchase, tracks, triggerCardGlow]);

  // アンマウント時に演出タイマーを止める（解放後の setState を防ぐ）
  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    },
    [],
  );

  /**
   * カード層。**絵が変わったときだけ**作り直す。
   *
   * Reanimated の Animated.View は再レンダーのたびにマウント時の値をネイティブへ
   * 書き戻すので、試聴の状態など関係ない state で作り直すと、スワイプの最中に
   * 1 フレームだけカードが静止位置へ戻ってしまう。ここを切り離しておけば、
   * 札の絵が変わらないかぎり React はこの木に触れない（2026-09-23）。
   */
  const cardLayer = useMemo(
    () => (
      <View style={styles.slot} pointerEvents="box-none">
        {/* アクティブ面: v98準拠の実3Dカード（角丸・厚み・オーラ）。
            表面=角丸の作品画像＋タップで180°横回転して裏返し / 裏面=
            アルミ刻印面（再生画面と同一デザイン）＋全方向回転。
            曲が変わってもカードは載せ替えず、テクスチャだけ差し替える
            （GL コンテキストの作り直しを避ける）。
            静止中だけ中央を受け持ち、送っている間は輪の札に任せる（glOn）。 */}
        <Animated.View style={[styles.slot, glStyle]} pointerEvents="box-none">
          <Animated.View style={[styles.slot, centerStyle]} pointerEvents="box-none">
            {active && (
              <CardGL
                mode="flip"
                backStyle="aluminum"
                frontUri={active.artworkUrl}
                preloadUris={peekUris}
                width={cardW}
                height={cardH}
                shadow
                frame={cardFrame}
                onFlipChange={setFlipped}
                onFrontShown={handleFrontShown}
                rotationOut={cardRotation}
                purchaseGlow={showPurchaseFx ? cardGlow : undefined}
                backData={backData}
                onArtistPress={
                  active.artistId && onOpenArtist
                    ? () => onOpenArtist(active.artistId!)
                    : undefined
                }
              />
            )}
          </Animated.View>
        </Animated.View>

        {/* 輪の札（7 枚）。CardGL より上に重ねる。位置も出し入れも UI スレッドで
            決まり、絵柄が差し替わるのは画面の外にいる札だけ。中央の札は、CardGL
            が新しい絵を出し終えるまでの間、CardGL を覆って中央を描く。 */}
        {ringTracks.map((t, i) =>
          t ? (
            <RingSlot
              key={i}
              style={ringStyles[i]}
              uri={t.artworkUrl}
              width={cardW}
              height={cardH}
            />
          ) : null,
        )}
      </View>
    ),
    // ringTracks は毎回作り直す配列なので、中身を表す ringKey で比べる
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ringKey,
      ringStyles,
      glStyle,
      peekUris,
      centerStyle,
      active,
      cardW,
      cardH,
      cardFrame,
      cardRotation,
      cardGlow,
      handleFrontShown,
      showPurchaseFx,
      backData,
      onOpenArtist,
    ],
  );

  // 光の粒: ★の位置（画面座標）→ この画面の座標へ直して、プレイリストタブへ飛ばす
  const rootRef = useRef<View>(null);
  const [fly, setFly] = useState<{ key: number; from: { x: number; y: number } } | null>(null);
  const handleBeadAdded = useCallback((from: { x: number; y: number }) => {
    const root = rootRef.current;
    if (!root) return;
    root.measureInWindow((rx, ry) => {
      setFly({ key: Date.now(), from: { x: from.x - rx, y: from.y - ry } });
    });
  }, []);
  // フッターの 2 番目のタブ（プレイリスト）の絵の中心。フッターは 5 等分・左右 8px・
  // 上 8px・絵 20px（components/Footer.tsx）。ホームではフッターがこの画面に重なる
  const flyTo = useMemo(
    () => ({ x: 8 + ((screenW - 16) * 1.5) / 5, y: slideH - bottomInset + 18 }),
    [screenW, slideH, bottomInset],
  );
  const finishFly = useCallback(() => {
    setFly(null);
    onWishAdded?.();
  }, [onWishAdded]);

  // ★はカード本体の曲（active）に付ける。shown は指を離した時点で先に変わるので使わない。
  // 購入済みの曲には出さない（試作の .owned）。
  const favTrack = active;
  const favOwned = favTrack ? isOwned(favTrack) : true;
  const favFilled = favTrack ? wishlist.has(favTrack.id) : false;
  const favId = favTrack?.id;
  const onToggleFav = useCallback(() => {
    if (favId) toggleWishlist(favId);
  }, [favId, toggleWishlist]);
  const favLayer = useMemo(
    () =>
      favId && !favOwned ? (
        <Animated.View
          style={[styles.slot, favLayerStyle]}
          pointerEvents={flipped ? 'none' : 'box-none'}
        >
          <View
            style={[
              styles.beadAt,
              {
                left: screenW / 2 + cardW / 2 - BEAD_HIT / 2,
                top: cardCenterY + cardH / 2 - BEAD_HIT / 2,
              },
            ]}
            pointerEvents="box-none"
          >
            <FavBead filled={favFilled} onToggle={onToggleFav} onAdded={handleBeadAdded} />
          </View>
        </Animated.View>
      ) : null,
    [favId, favOwned, favFilled, flipped, favLayerStyle, screenW, cardW, cardH, cardCenterY, onToggleFav, handleBeadAdded],
  );

  // 裏面の右上の音の ON/OFF。押すと試聴のオン・オフ（右上の EQ と同じ）。
  // 裏面の大きさと持ち上げは CardGL と同じ式（computeBackScale・枠高の 3%）で出す。
  // 購入済みの曲は試聴しないので出さない。
  const spkOwned = active ? isOwned(active) : true;
  const spkLayer = useMemo(() => {
    if (spkOwned) return null;
    const s = computeBackScale(cardFrame, cardW, cardH);
    const lift = cardFrame.height * 0.03;
    const cornerX = screenW / 2 + (cardW * s) / 2;
    const cornerY = cardCenterY - lift - (cardH * s) / 2;
    return (
      <Animated.View
        style={[styles.slot, spkLayerStyle]}
        pointerEvents={flipped ? 'box-none' : 'none'}
      >
        <Pressable
          onPress={togglePreview}
          style={[
            styles.beadAt,
            styles.spkHit,
            { left: cornerX - SPK_INSET - SPK_HIT / 2, top: cornerY + SPK_INSET - SPK_HIT / 2 },
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: previewEnabled }}
          accessibilityLabel={previewEnabled ? t('preview.toggleOff') : t('preview.toggleOn')}
        >
          {({ pressed }) => (
            <View style={[styles.spkDisc, pressed && { transform: [{ scale: 0.9 }] }]}>
              <SpeakerIcon size={16} on={previewEnabled} />
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  }, [spkOwned, cardFrame, cardW, cardH, screenW, cardCenterY, spkLayerStyle, flipped, togglePreview, previewEnabled, t]);

  // 起動時に全作品の絵を先読みしておく（スワイプ後に絵が遅れて出るのを防ぐ）
  useEffect(() => {
    tracks.forEach((t) => {
      if (t.artworkUrl) Image.prefetch(t.artworkUrl).catch(() => {});
    });
  }, [tracks]);

  const isPreviewing = playingId != null && playingId === shown?.id;

  return (
    <View ref={rootRef} style={styles.root} onLayout={onRootLayout}>
      <StatusBar barStyle="light-content" backgroundColor={C.page} />

      {/* 背景ブロック D の下半分（参照 z 順: bgbase → nebBand → bgstars）。
          旧 NebulaBand + StarField の 2 枚を 1 枚の Canvas へ統合。
          .bgaura は参照側が opacity:0!important の無効レイヤーなので移植しない。
          intro① : 最初に灯る層。ラッパは各層の React.memo を壊さないよう外側に置き、
          子へ渡す props は増やさない */}
      {slideH > 0 && (
        <RNAnimated.View
          style={[StyleSheet.absoluteFill, { opacity: intro.sky }]}
          pointerEvents="none"
        >
          <BackdropSky
            width={screenW}
            height={slideH}
            pausedSV={skyPaused}
            parallaxX={starDrift}
            occluder={sealInk}
            nebulaOffsetX={layerAdjust.nebula.offsetX}
            nebulaOffsetY={layerAdjust.nebula.offsetY}
            nebulaScale={layerAdjust.nebula.scale}
          />
        </RNAnimated.View>
      )}

      {/* 調律陣の背景（プレイヤーと同一・カード中心に配置）。
          intro② : わずかに小さい所から等倍へ、空に少し遅れて灯る */}
      {slideH > 0 && (
        <RNAnimated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: intro.seal, transform: [{ scale: sealScale }] },
          ]}
          pointerEvents="none"
        >
          {/* カードを開いているあいだは調律陣も沈める（参照 .ca-detail #frSeal*） */}
          <RNAnimated.View style={[StyleSheet.absoluteFill, { opacity: sealDim }]}>
            <StarSeal
              width={screenW}
              height={slideH}
              centerX={screenW / 2 + layerAdjust.seal.offsetX}
              centerY={cardCenterY + layerAdjust.seal.offsetY}
              cardWidth={cardW * layerAdjust.seal.scale}
              paused={cardFlipping}
              style={styles.sealLayer}
              onInkImage={handleSealInk}
            />
          </RNAnimated.View>
        </RNAnimated.View>
      )}

      {/* 背景ブロック D の上半分（減光・粒状感の3層 = bgvig + focus-dim + bggrain）。
          参照の z 順どおり調律陣より上・カードより下。
          旧・減光レイヤーと粒状感レイヤーの 2 枚を 1 枚の Canvas へ統合。
          減光・粒状は空の一部なので intro の進行度は① と共有する */}
      {slideH > 0 && (
        <RNAnimated.View
          style={[StyleSheet.absoluteFill, { opacity: intro.sky }]}
          pointerEvents="none"
        >
          <BackdropVeil width={screenW} height={slideH} />
        </RNAnimated.View>
      )}

      {/* 参照 .ca-veil。カードを開くと背景だけが沈む（カードより下に置く）。
          幕そのものは静的な Canvas で、濃さはこのラッパの opacity が持つ。 */}
      {slideH > 0 && !DEBUG_BACKDROP_ONLY && (
        <RNAnimated.View
          style={[StyleSheet.absoluteFill, { opacity: detail }]}
          pointerEvents="none"
        >
          <CardVeil width={screenW} height={slideH} />
        </RNAnimated.View>
      )}

      {/* intro③ : 接地影とカード層。下から昇らせるので、接地影も一緒に動かす
          （影だけ床に残ると浮遊が二重に見える）。カルーセルの transform は
          中央スロット側が持っているが、こちらはその外側のラッパなので衝突しない。
          GestureDetector の直下はネイティブ View のままにする（RNGH の要件）。 */}
      {slideH > 0 && !DEBUG_BACKDROP_ONLY && (
        <RNAnimated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: intro.card,
              // cardRise は起動 intro 専用（完了後は 0 に収束）。
              // homeCardOffsetY は運営調整用の静的な追加オフセット（設定→
              // ボタン位置調整のスライダー）で、translateY を2つ重ねるだけで
              // 単純に加算される。接地影（下の子）もこの Wrapper の中にいるので
              // カードと一緒にずれ、位置がずれても対応関係は崩れない。
              transform: [{ translateY: cardRise }, { translateY: layoutAdjust.homeCardOffsetY }],
            },
          ]}
          pointerEvents="box-none"
        >
          {/* 接地影（card-ground）。カードは floatY で浮くが影は床に留め、
              逆相で「浮くと薄く広く／沈むと濃く狭く」反応させる。
              横位置は groundX（中央にいちばん近い札）だけで決め、カード層の
              中には置かない（置くと札の受け渡しの瞬間に影が飛ぶ） */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <CardGround
              width={screenW}
              height={slideH}
              centerX={screenW / 2}
              centerY={cardCenterY}
              cardW={cardW}
              cardH={cardH}
              fade={groundFade}
              lift={lift}
              dragX={groundX}
              style={styles.sealLayer}
            />
          </View>

          {/* カード層（B ブロック）。参照 .stage は peekL / card / peekR の
              3 スロット固定で、カード自身が指へ 1:1 追従する（710-718行）。
              FlatList の paging では確定しきい値が画面幅の半分になってしまい、
              参照の 37.7px＋500px/s とは別物の操作感だった。 */}
          <GestureDetector gesture={carouselGesture}>
            <View style={[styles.stage, { height: contentH }]} pointerEvents="box-none">
              {/* カード層。横のズレ(dragX)を持つのはこの 1 枚だけで、中の札は
                  固定の位置に並べる（中央・±1・±2）。札を送るときは、中に載せる
                  絵を 1 つずつずらすのと同時に dragX を 0 へ戻す。 */}
              {cardLayer}
              {/* ★（カードの右下の角）。カード層の外に置き、同じ値で動かす */}
              {favLayer}
              {/* 裏面の右上の音の ON/OFF。裏返してほぼ正面を向いたときだけ出る */}
              {spkLayer}
            </View>
          </GestureDetector>
        </RNAnimated.View>
      )}

      {/* ── 固定クローム（shown に連動＝指を離した時点で切り替わる） ── */}
      <View
        style={[styles.chrome, DEBUG_BACKDROP_ONLY && styles.hidden]}
        pointerEvents={DEBUG_BACKDROP_ONLY ? 'none' : 'box-none'}
      >
        {/* intro④ : 上部クローム（曲名・右上アイコン）。上から少しだけ降りる */}
        <RNAnimated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: intro.top, transform: [{ translateY: topDrop }] },
          ]}
          pointerEvents="box-none"
        >
          {/* ※ 通知ベルは撤去済み（ホームの空を邪魔しないため）。通知一覧は
                 メディア画面の「あなた宛」タブへ統合した（screens/MediaScreen.tsx）。
              ※ 右上の試聴アイコン（スピーカー）は撤去済み。試聴のトグルはカード下部の
                 acts行（★／試聴／購入する）に一本化した（同じ togglePreview を使う）。
                 EQメーターだけは残す（タップ不要の演出のため pointerEvents="none"）。
                 top はタイトルと同じ高さ（topRightY + 5 + TITLE_CHAR_SIZE）に揃える。 */}
          <Pressable
            style={[styles.topRight, { top: topRightY + 5 + TITLE_CHAR_SIZE }]}
            hitSlop={14}
            onPress={togglePreview}
            accessibilityRole="button"
            accessibilityState={{ selected: previewEnabled }}
            accessibilityLabel={previewEnabled ? t('preview.toggleOff') : t('preview.toggleOn')}
          >
            {/* 試聴のオン・オフ（2026-09-24。下の試聴ボタンをここへ移した）。
                鳴っている間は棒が動き、止めている間は暗く止まる */}
            <EqBars active={isPreviewing} keepIdle dim={!previewEnabled} />
          </Pressable>

          {/* タイトル（1行のみ。eyeコピー・情景サブタイトルはモック確定値により非表示）。
              「1文字分下・1文字分内側へ」の指示により、title のフォントサイズ
              （TITLE_CHAR_SIZE=20）を1文字分の基準にして、旧位置（topRightY + 5 /
              left: 22）からそれぞれ+20した。 */}
          <RNAnimated.View
            style={[styles.texts, { top: topRightY + 5 + TITLE_CHAR_SIZE, opacity: titleFade }]}
            pointerEvents="none"
          >
            <Text style={styles.title} numberOfLines={1}>{shown?.title}</Text>
          </RNAnimated.View>
        </RNAnimated.View>

        {/* intro⑤ : 下部クローム（購入ボタン＋★）。最後に下から入る */}
        <RNAnimated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: intro.bottom,
              // bottomRise は起動 intro 専用。homeActsOffsetY は運営調整用の
              // 静的な追加オフセット（設定→ボタン位置調整のスライダー）。
              transform: [{ translateY: bottomRise }, { translateY: layoutAdjust.homeActsOffsetY }],
            },
          ]}
          pointerEvents="box-none"
        >
          {/* 下部: 購入ボタン「周回する光」だけ（2026-09-24 岡さんの試作を採用）。
              ★はカードの右下の角へ、試聴のオン・オフは右上の EQ へ移した。
              所有済みは「再生」（押すと再生画面）。裏返し中も位置は動かさない。 */}
          <View style={[styles.bottom, { bottom: BOTTOM_BASE }]} pointerEvents="box-none">
            <OrbitBuyButton
              owned={isOwned(shown)}
              priceLabel={shown ? purchase?.displayPriceOf(shown.id) : undefined}
              onPress={handleBuy}
            />
          </View>
        </RNAnimated.View>
      </View>

      {/* 購入の光粒子（画面下部から舞い上がる・複製カードは出さない） */}
      {showPurchaseFx && slideH > 0 && (
        <PurchaseParticles
          width={screenW}
          height={slideH}
          onDone={() => setShowPurchaseFx(false)}
        />
      )}

      {/* 購入確認ポップアップ。
          金額はストアのローカライズ価格（displayPrice）を正とし、未取得のときだけ
          pricing.ts の ¥2,500 にフォールバックする。track.priceLabel は
          buyLabel()（「購入する ¥2,500」）でボタン全体のラベルなので使わない。 */}
      <PurchaseModal
        visible={purchaseTarget != null}
        target={
          purchaseTarget
            ? {
                id: purchaseTarget.id,
                title: purchaseTarget.title,
                priceLabel:
                  purchase?.displayPriceOf(purchaseTarget.id) ?? formatPrice(TRACK_PRICE_JPY),
                artworkUrl: purchaseTarget.artworkUrl,
              }
            : null
        }
        state={purchase?.state ?? 'idle'}
        reason={purchase?.reason}
        onConfirm={confirmPurchase}
        onCancel={closePurchase}
      />

      {/* ★から飛ぶ光の粒（フッターより上に描く） */}
      {fly && <FlyDot key={fly.key} from={fly.from} to={flyTo} onDone={finishFly} />}
    </View>
  );
};

/**
 * 輪の札 1 枚。memo して、絵柄（uri）が変わったときだけ再描画する。
 * 動いている札・見えている札は再描画されないので、Reanimated の「マウント時の
 * 値への書き戻し」を受けるのは、絵柄を差し替える画面外の札だけになる。
 */
const RingSlot = React.memo(function RingSlot({
  style,
  uri,
  width,
  height,
}: {
  style: ReturnType<typeof useAnimatedStyle>;
  uri: string;
  width: number;
  height: number;
}) {
  return (
    <Animated.View style={[styles.slot, style]} pointerEvents="none">
      <CardFace uri={uri} width={width} height={height} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.page },
  /** 参照 .stage（position:absolute; inset:0）。3スロットの親 */
  stage: { position: 'absolute', left: 0, right: 0, top: 0 },
  beadAt: { position: 'absolute' },
  spkHit: { width: SPK_HIT, height: SPK_HIT, alignItems: 'center', justifyContent: 'center' },
  // ★（FavBead）と同じ濃紺の丸。アルミの明るい地の上でも見える
  spkDisc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(15,14,42,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(236,238,247,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 参照の card / peekL / peekR。中央基準で重ね、translateX で振り分ける */
  slot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealLayer: { position: 'absolute', top: 0, left: 0 },
  /** DEBUG_BACKDROP_ONLY 用。クロームを畳んで背景・調律陣だけを見る */
  hidden: { opacity: 0 },

  chrome: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // 右上のEQメーターのみ（試聴アイコンは撤去済み。カード下部のacts行に一本化）
  topRight: { position: 'absolute', top: 22, right: 20, alignItems: 'flex-end' },
  // height24・justifyContent:'center' は撤去済みの旧・右上アイコン列と高さを
  // 揃えていた名残り（フォント行送りの誤差を吸収するため維持）。
  // left は旧位置22pxから TITLE_CHAR_SIZE（1文字分）だけ内側へ寄せた。
  texts: { position: 'absolute', left: 22 + TITLE_CHAR_SIZE, right: 120, height: 24, justifyContent: 'center' },
  // .title: 18px / 字間.05em / text-shadow 0 1px 10px rgba(0,0,0,.5)
  title: {
    fontSize: 20,
    letterSpacing: 0.36, // fontSize×0.02
    color: C.text,
    fontFamily: JP_SERIF_FONT, // 和文＝明朝（ゴシックで出ていたのを修正）
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },

  // .bottom: 原本 bottom:calc(146px + 2vh)（フッター54px込みのデバイス基準）。
  // 本アプリはフッターを親が描くため、本体領域基準へ 54px 差し引いて 92px + 2vh。
  bottom: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },

  transport: {
    paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(96,206,224,0.18)',
    backgroundColor: 'rgba(23,20,48,0.92)', alignItems: 'center',
  },
  transportText: { color: C.text, fontSize: 13, letterSpacing: 0.3 },
  dismiss: {
    position: 'absolute', top: 52, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(58,61,114,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  dismissText: { color: C.sub, fontSize: 14 },
});

export default DiscoverScreen;
