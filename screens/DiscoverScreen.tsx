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
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useFrameCallback,
  runOnJS,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useIdleFloat } from '../lib/useIdleFloat';
import { useAudioPlayer } from 'expo-audio';
import { previewUrl } from '../lib/r2';
import { CardFace } from '../components/CardFace';
import { BackdropSky } from '../components/BackdropSky';
import { BackdropVeil } from '../components/BackdropVeil';
import { CardGround } from '../components/CardGround';
import { StarSeal } from '../components/StarSeal';
import {
  CardGL,
  CARD_ASPECT,
} from '../components/CardGL';
import { BuyButton } from '../components/BuyButton';
import { WishlistStar } from '../components/WishlistStar';
import { PurchaseModal } from '../components/PurchaseModal';
import { EqBars } from '../components/EqBars';
import { BellIcon, PreviewIcon } from '../components/icons';
import { useTopInset } from '../lib/safeArea';
import { PurchaseParticles } from '../components/PurchaseParticles';
import { PURCHASE, homeCardWidth } from '../constants/design-tokens';
import { formatPrice, TRACK_PRICE_JPY } from '../constants/pricing';
import { JP_SERIF_FONT } from '../constants/fonts';
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
const CAR_FADE_R = 0.55;     // 中央カードが消えきる距離（参照 CARDW*0.55）
const CAR_VEL = 500;         // フリック速度しきい値 px/s（参照 0.5px/ms）
const CAR_LERP = 0.22;       // 毎フレームの寄せ（参照 dragX += (target-dragX)*0.22）
const CAR_SETTLE = 0.8;      // 整定しきい値 px（参照 |dragX-carTarget| < 0.8）
const CAR_LAND_MS = 800;     // 着地フェード（参照 landT0 から 800ms）
const CAR_AXIS = 6;          // 軸判定＝タップ境界（参照 moved の 6px）
const CAR_DT_MAX = 0.05;     // 1フレームで進める上限（秒）

// カードが表からこれ以上傾いたら接地影を消して固定する（参照の hideEls 相当）
const GROUND_HIDE_DEG = 8;
// これ以上傾いている間は背景（天の川・星・調律陣の光点）の時計を止める
const SPIN_PAUSE_DEG = 2;

const C = {
  page: '#0E0C20',
  text: '#ECEEF7',
  sub: '#9498BE',
  badge: '#E0584E',
} as const;

export type Track = {
  id: string;
  title: string;
  subtitle?: string;        // 情景の言葉（効能は語らない）
  artistName: string;
  artworkUrl: string;
  audioKey: string;         // R2 音源キー（試聴は公開・フルは署名付き）
  previewUrl: string | null;
  priceLabel: string;
  owned?: boolean;
  glowColor?: string;
  glowColor2?: string;
  // 裏面（タップで表示する説明）
  back?: {
    serial?: string;         // 'No. 001'
    story?: string;          // 情景の言葉（裏面の本文）
    materials?: string[];    // 原材料（例: ['朝の空気', '低い持続音']）
    tuning?: string;         // 調律名（例: '純正律'）
    frequencies?: string[];  // 周波数のみ（例: ['432 Hz', '7.83 Hz']）
    artist?: string;         // 'NAOKI OKA'
  };
};

