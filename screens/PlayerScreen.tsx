/**
 * PlayerScreen.tsx — 再生画面（コレクションから開く）
 * ------------------------------------------------------------------
 * コレクション・ホーム（購入済み）どちらから開いても同じこの画面。2フェーズ構成:
 *   ・ベール(veil): いきなり再生せず、星雲（NebulaGL）の上に薄い暗幕を重ねた背景に
 *                   カードと大きな再生ボタンだけを出す（魔法陣は出さない）
 *   ・再生(playing): 再生ボタンで開始。背景は星雲（NebulaGL）のまま暗幕だけ外れる。
 *                    下部に枠なしのトランスポート（シーク・時間・再生/停止・ループ）
 *   ・上部左「‹ 戻る」（文言は遷移元によらず共通。戻り先は onBackHome が制御）／右に共有（旧ストーリー導線は廃止）
 *   ・EQ なし。曲送り／戻しは所有が2曲以上のときだけ有効（1曲なら淡色の無効表示）
 *   ・フッター非表示・縦画面固定。総時間は音源から自動算出
 *   ・ホーム(ディスカバー)側は従来のまま。この画面のみの挙動
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  StatusBar,
  Share,
  PanResponder,
  useWindowDimensions,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { CardGL, CARD_BACK_SCALE_MAX } from '../components/CardGL';
import { NebulaGL } from '../components/NebulaGL';
import { CardAfterimage, CardOrigin, CardOriginItem } from '../components/CardAfterimage';
import { EqBars } from '../components/EqBars';
import { PlayMark, PauseMark, LoopIcon, ShareIcon, SkipIcon, SkipPrevIcon, StarIcon } from '../components/icons';
import { COLOR, SPACE, TRANSPORT, homeCardWidth } from '../constants/design-tokens';
import { formatTime } from '../lib/audio';
import { useTopInset, useBottomInset } from '../lib/safeArea';
import { usePlayback, usePlaybackProgress } from '../lib/playback';
import { SWIPE_SPRING, swipeDirection } from '../constants/swipe';
import { OrbitBuyButton } from '../components/OrbitBuyButton';
import { PurchaseModal } from '../components/PurchaseModal';
import type { PurchaseController } from '../lib/usePurchaseFlow';
import { formatPrice, TRACK_PRICE_JPY } from '../constants/pricing';
import { NUM_FONT, JP_SERIF_FONT } from '../constants/fonts';

export type PlayerTrack = {
  id: string;
  title: string;
  subtitle?: string;        // 情景の言葉（任意）
  artworkUrl: string;
  audioKey: string;         // R2 のフル音源キー（所有者のみ・署名付き）
  durationSec?: number;     // フォールバック表示用（実尺は音源から自動算出）
  glowColor?: string;
  glowColor2?: string;
  // カード裏面（アルミ刻印）用。ホーム（ディスカバー）の Track.back と同じ内容。
  serial?: string;           // 'No. 001'
  story?: string;            // 裏面の本文（未指定なら subtitle を使う）
  tuning?: string;           // 調律名（例: '純正律'）
  frequencies?: string[];    // 周波数のみ（例: ['432 Hz', '7.83 Hz']）
  artist?: string;           // 'NAOKI OKA'
  useCases?: string[];       // 用途タグ（例: ['睡眠', '勉強', '集中力']）
  /**
   * 試聴として流す（まだ持っていない曲）。HOME の「再生」から流すと、所有曲の
   * あとに HOME の並びで未購入の曲が試聴として続く（2026-09-25 代表決定）。
   * 再生画面では購入ボタンが出て、買うと全編に切り替わる。
   */
  preview?: boolean;
  /** 試聴の音源 URL（Firestore tracks/{id}.previewUrl）。無ければ audioKey から組む */
  previewUrl?: string | null;
  /** 購入時点の価格（円）。購入の記録用 */
  priceJpy?: number;
};

type Props = {
  track: PlayerTrack;
  /** コレクションでタップされたタイルの画面絶対座標（フライトイン演出の起点） */
  origin?: CardOrigin;
  /**
   * タップ時点でコレクション画面に見えていた所有済みタイル全ての座標＋
   * アートワーク。指定時、その全箇所にうっすら残像を残す。
   */
  afterimages?: CardOriginItem[];
  onBackHome: () => void; // コレクション or ホームへ戻る（実際の戻り先はこちらが制御）
  /** 上部左の戻る導線の文言。遷移元によらず「‹ 戻る」で共通
   *  （2026-09-22 指示。以前は「‹ コレクションへ戻る」「‹ ホームへ戻る」と
   *  出し分けていた）。 */
  backLabel?: string;
  onOpenStory?: () => void; // 未使用（ストーリー導線は廃止）
  /**
   * 曲送り／戻し。所有が2曲以上のときだけ親から渡る。
   * 1曲しか持っていない場合は undefined で、ボタンは淡色の無効表示になる
   * （非表示にすると押すたびにレイアウトが変わって落ち着かないため）。
   */
  onPrevTrack?: () => void;
  onNextTrack?: () => void;
  /**
   * ベール（コレクションのタイルから開いたとき）の大きな再生ボタン、または
   * まだ中枢がこの曲を流していないときの再生ボタン。親が中枢のキューを組んで
   * 流し始める（0.2.0 第 2 段階）。
   */
  onStart?: () => void;
  /**
   * 前後の曲の作品画像。先に読み込ませ、カードを払って曲を送ったときに
   * 新しいカードの絵が遅れて出ないようにする。毎レンダー新しい配列を渡さないこと
   */
  preloadUris?: string[];
  /**
   * true なら、開いた時点では流さず、大きな再生ボタン（ベール）を出す。
   * マイリストでカードを押したとき（2026-09-25 岡さん指示）。コレクションの
   * タイルから開いたとき（origin あり）は、これが無くてもベールを出す
   */
  startPaused?: boolean;
  /**
   * 購入フロー。試聴で流している曲（track.preview）に購入ボタンを出すために使う。
   * 買えたら App が中枢の markOwned で全編に切り替える
   */
  purchase?: PurchaseController;
};

