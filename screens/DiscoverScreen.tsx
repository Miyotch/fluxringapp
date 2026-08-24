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
  withRepeat,
  withSequence,
  withTiming,
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
  computeBackScale,
  CARD_ASPECT,
  PURCHASE_RISE_MS,
  PURCHASE_FALL_MS,
} from '../components/CardGL';
import { BuyButton } from '../components/BuyButton';
import { WishlistStar } from '../components/WishlistStar';
import { BellIcon, PreviewIcon } from '../components/icons';
import { RisingBubbles } from '../components/RisingBubbles';

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
  cyan: '#60CEE0',
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
    materials?: string[];    // 原材料（例: ['純正律']）
    frequencies?: string[];  // 例: ['432 Hz', '7.83 Hz']
    artist?: string;         // 'NAOKI OKA'
  };
};

type Props = {
  tracks?: Track[];
  hasUnread?: boolean;
  onOpenNotifications?: () => void;
  onBuy?: (track: Track) => void;
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

// ── 試聴中の EQ バー（component_catalog: audio.on） ──
const EqBars: React.FC<{ active: boolean }> = ({ active }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = active
      ? withRepeat(withSequence(
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 500, easing: Easing.inOut(Easing.sin) }),
        ), -1, false)
      : withTiming(0, { duration: 200 });
  }, [active, p]);

  // フックは常に同数・同順で呼ぶ（条件分岐やループ内で呼ばない）
  const s0 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + p.value * 0.5 }] }));
  const s1 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + p.value * 1.0 }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + p.value * 0.7 }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + p.value * 1.0 }] }));

  if (!active) return null;
  const bars = [s0, s1, s2, s3];
  return (
    <View style={styles.eq}>
      {bars.map((st, i) => (
        <Animated.View key={i} style={[styles.eqBar, { height: 5 + i * 2 }, st]} />
      ))}
    </View>
  );
};