type Props = {
  tracks?: Track[];
  hasUnread?: boolean;
  onOpenNotifications?: () => void;
  /** 購入が**成立した**ときだけ呼ばれる（キャンセル・失敗では呼ばない） */
  onBuy?: (track: Track) => void;
  /** 起動時に最初に表示するカードの id（コレクションのウィッシュから飛んできたとき用） */
  focusTrackId?: string | null;
  /** 所有している trackId（App.tsx の usePurchaseFlow から。Firestore が正） */
  ownedIds?: Set<string>;
  /** 購入フロー。未指定なら購入ボタンは押しても何も起きない（ギャラリー表示用） */
  purchase?: PurchaseController;
  /** 所有済みカードの「再生」ボタン押下 → 再生画面を開く。未指定なら何も起きない */
  onPlay?: (trackId: string) => void;
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
  hasUnread = true,
  onOpenNotifications,
  onBuy,
  focusTrackId,
  ownedIds,
  purchase,
  onPlay,
}) => {
  // ウィッシュから飛んできたときは、その曲のカードを最初に表示する。
  const initialIndex = focusTrackId
    ? Math.max(0, tracks.findIndex((t) => t.id === focusTrackId))
    : 0;
  // 上部クローム（右上アイコン／タイトル）はセーフエリア下へ寄せる。
  // タイトルは右上アイコン列と同じ top（topRightY + 5）を使い、縦位置を揃える。
  const topRightY = useTopInset(8);
  const [slideH, setSlideH] = useState(0);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [flipped, setFlipped] = useState(false); // アクティブカードが裏面か（横スクロール可否用）
  // アクティブカードの表面からの回転角（度）。focus-dim（背景暗転）の駆動用
  const cardRotation = useSharedValue(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  // 購入の光粒子演出（元のカード位置から下部いっぱいに舞い上がる）
  const [showPurchaseFx, setShowPurchaseFx] = useState(false);
  // 購入確認ポップアップの対象（null=非表示）
  const [purchaseTarget, setPurchaseTarget] = useState<Track | null>(null);
  // 購入は成立したが、まだ「再生」表示に切り替えていない trackId。
  // 演出が立ち切る前にボタンが変わると、事後報告に見えるため一拍待たせる。
  const [pendingReveal, setPendingReveal] = useState<Set<string>>(new Set());

  const { width: screenW, height: screenH } = useWindowDimensions();
  const active = tracks[activeIndex] ?? tracks[0];
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
  const cardFrame = useMemo(() => ({ width: screenW, height: slideH }), [screenW, slideH]);

  // 購入ボタン／ウィッシュ星の位置は裏返し時も動かさず固定にする
  // （iPhone 16 で、裏面のカードが拡大されるのに合わせてボタンが下へスライドし、
  // ガタつくとの指摘のため）。裏面は computeBackScale で枠内に収まるよう
  // クランプ済みなので、固定位置のままでも大きくはみ出さない。
  const BOTTOM_BASE = 100 + slideH * 0.02;

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
      fade: cardW * CAR_FADE_R,
      // 参照 STEP = 190 + CARDW/2 + THRESH（隣カードとの中心間距離）。
      // 先頭の 190 は参照デバイス(380px幅)基準の実寸なので、カードと同じ
      // 倍率（cardW/188.59）でスケールする
      step: (190 + 188.59 / 2 + 188.59 * CAR_THRESH_R) * (cardW / 188.59),
    }),
    [cardW],
  );
  /** カードの横位置(px)。指に 1:1 で追従し、離すと 0 か ±STEP へ寄る */
  const dragX = useSharedValue(0);
  const carTarget = useSharedValue(0);
  /** 1 = 送り/戻りアニメ中。参照 down() はこの間の新規タッチを完全に無視する */
  const carBusy = useSharedValue(0);
  /** +1=次へ / -1=前へ / 0=戻すだけ */
  const pendingDir = useSharedValue(0);
  /** このジェスチャが操作権を取ったか（アニメ中に触られたら 0 のまま） */
  const claimed = useSharedValue(0);
  /** 着地フェード（参照 lk = 着地からの経過/800ms） */
  const landFade = useSharedValue(1);

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
  const groundFade = useDerivedValue(() => {
    if (Math.abs(cardRotation.value) > GROUND_HIDE_DEG) return 0;
    const fore = Math.abs(Math.cos((cardRotation.value * Math.PI) / 180));
    const slide = Math.min(
      Math.max(0, 1 - Math.abs(dragX.value) / carGeo.fade),
      landFade.value,
    );
    return fore * slide;
  }, [cardRotation, dragX, landFade, carGeo]);

  // 回転中（＝表を向いていない）かどうか。true の間は背景の時計を止める。
  // 参照の星と天の川は CSS コンポジタで回るのでメインスレッド負荷が構造的に
  // ゼロだが、Skia は全画面 Canvas の再ラスタライズになる。同じ土俵に立つ
  // 唯一の方法が「回している間は止める」。
  const [cardSpinning, setCardSpinning] = useState(false);
  useAnimatedReaction(
    () => Math.abs(cardRotation.value) > SPIN_PAUSE_DEG,
    (now, prev) => {
      if (prev !== null && now !== prev) runOnJS(setCardSpinning)(now);
    },
    [],
  );
  // 試聴プレイヤー（30秒・公開URL）
  const preview = useAudioPlayer();

  // カード裏面の刻印データ。renderItem 内でオブジェクトリテラルを組むと
  // 再レンダーのたびに参照が変わり、CardGL 内の裏面テクスチャ生成 useEffect
  // （依存に backData を持つ）が毎回走ってしまう。刻印は 1024×1536 の Skia
  // サーフェスを同期生成するため、タップ直後にこれが挟まると数十〜百ms級の
  // ヒッチになり、フリップ演出のフレームを丸ごと食う。曲一覧が変わらない限り
  // 同じ参照を返して再生成を止める。
  const onRootLayout = (e: LayoutChangeEvent) => setSlideH(e.nativeEvent.layout.height);

  // ── カルーセルの駆動（参照 stepCarousel / applyCarousel）──────────
  // useFrameCallback はアニメ中だけ setActive(true) にする。静止時に毎フレーム
  // 仕事をしないのは C/D ブロックの熱対策と同じ規律（lib/usePausableClock.ts）。
  const carFrameRef = useRef<{ setActive: (a: boolean) => void } | null>(null);
  const count = tracks.length;

  /** 整定した瞬間の後始末。dir!==0 なら曲を確定して着地フェードを始める */
  const finishCarousel = useCallback(
    (dir: number) => {
      carFrameRef.current?.setActive(false);
      if (dir === 0) return;
      // 参照 ORDER は循環（端で止まらない）
      setActiveIndex((i) => (((i + dir) % count) + count) % count);
      setFlipped(false);
      // 旧カードの回転角が残ると落影・接地影が戻らないのでリセット
      cardRotation.value = 0;
      // 購入の呼吸が途中でも、曲が変わったら消す（次のカードへ持ち越さない）
      cardGlow.value = 0;
      // 参照 landT0: 着地から 800ms かけて中央カードを戻す（0 は整定時に設定済み）
      landFade.value = withTiming(1, { duration: CAR_LAND_MS, easing: Easing.linear });
    },
    [count, cardRotation, cardGlow, landFade],
  );

  const startCarousel = useCallback(() => {
    carFrameRef.current?.setActive(true);
  }, []);

  // useFrameCallback は callback の同一性が変わるたびに登録し直す実装なので、
  // インライン関数のままだと再レンダーごとに再登録が走る。useCallback で固定する。
  const carTick = useCallback(
    (info: { timeSincePreviousFrame: number | null }) => {
      'worklet';
      const dt = Math.min((info.timeSincePreviousFrame ?? 1000 / 60) / 1000, CAR_DT_MAX);
      // 参照は 0.22/frame 固定。120Hz 端末で 2 倍速にならないよう時間で補正する
      const k = 1 - Math.pow(1 - CAR_LERP, dt * 60);
      dragX.value += (carTarget.value - dragX.value) * k;
      if (Math.abs(dragX.value - carTarget.value) < CAR_SETTLE) {
        const dir = pendingDir.value;
        // 参照: 確定でもスナップバックでも最後は dragX=0（新しい札が中央に出る）
        dragX.value = 0;
        carTarget.value = 0;
        pendingDir.value = 0;
        carBusy.value = 0;
        // 曲を差し替えるときは、ここで中央スロットを消しておく。
        // activeIndex の更新は runOnJS 経由で 1〜2 フレーム遅れるため、
        // 消さずに dragX=0 へ飛ばすと「古い絵柄が中央で一瞬光る」。
        if (dir !== 0) landFade.value = 0;
        runOnJS(finishCarousel)(dir);
      }
    },
    [finishCarousel, dragX, carTarget, pendingDir, carBusy, landFade],
  );

  const carFrame = useFrameCallback(carTick, false);

  useEffect(() => {
    carFrameRef.current = carFrame;
  }, [carFrame]);

  // ── ジェスチャ（参照 down/move/up = 722-728行）────────────────────
  //   ・6px 動くまで活性化しない＝タップは CardGL 側のフリップへ通る
  //   ・縦に 6px 先行したら失敗（参照の |ax|>=|ay| 軸判定に相当）
  //   ・裏面では丸ごと無効（参照 aProg<0.5 の条件）
  const carouselGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!flipped)
        .activeOffsetX([-CAR_AXIS, CAR_AXIS])
        .failOffsetY([-CAR_AXIS, CAR_AXIS])
        .onBegin(() => {
          'worklet';
          // 参照 down(): 送りアニメ中と裏返し中は操作権を渡さない
          claimed.value = carBusy.value === 0 && Math.abs(cardRotation.value) < 90 ? 1 : 0;
          if (claimed.value) scrolling.value = 1;
        })
        .onUpdate((e) => {
          'worklet';
          if (!claimed.value) return;
          // 参照 move(): dragX = 指の移動量そのまま（1:1・上限なし）
          dragX.value = e.translationX;
        })
        .onEnd((e) => {
          'worklet';
          if (!claimed.value) return;
          const mag = Math.abs(dragX.value);
          const dir = dragX.value < 0 ? 1 : -1;
          // 参照は「押してから離すまでの総時間」で平均速度を出しており、
          // ゆっくり掴んでから素早く払うと成立しない欠陥がある。ここは
          // RNGH の瞬時速度を使い、しきい値 500px/s だけ参照に合わせる。
          const fast = Math.abs(e.velocityX) > CAR_VEL;
          if (mag >= carGeo.thresh || (fast && mag > carGeo.fastMin)) {
            pendingDir.value = dir;
            carTarget.value = -dir * carGeo.step;
          } else {
            pendingDir.value = 0;
            carTarget.value = 0;
          }
          carBusy.value = 1;
          runOnJS(startCarousel)();
        })
        .onFinalize(() => {
          'worklet';
          scrolling.value = 0;
          claimed.value = 0;
        }),
    [
      flipped,
      carGeo,
      claimed,
      carBusy,
      cardRotation,
      scrolling,
      dragX,
      pendingDir,
      carTarget,
      startCarousel,
    ],
  );

  // ── スロットの見た目（参照 applyCarousel 710-718行）──────────────
  const centerStyle = useAnimatedStyle(() => ({
    // 参照 slideFade = max(0, 1-|dragX|/(CARDW*0.55))、着地中は lk と min 合成
    opacity: Math.min(Math.max(0, 1 - Math.abs(dragX.value) / carGeo.fade), landFade.value),
    // 購入演出の持ち上げ(cardTranslateY)・拡大(cardScale)もここへ合成する。
    // style 配列を足すと transform ごと後勝ちで置き換わるため、1本にまとめる。
    transform: [
      { translateX: dragX.value },
      { translateY: floatY.value + cardTranslateY.value },
      { scale: cardScale.value },
    ],
  }));
  // 隣カードは参照どおり等倍・不透明度1（縮小もフェードも掛けない）
  const peekLStyle = useAnimatedStyle(() => ({
    opacity: dragX.value > 0.5 ? 1 : 0,
    transform: [{ translateX: dragX.value - carGeo.step }],
  }));
  const peekRStyle = useAnimatedStyle(() => ({
    opacity: dragX.value < -0.5 ? 1 : 0,
    transform: [{ translateX: dragX.value + carGeo.step }],
  }));

  const prevTrack = tracks[(((activeIndex - 1) % count) + count) % count];
  const nextTrack = tracks[(((activeIndex + 1) % count) + count) % count];

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
          }
        : undefined,
    [active],
  );

  // 試聴は自動開始しない（スピーカーボタンの押下だけをトリガーにする）。
  // 曲を切り替えたら再生中の試聴は止める。
  // ※フェードインは音源ファイル側で定義する方針のため、アプリ側では行わない。
  useEffect(() => {
    preview.pause();
    setPlayingId(null);
  }, [activeIndex, preview]);

  const togglePreview = useCallback(() => {
    if (!active) return;
    if (playingId === active.id) {
      preview.pause();
      setPlayingId(null);
      return;
    }
    const url = active.previewUrl ?? previewUrl(active.audioKey);
    if (!url) return; // 試聴未設定（R2 未設定）
    preview.replace({ uri: url });
    preview.play();
    setPlayingId(active.id);
  }, [active, playingId, preview]);

  const toggleWishlist = useCallback((id: string) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // 所有判定。pendingReveal に居る間は「まだ所有していない」ように見せる（演出の順序のため）
  const isOwned = useCallback(
    (track?: Track | null) => {
      if (!track) return false;
      if (pendingReveal.has(track.id)) return false;
      return track.owned === true || ownedIds?.has(track.id) === true;
    },
    [ownedIds, pendingReveal],
  );

  // 「購入する」押下 → まず購入確認ポップアップを開く（所有済みは再生画面へ）
  const handleBuy = useCallback(() => {
    if (!active) return;
    if (isOwned(active)) {
      onPlay?.(active.id);
      return;
    }
    purchase?.dismiss(); // 前回の失敗表示を持ち越さない
    setPurchaseTarget(active);
  }, [active, isOwned, purchase, onPlay]);

  // ポップアップの金額 or 確定ボタン → OS の課金シートへ。
  // ここでは所有状態も演出も動かさない。成立したかどうかは purchase.onSuccess で受ける
  // （requestPurchase の戻り値は結果ではないため）。
  const confirmPurchase = useCallback(() => {
    const target = purchaseTarget;
    if (!target) return;
    setPlayingId(null);
    purchase?.start(target.id);
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

  const isPreviewing = playingId != null && playingId === active?.id;

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      <StatusBar barStyle="light-content" backgroundColor={C.page} />

      {/* 背景ブロック D の下半分（参照 z 順: bgbase → nebBand → bgstars）。
          旧 NebulaBand + StarField の 2 枚を 1 枚の Canvas へ統合。
          .bgaura は参照側が opacity:0!important の無効レイヤーなので移植しない */}
      {slideH > 0 && <BackdropSky width={screenW} height={slideH} paused={cardSpinning} />}

      {/* 調律陣の背景（プレイヤーと同一・カード中心に配置） */}
      {slideH > 0 && (
        <StarSeal
          width={screenW}
          height={slideH}
          centerX={screenW / 2}
          centerY={slideH / 2}
          cardWidth={cardW}
          paused={cardSpinning}
          style={styles.sealLayer}
        />
      )}

      {/* 背景ブロック D の上半分（減光・粒状感の3層 = bgvig + focus-dim + bggrain）。
          参照の z 順どおり調律陣より上・カードより下。
          旧・減光レイヤーと粒状感レイヤーの 2 枚を 1 枚の Canvas へ統合 */}
      {slideH > 0 && <BackdropVeil width={screenW} height={slideH} />}

      {/* 接地影（card-ground）。カードは floatY で浮くが影は床に留め、
          逆相で「浮くと薄く広く／沈むと濃く狭く」反応させる */}
      {slideH > 0 && !DEBUG_BACKDROP_ONLY && (
        <CardGround
          width={screenW}
          height={slideH}
          centerX={screenW / 2}
          centerY={slideH / 2}
          cardW={cardW}
          cardH={cardH}
          fade={groundFade}
          lift={lift}
          dragX={dragX}
          style={styles.sealLayer}
        />
      )}

      {/* カード層（B ブロック）。参照 .stage は peekL / card / peekR の
          3 スロット固定で、カード自身が指へ 1:1 追従する（710-718行）。
          FlatList の paging では確定しきい値が画面幅の半分になってしまい、
          参照の 37.7px＋500px/s とは別物の操作感だった。 */}
      {slideH > 0 && !DEBUG_BACKDROP_ONLY && (
        <GestureDetector gesture={carouselGesture}>
          <View style={[styles.stage, { height: slideH }]} pointerEvents="box-none">
            {/* 隣接カード（参照 peekL/peekR）。等倍・不透明度1で dragX±STEP。
                静止時は opacity 0 ＝ 合成から外れるだけで、毎フレームの
                描画コストは持たない（中身は静止した Skia レイヤー） */}
            {count > 1 && (
              <>
                <Animated.View style={[styles.slot, peekLStyle]} pointerEvents="none">
                  <CardFace uri={prevTrack.artworkUrl} width={cardW} height={cardH} />
                </Animated.View>
                <Animated.View style={[styles.slot, peekRStyle]} pointerEvents="none">
                  <CardFace uri={nextTrack.artworkUrl} width={cardW} height={cardH} />
                </Animated.View>
              </>
            )}

            {/* アクティブ面: v98準拠の実3Dカード（角丸・厚み・オーラ）。
                表面=角丸の作品画像＋タップで180°横回転して裏返し / 裏面=
                アルミ刻印面（再生画面と同一デザイン）＋全方向回転。
                曲が変わってもカードは載せ替えず、テクスチャだけ差し替える
                （GL コンテキストの作り直しを避ける）。 */}
            <Animated.View style={[styles.slot, centerStyle]} pointerEvents="box-none">
              {active && (
                <CardGL
                  mode="flip"
                  backStyle="aluminum"
                  frontUri={active.artworkUrl}
                  width={cardW}
                  height={cardH}
                  shadow
                  frame={cardFrame}
                  onFlipChange={setFlipped}
                  rotationOut={cardRotation}
                  purchaseGlow={showPurchaseFx ? cardGlow : undefined}
                  backData={backData}
                />
              )}
            </Animated.View>
          </View>
        </GestureDetector>
      )}

      {/* ── 固定クローム（active に連動） ── */}
      <View
        style={[styles.chrome, DEBUG_BACKDROP_ONLY && styles.hidden]}
        pointerEvents={DEBUG_BACKDROP_ONLY ? 'none' : 'box-none'}
      >
        {/* 右上: ベル／EQメーター／試聴アイコンを横一列に並べる。EQ は試聴中だけ
            動く（試聴を止めたらボリュームアニメーションも消える）。
            top は曲名（texts）と同じ topRightY + 5 にして高さを揃える。 */}
        <View style={[styles.topRight, { top: topRightY + 5 }]} pointerEvents="box-none">
          <View style={styles.iconsRow1}>
            <Pressable onPress={onOpenNotifications} hitSlop={10} style={styles.bell}>
              <BellIcon size={24} />
              {hasUnread && <View style={styles.bdot} />}
            </Pressable>
            {/* EqBars は非アクティブ時 null を返すため、幅固定のスロットで囲って
                試聴の開始/停止でベルや試聴アイコンの位置が動かないようにする */}
            <View style={styles.eqSlot}>
              <EqBars active={isPreviewing} />
            </View>
            <Pressable onPress={togglePreview} hitSlop={10}>
              <PreviewIcon size={24} on={isPreviewing} />
            </Pressable>
          </View>
        </View>

        {/* タイトル（1行のみ。eyeコピー・情景サブタイトルはモック確定値により非表示）。
            右上のアイコン列（topRight）と同じ top・高さで縦中央揃えにし、
            アイコンの縦位置とタイトルの縦位置をぴったり揃える。 */}
        <View style={[styles.texts, { top: topRightY + 5 }]} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>{active?.title}</Text>
        </View>

        {/* 下部: 購入ボタン ＋ ウィッシュ星。裏返し中も位置は固定のまま動かさない。 */}
        <View style={[styles.bottom, { bottom: BOTTOM_BASE }]} pointerEvents="box-none">
          {(() => {
            const owned = isOwned(active);
            return (
              <>
                <BuyButton
                  owned={owned}
                  priceLabel={active ? purchase?.displayPriceOf(active.id) : undefined}
                  onPress={handleBuy}
                />
                {/* 所有済みでは星を非表示 */}
                {!owned && (
                  <View style={styles.starSlot}>
                    <WishlistStar
                      inWishlist={active ? wishlist.has(active.id) : false}
                      onToggle={() => active && toggleWishlist(active.id)}
                    />
                  </View>
                )}
              </>
            );
          })()}
        </View>
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
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.page },
  /** 参照 .stage（position:absolute; inset:0）。3スロットの親 */
  stage: { position: 'absolute', left: 0, right: 0, top: 0 },
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
  topRight: { position: 'absolute', top: 22, right: 20, alignItems: 'flex-end' },
  iconsRow1: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  // EqBars 自身の幅（4本×2px＋間隔3×2px＝14px）に合わせた固定スロット。
  // EqBars は非アクティブ時 null を返すため、これで囲わないと行の幅が
  // 詰まり、右寄せの行内でベルの位置が動いてしまう。
  eqSlot: { width: 14, alignItems: 'center', justifyContent: 'center' },
  bell: {},
  bdot: {
    position: 'absolute', top: -1, right: -1,
    width: 6, height: 6, borderRadius: 3, backgroundColor: C.badge,
  },
  // height はアイコン列（topRight の iconsRow1）と同じ 24px にして
  // justifyContent:'center' で縦中央を揃える（フォント行送りの誤差を吸収する）
  texts: { position: 'absolute', left: 22, right: 120, height: 24, justifyContent: 'center' },
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
  starSlot: { position: 'absolute', left: '50%', marginLeft: 64 + 12 },

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