/*
 * カードを払って曲送りにする基準は HOME・再生バナーと同じ（constants/swipe.ts）。
 * 以前は 72px か 0.6px/ms で、HOME（カード幅の 20%・500px/秒）より重かった。
 * 動きも HOME にそろえた: 指について平らに滑り、離したときの速さのまま抜ける
 * （以前は傾きながら薄くなって飛んでいた）。
 */

export const PlayerScreen: React.FC<Props> = ({
  track,
  origin,
  afterimages,
  backLabel = '‹ 戻る',
  onBackHome,
  onPrevTrack,
  onNextTrack,
  onStart,
  preloadUris,
  purchase,
  startPaused = false,
}) => {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const navTop = useTopInset(8);            // 従来 52px（=44+8）
  const transportBottom = useBottomInset(40, 12); // ホームインジケータ回避（従来 40px を下回らない）
  // CardGL 自体の実サイズは常にこの「再生時の最終サイズ」で固定（3Dシーンの再初期化を避ける）。
  // ベール（フォーカス）時はこれより一回り小さく見せたいので、下の cardWrapStyle で
  // wrapper に scale をかけて視覚上だけ縮小する。
  const cardW = Math.min(screenW - 96, 240);
  const cardH = Math.round(cardW * 1.5);
  // フォーカス時（ベール）の見かけサイズ＝再生時の 1/1.08（＝再生開始で 1.08倍に育つ）
  const FOCUS_SCALE = 1 / 1.08;
  // 裏面（フリップ後）の絶対サイズをホーム画面と揃える。表面カードはこの画面の
  // ほうが大きい（cardW=240 前後 vs ホーム172）ため、CardGL 既定の
  // FLIP_BACK_SCALE をそのまま使うと裏面がホームよりずっと大きく描かれてしまう。
  // 「ホームの裏面幅」になるよう、この画面の cardW 基準で倍率を逆算する。
  // ホーム側の裏面倍率は CardGL の computeBackScale（参照 _dv3d.layout）で、
  // 実機の画面比ではまず上限の CARD_BACK_SCALE_MAX に張り付く。旧 FLIP_BACK_SCALE
  // (1.75) は現在どこでも使われておらず、これで逆算すると裏面が3割大きくなって
  // cardArea（overflow:hidden）の上辺で切れる。
  const backScale = (homeCardWidth(screenH) * CARD_BACK_SCALE_MAX) / cardW;

  // 残像の起点は「開いた瞬間」の座標に固定。曲送り／戻しで track が変わっても動かさない。
  const [afterimageOrigin] = useState(origin ?? null);
  // 残像を残す全箇所（コレクションで見えていた所有済みタイルすべて）も同様に固定
  const [afterimageItems] = useState(afterimages ?? []);
  // コレクションのタイルから開いた（origin あり）ときだけ、タイル→カードの
  // フライトインと「ベール（大きな再生ボタンをもう一度押す）」を経由する。
  // ホームの再生ボタンから開いた（origin なし）ときは、ワンクッション挟まず
  // 最初から再生状態で表示する（起点となるタイルが無く飛んでくる演出も
  // 不要なため）。
  const [startPausedAtOpen] = useState(startPaused);
  const directPlay = !afterimageOrigin && !startPausedAtOpen;

  // ベール（再生前）→ 再生 の2フェーズ。directPlay のときは最初から'playing'。
  const [phase, setPhase] = useState<'veil' | 'playing'>(directPlay ? 'playing' : 'veil');
  // 再生ボタンの見た目。phaseは音声の開始判定にすぐ使うため即切替するが、
  // ボタン自体は自分のフェードアウト演出が終わるまで少し長く表示を残す。
  const [veilButtonVisible, setVeilButtonVisible] = useState(!directPlay);
  const [seekW, setSeekW] = useState(1);

  // カード領域のレイアウト（x/y は root 内での位置。フライトインの着地座標に使う）
  const [cardArea, setCardArea] = useState({ x: 0, y: 0, w: 0, h: 0 });
  // CardGL へ渡す枠。cardArea は overflow:hidden なので、この高さを超えて
  // 裏面が拡大されないよう CardGL 側でクランプさせる。
  // ※毎レンダーで新しいオブジェクトを渡すと R3F のツリーが作り直されるので useMemo。
  const cardFrame = useMemo(
    () => ({ width: cardArea.w, height: cardArea.h }),
    [cardArea.w, cardArea.h],
  );

  // ── コレクション→再生 の画面遷移演出 ──────────────────────────
  // ①カードがコレクションのグリッド位置から中央フォーカス位置へ拡大しながら移動
  // ②再生ボタンを押すと、背景が星雲へクロスフェード＋カードがさらに一回り拡大＋
  //   ヘッダー/コントロールが遅延フェードインする。
  // directPlay のときはこの演出をすべて飛ばし、各共有値を最初から「着地後」の
  // 値で初期化する（ベールの大きな再生ボタンも表示しない）。
  const flightDone = useRef(false);
  const cardTX = useSharedValue(0);
  const cardTY = useSharedValue(0);
  const cardScale = useSharedValue(directPlay ? 1 : FOCUS_SCALE);
  const veilBgOpacity = useSharedValue(directPlay ? 0 : 1); // ブラー背景＋残像（1）→星雲のみ（0）
  const playBtnOpacity = useSharedValue(0);
  const playBtnTY = useSharedValue(10);
  const headerOpacity = useSharedValue(directPlay ? 1 : 0);
  const headerTY = useSharedValue(directPlay ? 0 : -10);
  // 戻るボタン（「‹」）は、ベール中（再生前）に戻る手段が背景タップしか無く
  // 気づきにくかったため、タイトル等（headerOpacity）とは独立に、カードの
  // 着地と同時に早く出す。
  const navOpacity = useSharedValue(directPlay ? 1 : 0);
  const navTY = useSharedValue(directPlay ? 0 : -10);
  const controlsOpacity = useSharedValue(directPlay ? 1 : 0);
  const controlsTY = useSharedValue(directPlay ? 0 : 15);
  // 背景タップでコレクションへ戻るときの、画面全体のフェードアウト＋縮小
  const rootOpacity = useSharedValue(1);
  const rootScale = useSharedValue(1);

  const cardWrapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cardTX.value },
      { translateY: cardTY.value },
      { scale: cardScale.value },
    ],
  }));
  const veilBgStyle = useAnimatedStyle(() => ({ opacity: veilBgOpacity.value }));
  const playBtnAnimStyle = useAnimatedStyle(() => ({
    opacity: playBtnOpacity.value,
    transform: [{ translateY: playBtnTY.value }],
  }));
  const headerAnimStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTY.value }],
  }));
  const navAnimStyle = useAnimatedStyle(() => ({
    opacity: navOpacity.value,
    transform: [{ translateY: navTY.value }],
  }));
  const controlsAnimStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
    transform: [{ translateY: controlsTY.value }],
  }));
  const rootExitStyle = useAnimatedStyle(() => ({
    opacity: rootOpacity.value,
    transform: [{ scale: rootScale.value }],
  }));

  // ①カードのフライトイン。コレクションのタイル座標（origin）が分かっていて、かつ
  // カード領域のレイアウトが確定したら一度だけ実行する。directPlay（ホームの
  // 再生ボタンから開いた）ときはすべて着地後の値で初期化済みなので、この演出
  // 自体を丸ごとスキップする。
  useEffect(() => {
    if (directPlay || flightDone.current || cardArea.w === 0) return;
    flightDone.current = true;
    const targetCenterX = cardArea.x + cardArea.w / 2;
    const targetCenterY = cardArea.y + cardArea.h / 2;
    const flight = { duration: 400, easing: Easing.out(Easing.cubic) };

    if (afterimageOrigin) {
      // 起点＝グリッドのタイル矩形の中心に、そのタイルと同じ見かけサイズで重なるよう
      // 初期値を即値セットしてから、フォーカス位置/サイズへアニメーションする。
      const originCenterX = afterimageOrigin.x + afterimageOrigin.width / 2;
      const originCenterY = afterimageOrigin.y + afterimageOrigin.height / 2;
      cardTX.value = originCenterX - targetCenterX;
      cardTY.value = originCenterY - targetCenterY;
      cardScale.value = afterimageOrigin.width / cardW;
      cardTX.value = withTiming(0, flight);
      cardTY.value = withTiming(0, flight);
      cardScale.value = withTiming(FOCUS_SCALE, flight);
    }

    // 再生ボタンは、カードが着地する頃にふわっと出す
    playBtnOpacity.value = withDelay(afterimageOrigin ? 250 : 0, withTiming(1, { duration: 300 }));
    playBtnTY.value = withDelay(afterimageOrigin ? 250 : 0, withTiming(0, { duration: 300 }));
    // 戻るボタンも同じタイミングで出す（ベール中に戻る手段が無いのを防ぐ）
    navOpacity.value = withDelay(afterimageOrigin ? 250 : 0, withTiming(1, { duration: 300 }));
    navTY.value = withDelay(afterimageOrigin ? 250 : 0, withTiming(0, { duration: 300 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardArea.w, cardArea.h, cardArea.x, cardArea.y, afterimageOrigin]);

  // ②再生ボタン tap → 背景クロスフェード・カード追加拡大・UIの遅延フェードイン
  const runPlayingTransition = useCallback(() => {
    // 再生ボタン自身は即フェードアウト
    playBtnOpacity.value = withTiming(0, { duration: 150 });
    // 背景: ブラー幕（＋残像）がふっと薄れて、下の星雲（常時マウント）だけが見える状態へ
    // 完全に切り替わる＝クロスフェード。ホームの再生時と同じ「星雲のみ」の背景にする。
    veilBgOpacity.value = withTiming(0, { duration: 700, easing: Easing.inOut(Easing.quad) });
    // カード: フォーカスサイズ→再生サイズへもう一段拡大
    cardScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    // ヘッダー（戻る／曲名）: 200ms遅れて上からフェードイン
    headerOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    headerTY.value = withDelay(200, withTiming(0, { duration: 500 }));
    // トランスポート（シーク・時間・操作）: 350ms遅れて下からフェードイン
    controlsOpacity.value = withDelay(350, withTiming(1, { duration: 500 }));
    controlsTY.value = withDelay(350, withTiming(0, { duration: 500 }));
  }, [playBtnOpacity, veilBgOpacity, cardScale, headerOpacity, headerTY, controlsOpacity, controlsTY]);

  // ── 音はアプリ全体の再生の中枢（lib/playback.tsx）が持つ（0.2.0 第 2 段階）──
  // この画面は中枢の窓。自前のプレイヤー・音源の解決・自動再生・ロック画面・
  // 再生の記録は中枢へ移した。閉じても音は止まらない（下の再生バナーで続く）。
  const pb = usePlayback();
  const prog = usePlaybackProgress();
  // 中枢がいま流している曲がこの画面の曲か（ベール中はまだ流していない）
  const isCurrent = pb.current?.id === track.id;
  const duration = isCurrent ? prog.duration || track.durationSec || 0 : track.durationSec || 0;
  const position = isCurrent ? prog.position : 0;
  const playing = isCurrent && pb.playing;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const loading = isCurrent && pb.loading;
  const error = isCurrent ? pb.note : null;
  // ループは「輪（全曲）／1 曲」。アイコンが点いているとき＝1 曲リピート
  const loop = pb.repeat === 'one';

  const togglePlay = useCallback(() => {
    if (pb.current?.id === track.id) pb.toggle();
    else onStart?.();
  }, [pb, track.id, onStart]);

  // ベールの再生ボタン → 再生フェーズへ（読み込み後に上の effect が play する）。
  // 見た目のボタンは自分のフェードアウトが終わるまで少し長く残す（即アンマウントすると
  // アニメーションが切れて見えるため、phaseとは別のフラグで畳む）。
  const veilButtonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPlayback = useCallback(() => {
    runPlayingTransition();
    setPhase('playing');
    onStart?.();
    veilButtonTimer.current = setTimeout(() => setVeilButtonVisible(false), 200);
  }, [runPlayingTransition, onStart]);

  useEffect(() => () => {
    if (veilButtonTimer.current) clearTimeout(veilButtonTimer.current);
  }, []);

  // ── 試聴で流している曲の購入（2026-09-25）──
  // HOME の「再生」から流すと、所有曲のあとに未購入の曲が試聴で続く。
  // 並びに試聴の曲が 1 曲でもあれば、購入ボタンの場所を常に空けておく
  // （曲ごとに出たり消えたりすると、カードの位置が上下に動いて落ち着かないため）。
  const queueHasPreview = pb.queue.some((t) => t.preview);
  // 購入の確認を開いた時点の曲に固定する（確認中に試聴が終わって次の曲へ
  // 進んでも、買う曲が入れ替わらないように）
  const [buyTarget, setBuyTarget] = useState<PlayerTrack | null>(null);
  const buyTargetRef = useRef(buyTarget);
  buyTargetRef.current = buyTarget;
  useEffect(() => {
    if (!purchase) return;
    return purchase.onSuccess((id) => {
      if (buyTargetRef.current?.id === id) setBuyTarget(null);
    });
  }, [purchase]);
  const openBuy = useCallback(() => {
    purchase?.dismiss(); // 前回の失敗表示を持ち越さない
    setBuyTarget(track);
  }, [purchase, track]);

  const onShare = useCallback(() => {
    Share.share({ message: `FLUX RING — ${track.title}` }).catch(() => {});
  }, [track.title]);

  // ── カードを左右に払って曲送り（2026-09-24 代表指示「FluxRing らしく」）──
  // 左へ払う＝次の曲、右へ払う＝前の曲。カードは指について動き、払い切ると
  // 画面の外へ抜け、新しい曲のカードが反対側から滑り込む。下の ⏮ ⏭ ボタンも
  // 同じ動きにする（ボタンだと一瞬で切り替わって落ち着かない、との指摘）。
  //   ・表面のときだけ。裏面の指ドラッグは今までどおりカードを回す
  //     （CardGL が裏面では指の横取りを断るので、ここへは来ない）
  //   ・表面のタップ（裏返す）は CardGL のまま。横へ 14px 以上動いたときだけ取る
  //   ・曲が 1 曲しかない／ベール中（まだ流していない）は送らない
  //
  // 滑り込みは「新しい曲の絵が表に出た」（CardGL の onFrontShown）のを待ってから
  // 始める。以前は抜けた直後に決め打ちで滑り込ませていたので、曲の切り替えが
  // 間に合わず、入ってくるカードに前の曲の絵が 2 フレームほど映っていた
  // （2026-09-24 実機収録）。待っている間は画面の外に置いておく。
  const swipeX = useSharedValue(0);
  const skipRef = useRef({ prev: onPrevTrack, next: onNextTrack });
  skipRef.current = { prev: onPrevTrack, next: onNextTrack };
  const trackUriRef = useRef(track.artworkUrl);
  trackUriRef.current = track.artworkUrl;
  // 抜けたあと、新しい絵を待っているか（dir: 1=次から来る / -1=前から来る）
  const enterRef = useRef<{ from: number; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const busyRef = useRef(false);
  /** 払ったときの速さ（px/秒）。抜けたあと、入ってくるカードも同じ向き・速さで入れる */
  const flingVelRef = useRef(0);

  const slideIn = useCallback(() => {
    const e = enterRef.current;
    if (!e) return;
    if (e.timer) clearTimeout(e.timer);
    enterRef.current = null;
    busyRef.current = false;
    // 1 フレーム遅れて絵が替わることがあるので、ほんの少し置いてから動かす。
    // 払った勢いのまま入ってくる（ボタンのときは 0 から動き出す）
    const v = flingVelRef.current;
    flingVelRef.current = 0;
    swipeX.value = withDelay(40, withSpring(0, { ...SWIPE_SPRING, velocity: v }));
  }, [swipeX]);

  const afterOut = useCallback(
    (dir: number) => {
      const fn = dir > 0 ? skipRef.current.next : skipRef.current.prev;
      const from = dir > 0 ? screenW : -screenW; // 次の曲は右から、前の曲は左から
      // 画面の外で待たせる。止まった値のまま描き直すと Reanimated がマウント時の
      // 値（真ん中）へ戻すので、見えない位置でごくわずかに動かし続けておく
      swipeX.value = withSequence(
        withTiming(from, { duration: 0 }),
        withTiming(from * 1.02, { duration: 900 }),
      );
      const timer = setTimeout(slideIn, 900); // 絵の知らせが来なくても滑り込ませる
      enterRef.current = { from, timer };
      fn?.();
    },
    [screenW, swipeX, slideIn],
  );

  /** 曲送りの動き。dir: 1=次の曲 / -1=前の曲。velocity=払ったときの速さ（px/秒） */
  const animateSkip = useCallback(
    (dir: number, velocity = 0) => {
      const can = dir > 0 ? skipRef.current.next : skipRef.current.prev;
      if (!can || busyRef.current) {
        swipeX.value = withSpring(0, { ...SWIPE_SPRING, velocity });
        return;
      }
      busyRef.current = true;
      flingVelRef.current = velocity;
      const out = dir > 0 ? -screenW : screenW;
      swipeX.value = withSpring(
        out,
        { ...SWIPE_SPRING, velocity },
        (finished) => {
          'worklet';
          if (finished) runOnJS(afterOut)(dir);
        },
      );
    },
    [screenW, swipeX, afterOut],
  );
  const animateSkipRef = useRef(animateSkip);
  animateSkipRef.current = animateSkip;

  // 新しい曲の絵が表に出たら滑り込ませる
  const handleFrontShown = useCallback(
    (uri: string) => {
      if (enterRef.current && uri === trackUriRef.current) slideIn();
    },
    [slideIn],
  );
  useEffect(() => () => {
    if (enterRef.current?.timer) clearTimeout(enterRef.current.timer);
  }, []);

  const swipePan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          !busyRef.current &&
          !!(skipRef.current.next || skipRef.current.prev) &&
          Math.abs(g.dx) > 14 &&
          Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) => {
          // 送り先が無い向きは、少しだけ動いて戻る（ゴムのような手応え）
          const can = g.dx < 0 ? skipRef.current.next : skipRef.current.prev;
          swipeX.value = can ? g.dx : g.dx * 0.25;
        },
        onPanResponderRelease: (_e, g) => {
          // PanResponder の速さは px/ms。HOME と同じ px/秒へ直して同じ基準で判定する
          const vx = g.vx * 1000;
          const dir = swipeDirection(g.dx, vx, cardWRef.current);
          if (dir === 0) {
            swipeX.value = withSpring(0, { ...SWIPE_SPRING, velocity: vx });
            return;
          }
          animateSkipRef.current(dir, vx);
        },
        onPanResponderTerminate: () => {
          swipeX.value = withSpring(0, SWIPE_SPRING);
        },
      }),
    [swipeX],
  );
  const cardWRef = useRef(cardW);
  cardWRef.current = cardW;
  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));
  const onPrevPress = useCallback(() => animateSkip(-1), [animateSkip]);
  const onNextPress = useCallback(() => animateSkip(1), [animateSkip]);

  // カードの塊は、再生位置の更新（0.25 秒ごとの描き直し）に巻き込まない。
  // 払っている最中に描き直すと、Reanimated がカードを一瞬マウント時の位置へ
  // 戻すことがあるため、カードに関わる値が変わったときだけ作り直す。
  const cardBlock = useMemo(
    () => (
        <Animated.View style={swipeStyle} {...swipePan.panHandlers}>
        <Animated.View style={[{ width: cardW, height: cardH }, cardWrapStyle]}>
          {/* 実3D（WebGL）カード: ホーム画面と同じ flip モード（タップで表↔裏・
              裏面のみ指ドラッグで自由回転／±22°クランプ・ダブルタップで表に戻る）。
              以前の spin モード（常時ドラッグで360°回転・初期姿勢がわずかに傾く）
              から統一した。厚み1mm。 */}
          <CardGL
            mode="flip"
            frontUri={track.artworkUrl}
            preloadUris={preloadUris}
            onFrontShown={handleFrontShown}
            width={cardW}
            height={cardH}
            depthRatio={0.016}
            frame={cardFrame}
            backScale={backScale}
            backData={{
              title: track.title,
              serial: track.serial,
              story: track.story ?? track.subtitle,
              tuning: track.tuning,
              frequencies: track.frequencies,
              artist: track.artist ?? 'NAOKI OKA',
              useCases: track.useCases,
            }}
          />
        </Animated.View>
        </Animated.View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [swipeStyle, swipePan, cardWrapStyle, cardW, cardH, track, cardFrame, backScale, preloadUris, handleFrontShown],
  );

  // タップ位置でシーク
  // シークバー：押した所へ飛ぶ＋指で引ける（2026-09-24）。引いている間は
  // 表示だけを動かし、離したときに 1 回だけ飛ぶ（引くたびに飛ぶと音がぶつ切れる）。
  const [scrub, setScrub] = useState<number | null>(null);
  const seekRef = useRef({ duration, seekW, isCurrent, seekTo: pb.seekTo });
  seekRef.current = { duration, seekW, isCurrent, seekTo: pb.seekTo };
  const scrubStart = useRef(0);
  const scrubNow = useRef(0);
  const seekPan = useMemo(() => {
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    return PanResponder.create({
      onStartShouldSetPanResponder: () =>
        seekRef.current.isCurrent && seekRef.current.duration > 0,
      onMoveShouldSetPanResponder: () =>
        seekRef.current.isCurrent && seekRef.current.duration > 0,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const r = clamp(e.nativeEvent.locationX / seekRef.current.seekW);
        scrubStart.current = r;
        scrubNow.current = r;
        setScrub(r);
      },
      onPanResponderMove: (_e, g) => {
        const r = clamp(scrubStart.current + g.dx / seekRef.current.seekW);
        scrubNow.current = r;
        setScrub(r);
      },
      onPanResponderRelease: () => {
        const { duration: d, seekTo } = seekRef.current;
        seekTo(scrubNow.current * d);
        setScrub(null);
      },
      onPanResponderTerminate: () => setScrub(null),
    });
  }, []);
  const shownProgress = scrub ?? progress;

  return (
    <Animated.View style={[styles.root, rootExitStyle]}>
      <StatusBar barStyle="light-content" backgroundColor="#05040C" />

      {/* 背景: 星屑＋星雲（NebulaGL）は常時マウント。その上に「コレクションを
          ぼかしたような暗いブラー幕」を重ねておき、再生ボタンのタップで
          この幕をふっと透明化する＝星雲へのクロスフェードとして見せる。 */}
      <NebulaGL />
      <Animated.View style={[styles.veilBgLayer, veilBgStyle]} pointerEvents="none">
        <Image source={{ uri: track.artworkUrl }} style={styles.veilBgImage} blurRadius={40} />
        <View style={styles.veilScrim} />
      </Animated.View>

      {/* 残像: コレクション画面に見えていた所有済みタイル全てが元々あった場所に、
          ぼやけた薄い跡を残す（ベール中は自然には消さない）。再生ボタンのタップで
          ブラー背景と同じタイミングでふっと消え、星雲だけの画面に切り替わる
          （ホームの再生時と同じ背景にする）。afterimages が無い（ホーム等から
          開いた）ときは出さない。 */}
      {afterimageItems.length > 0 && (
        <Animated.View style={[styles.veilBgLayer, veilBgStyle]} pointerEvents="none">
          {afterimageItems.map((it, i) => (
            <CardAfterimage key={i} uri={it.uri} origin={it.origin} />
          ))}
        </Animated.View>
      )}

      {/* 背景をタップして閉じる動きは廃止（2026-09-24）。カードを払う・裏返す
          ときに指が外れて、意図せず画面が閉じることがあったため。戻るのは
          左上の「‹ 戻る」だけ。 */}

      {/* 上部導線: 戻る（コレクション/ホームどちらから開いたかで文言を出し分け）/ 共有
          （旧ストーリー導線は廃止）。タイトル等（headerAnimStyle）とは切り離し、
          カードの着地と同時に出す＝ベール中（再生前）でも戻れることが分かるように。 */}
      <Animated.View style={[styles.topNav, { paddingTop: navTop }, navAnimStyle]}>
        <Pressable onPress={onBackHome} hitSlop={10}>
          <Text style={styles.navText}>{backLabel}</Text>
        </Pressable>
        <View style={styles.navGroup}>
          {/* お気に入りの★は廃止（2026-09-24）。★は「ウィッシュリスト」の意味に
              統一した。所有曲の整理はプレイリストで行う。 */}
          <Pressable onPress={onShare} hitSlop={10} accessibilityLabel="共有">
            <ShareIcon />
          </Pressable>
        </View>
      </Animated.View>

      {/* 曲名（カードの上・左寄せ）。ヘッダーと同じタイミングでフェードイン */}
      <Animated.View style={[styles.meta, headerAnimStyle]}>
        <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
        {/* 曲名の下の一行は、中身が無くても高さを常に確保する（2026-09-25）。
            以前は「読み込み中…」が出たり消えたりするたびにカードの置き場の高さが
            変わり、3D カードの描画面の大きさも変わって、描き直されないまま
            引き伸ばされた古い絵が後ろからはみ出し、カードが二重に見えていた */}
        <Text
          style={[
            styles.metaSub,
            error ? styles.err : track.preview ? styles.previewNote : styles.subtitle,
          ]}
          numberOfLines={1}
        >
          {error
            ? error
            : track.preview
            ? '試聴中・購入すると全編を聴けます'
            : phase === 'playing' && loading
            ? '読み込み中…'
            : ' '}
        </Text>
      </Animated.View>

      {/* 共有カード（指でなぞって全方向360°回転・厚みつき） */}
      <View
        style={styles.cardArea}
        onLayout={(ev: LayoutChangeEvent) =>
          setCardArea({
            x: ev.nativeEvent.layout.x,
            y: ev.nativeEvent.layout.y,
            w: ev.nativeEvent.layout.width,
            h: ev.nativeEvent.layout.height,
          })
        }
      >
        {/* コレクションのグリッド位置から中央フォーカス位置へ拡大しながら移動し、
            再生ボタンのタップでさらに一回り拡大する。CardGL自体のサイズは固定し、
            wrapperのtranslate/scaleで見かけを変える（3Dシーンの再初期化を避けるため）。
            背後の靄（発光・影レイヤー）は廃止し、カードの縁がくっきり見えるようにする。 */}
        {cardBlock}
      </View>

      {/* ベール（再生前）: 再生ボタンだけを大きく置く。カードが着地する頃に
          ふわっと出現し、タップで即フェードアウトする */}
      {veilButtonVisible && (
        <Animated.View style={[styles.veilControls, playBtnAnimStyle]}>
          <Pressable
            style={({ pressed }) => [styles.veilPlay, pressed && { opacity: 0.8 }]}
            onPress={startPlayback}
            hitSlop={12}
            accessibilityLabel="再生"
          >
            <View style={styles.veilPlayGlow} />
            <PlayMark size={26} />
          </Pressable>
        </Animated.View>
      )}

      {/* トランスポート（再生フェーズのみ・星空の上に直接配置）。
          再生ボタンのタップから350ms遅れて下からフェードイン。 */}
      {phase === 'playing' && (
      <Animated.View style={[styles.transport, { marginBottom: transportBottom }, controlsAnimStyle]}>
        {/* 試聴で流している曲には HOME と同じ購入ボタン。所有曲では場所だけ空ける */}
        {queueHasPreview && (
          <View style={styles.buySlot}>
            {track.preview && (
              <OrbitBuyButton
                priceLabel={purchase?.displayPriceOf(track.id)}
                priceJpy={track.priceJpy}
                state={purchase?.state === 'busy' ? 'pending' : 'idle'}
                onPress={openBuy}
              />
            )}
          </View>
        )}
        {/* シークバー（上下拡張の当たり領域でタップシーク） */}
        <View
          style={styles.seekHit}
          onLayout={(ev: LayoutChangeEvent) => setSeekW(ev.nativeEvent.layout.width)}
          {...seekPan.panHandlers}
        >
          <View style={styles.seekTrack}>
            <View style={[styles.seekFill, { width: `${shownProgress * 100}%` }]} />
          </View>
          {/* つまみ。引いている間だけ大きくする */}
          <View
            pointerEvents="none"
            style={[
              styles.seekKnob,
              scrub != null && styles.seekKnobActive,
              { left: `${shownProgress * 100}%` },
            ]}
          />
        </View>
        {/* 時間（引いている間は、離したら飛ぶ先の時刻を出す） */}
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatTime(shownProgress * duration)}</Text>
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>
        {/* コントロール: EQ(再生中) / 戻し・再生停止・送り / ループ。
            曲送り・戻しは所有が2曲以上のときだけ有効（親が渡すかで決まる）。 */}
        <View style={styles.controls}>
          <View style={styles.eqSlot}>
            <EqBars active={playing} />
          </View>
          <View style={styles.navGroup}>
            <Pressable
              style={[styles.skipBtn, !onPrevTrack && styles.skipDisabled]}
              onPress={onPrevPress}
              disabled={!onPrevTrack}
              hitSlop={12}
              accessibilityLabel="前の曲"
            >
              <SkipPrevIcon size={16} />
            </Pressable>
            <Pressable
              style={styles.playBtn}
              onPress={togglePlay}
              hitSlop={10}
              accessibilityLabel={playing ? '一時停止' : '再生'}
            >
              {playing ? <PauseMark size={22} /> : <PlayMark size={22} />}
            </Pressable>
            <Pressable
              style={[styles.skipBtn, !onNextTrack && styles.skipDisabled]}
              onPress={onNextPress}
              disabled={!onNextTrack}
              hitSlop={12}
              accessibilityLabel="次の曲"
            >
              <SkipIcon size={16} />
            </Pressable>
          </View>
          <Pressable
            style={styles.loopBtn}
            onPress={() => pb.setRepeat(loop ? 'ring' : 'one')}
            hitSlop={10}
            accessibilityLabel={loop ? '1曲リピート中（押すと全曲ループ）' : '全曲ループ中（押すと1曲リピート）'}
          >
            <LoopIcon size={16} on={loop} />
          </Pressable>
        </View>
      </Animated.View>
      )}
      <PurchaseModal
        visible={buyTarget != null}
        target={
          buyTarget
            ? {
                id: buyTarget.id,
                title: buyTarget.title,
                priceLabel: purchase?.displayPriceOf(buyTarget.id) ?? formatPrice(TRACK_PRICE_JPY),
                artworkUrl: buyTarget.artworkUrl,
              }
            : null
        }
        state={purchase?.state ?? 'idle'}
        reason={purchase?.reason}
        onConfirm={() => {
          if (buyTarget) purchase?.start(buyTarget.id, buyTarget.priceJpy);
        }}
        onCancel={() => {
          setBuyTarget(null);
          purchase?.dismiss();
        }}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05040C' },
  topNav: {
    // 既定値。実機では SafeArea の top を加味して JSX 側で上書き
    paddingTop: 52,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  // 戻るリンク（backLabel）: 13px（視認性向上のため12→13へ1段階拡大）/ 字間0.5
  // （2026-09-22 指示で 1.0 から半分に）/ rgba(236,238,247,.55) / 明朝
  navText: {
    color: 'rgba(236,238,247,0.55)',
    fontSize: 13,
    letterSpacing: 0.5,
    fontFamily: JP_SERIF_FONT,
  },
  // overflow:hidden で、CardGL の描画キャンバス（flip裏面ぶん拡大されて
  // レイアウト枠からはみ出す）がヘッダー領域まで侵食してタップを奪わないよう、
  // このエリア自身の高さでクリップする（見た目上も裏面は十分収まるサイズ）。
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // ベール中に星雲(NebulaGL)の上へ重ねる「コレクションをぼかしたような暗い幕」。
  // 再生ボタンのタップで veilBgOpacity が 1→0 になり、透けて星雲が見える＝クロスフェード。
  veilBgLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  veilBgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.18 },
  veilScrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(8,7,20,0.78)',
  },
  // ベールの再生ボタン（大きめ・シアングロー）
  veilControls: { alignItems: 'center', justifyContent: 'center', marginBottom: 72 },
  veilPlay: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: 'rgba(120,220,240,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  veilPlayGlow: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(96,206,224,0.14)',
  },
  // 曲名（カード上・左寄せ）
  previewNote: { color: COLOR.auraCyan, fontSize: 11.5, letterSpacing: 0.6 },
  buySlot: { height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  meta: { alignItems: 'flex-start', paddingHorizontal: SPACE.lg, gap: 4, marginTop: 12, marginBottom: 24 },
  // 白鉛筆 III（仮）: 22px / 字間1.5 / #ECEEF7 / 明朝・太字すぎない
  title: { color: COLOR.textPrimary, fontSize: 22, fontWeight: '500', letterSpacing: 1.5, fontFamily: JP_SERIF_FONT },
  subtitle: { color: COLOR.textSecondary, fontSize: 13, letterSpacing: 0.3, fontFamily: JP_SERIF_FONT },
  err: { color: COLOR.badge, fontSize: 12, marginTop: 4, fontFamily: JP_SERIF_FONT },
  metaSub: { height: 18, lineHeight: 18 },
  // フロスト枠は廃止。星空の上に直接コントロールを置く（余白のみ）
  transport: {
    marginHorizontal: SPACE.lg,
    // 既定値。実機では SafeArea の bottom を加味して JSX 側で上書き
    marginBottom: 40,
  },
  // 上下拡張のタップ当たり領域（見た目バーは中央）
  seekHit: { height: 24, justifyContent: 'center', marginBottom: SPACE.xs },
  seekTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(236,238,247,0.15)',
    justifyContent: 'center',
  },
  seekKnob: {
    position: 'absolute',
    top: 12 - 4,
    width: 8,
    height: 8,
    marginLeft: -4,
    borderRadius: 4,
    backgroundColor: COLOR.auraCyan,
  },
  seekKnobActive: { top: 12 - 7, width: 14, height: 14, marginLeft: -7, borderRadius: 7 },
  seekFill: {
    height: 2,
    borderRadius: 1,
    backgroundColor: COLOR.auraCyan,
    shadowColor: COLOR.auraCyan,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.sm, marginBottom: SPACE.md },
  // 再生時間＝数字表記
  // 11px / rgba(236,238,247,.6)
  time: { color: 'rgba(236,238,247,0.6)', fontSize: 11, letterSpacing: 0.3, fontFamily: NUM_FONT },
  // EQ(左) / 戻し・再生・送り(中央) / ループ(右)。左右を同じ幅で揃えて中央グループを視覚的に中央へ
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eqSlot: { width: 32, alignItems: 'flex-start', justifyContent: 'center' },
  navGroup: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  skipBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },
  // 1曲しか持っていないときは押せないことが分かる淡さにする
  skipDisabled: { opacity: 0.28 },
  // 丸い縁取り・グローは廃止し、アイコンだけを表示する（指定デザイン準拠）。
  // タップ領域はアイコンサイズに hitSlop を足して確保する。
  playBtn: {
    width: TRANSPORT.playBtnSize,
    height: TRANSPORT.playBtnSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loopBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },
});

export default PlayerScreen;