export const DiscoverScreen: React.FC<Props> = ({
  tracks = FALLBACK,
  hasUnread = true,
  onOpenNotifications,
  onBuy,
}) => {
  const [slideH, setSlideH] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [flipped, setFlipped] = useState(false); // アクティブカードが裏面か（横スクロール可否用）
  // アクティブカードの表面からの回転角（度）。focus-dim（背景暗転）の駆動用
  const cardRotation = useSharedValue(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());

  // 購入の泡演出（元のカード位置で下から立ち上る）
  const [showBubbles, setShowBubbles] = useState(false);
  // 購入の「シアンの呼吸」（DESIGN.md: 立ち上がり約0.6秒 → 約700ms で戻す）。
  // カード枠（内側1px）と靄（外周グロー2層）が同時に灯る。
  const purchaseGlow = useSharedValue(0);
  // 呼吸の Skia レイヤー（枠＋靄の Canvas 2枚・Blur 2パス）は演出中だけマウントする。
  // 常時マウントだと progress=0 で何も映さないまま合成コストだけ払い続ける。
  const [glowActive, setGlowActive] = useState(false);
  const glowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (glowTimer.current) clearTimeout(glowTimer.current); }, []);

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
  const stageFit = screenH > 0 ? screenH / 760 : 1;
  const cardW = Math.round(188.59 * stageFit);
  // 比率は CardGL の CARD_ASPECT が唯一の正（GL メッシュと必ず揃える）
  const cardH = Math.round(cardW * CARD_ASPECT);
  // 参照のデバイス枠に相当する矩形。裏面の拡大率 S と持ち上げ量はここ基準で決まる
  // （参照 _dv3d.layout: S = min(1.28, 枠幅*0.86/カード幅, 枠高*0.82/カード高)）。
  const cardFrame = useMemo(() => ({ width: screenW, height: slideH }), [screenW, slideH]);
  const backScale = useMemo(
    () => computeBackScale(cardFrame, cardW, cardH),
    [cardFrame, cardW, cardH],
  );

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
      purchaseGlow.value = 0;
      setGlowActive(false);
      // 参照 landT0: 着地から 800ms かけて中央カードを戻す（0 は整定時に設定済み）
      landFade.value = withTiming(1, { duration: CAR_LAND_MS, easing: Easing.linear });
    },
    [count, cardRotation, purchaseGlow, landFade],
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
    transform: [{ translateX: dragX.value }, { translateY: floatY.value }],
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
            frequencies: active.back?.frequencies,
            artist: active.back?.artist,
          }
        : undefined,
    [active],
  );

  // 曲切替で試聴を止める
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

  const handleBuy = useCallback(() => {
    if (!active) return;
    const owned = active.owned || ownedIds.has(active.id);
    if (owned) {
      // TODO: 所有済みは再生画面へ。暫定は何もしない（泡の再発を防ぐ）
      return;
    }
    setPlayingId(null);
    onBuy?.(active);
    // 新しいカードは出さず、元のカードの位置で泡を立ち上げて購入完了を表現。
    // 所有済みにして購入ボタンを「再生」へ。
    setOwnedIds((prev) => new Set(prev).add(active.id));
    setShowBubbles(true);
    // シアンの呼吸を一度だけ深く脈打たせる（DESIGN.md の実装値）
    setGlowActive(true);
    purchaseGlow.value = withSequence(
      withTiming(1, { duration: PURCHASE_RISE_MS, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: PURCHASE_FALL_MS, easing: Easing.inOut(Easing.ease) }),
    );
    // 呼吸が終わったらレイヤーごと外す（+80ms は着地の余裕）
    if (glowTimer.current) clearTimeout(glowTimer.current);
    glowTimer.current = setTimeout(
      () => setGlowActive(false),
      PURCHASE_RISE_MS + PURCHASE_FALL_MS + 80,
    );
  }, [active, ownedIds, onBuy, purchaseGlow]);

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
                  purchaseGlow={glowActive ? purchaseGlow : undefined}
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
        {/* ブランド */}
        <Text style={styles.brand}>Flux Ring</Text>

        {/* 右上: EQ / ベル / 試聴 */}
        <View style={styles.topRight} pointerEvents="box-none">
          <View style={styles.icons}>
            <EqBars active={isPreviewing} />
            <Pressable onPress={onOpenNotifications} hitSlop={10} style={styles.bell}>
              <BellIcon size={17} />
              {hasUnread && <View style={styles.bdot} />}
            </Pressable>
            <Pressable onPress={togglePreview} hitSlop={10}>
              <PreviewIcon size={17} on={isPreviewing} />
            </Pressable>
          </View>
        </View>

        {/* タイトル＋情景 */}
        <View style={styles.texts} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>{active?.title}</Text>
          {active?.subtitle && (
            <Text style={styles.subt} numberOfLines={2}>{active.subtitle}</Text>
          )}
        </View>

        {/* 下部: 購入ボタン ＋ ウィッシュ星 */}
        <View style={styles.bottom} pointerEvents="box-none">
          {(() => {
            const owned = active ? active.owned || ownedIds.has(active.id) : false;
            return (
              <>
                <BuyButton owned={owned} onPress={handleBuy} />
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

      {/* 購入の泡（元のカード位置で下から立ち上る・複製カードは出さない） */}
      {showBubbles && slideH > 0 && (
        <RisingBubbles
          width={screenW}
          height={slideH}
          onDone={() => setShowBubbles(false)}
        />
      )}
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
  brand: {
    position: 'absolute',
    // TODO: SafeAreaInsets.top を加算
    top: 26, left: 22,
    fontSize: 10, letterSpacing: 4, color: C.sub, fontWeight: '300',
  },
  topRight: { position: 'absolute', top: 22, right: 20 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  bell: {},
  bdot: {
    position: 'absolute', top: -1, right: -1,
    width: 6, height: 6, borderRadius: 3, backgroundColor: C.badge,
  },
  eq: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 },
  eqBar: { width: 2, borderRadius: 1, backgroundColor: C.cyan },

  texts: { position: 'absolute', left: 22, right: 120, top: 58 },
  title: { fontSize: 18, letterSpacing: 0.9, color: C.text },
  subt: { fontSize: 11, color: C.sub, fontWeight: '300', marginTop: 4, lineHeight: 17 },

  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 36,
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
