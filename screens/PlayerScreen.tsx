/**
 * PlayerScreen.tsx — カードを眺める画面（旧・再生画面）
 * ------------------------------------------------------------------
 * 2026-09-25 岡さん案で「再生画面」から改めた。再生の操作は下の再生バナーだけに
 * 集め、この画面には再生の操作（再生／一時停止・シーク・前後・ループ）を置かない。
 *
 *   ・カードを大きく見せる。タップで裏返し、裏面は指で回して眺められる（HOME と同じ）
 *   ・左右に払うと、開いたリストの中の前後のカードを見られる。見るだけで、流れている
 *     曲は変わらない（曲を送るのは再生バナー）
 *   ・払ったときのカードの間隔・指への付き方・離したあとの寄せは HOME と同じ
 *     （「カード間の距離が長い」との指摘。以前は 1 枚が画面の外まで飛んでから次が
 *     入ってくる作りだった）
 *   ・下に再生バナーを出したまま（親が footer で渡す）
 *   ・曲名の下に、いま見ているカードが流れている曲なら「再生中／一時停止中」、
 *     そうでなければ「この曲を再生」（2026-09-26。払った先・別のリストのカードの曲へ
 *     移る方法が無かった。岡さん相談②）。押すと、この並びをその曲から流す
 *
 * 札の並べ方は HOME（screens/DiscoverScreen.tsx）の輪の仕組みを小さくしたもの:
 *   ・札の位置は UI スレッドの dragX だけで決まり、絵柄が差し替わるのは画面の外の札だけ
 *   ・静止中は中央を 3D カード（CardGL）が受け持ち、動いている間は平らな札に任せる
 *   ・3D カードが新しい絵を出し終えてから中央を渡す（見送ったら少し置いてやり直す）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { CardGL, CARD_ASPECT, CARD_BACK_SCALE_MAX } from '../components/CardGL';
import { CardFace } from '../components/CardFace';
import { NebulaGL } from '../components/NebulaGL';
import { PlayMark, ShareIcon } from '../components/icons';
import { COLOR, SPACE, homeCardWidth } from '../constants/design-tokens';
import { JP_SERIF_FONT, NUM_FONT } from '../constants/fonts';
import { SWIPE_SPRING, swipeDirection } from '../constants/swipe';
import { useTopInset, useBottomInset } from '../lib/safeArea';
import { usePlaybackOptional } from '../lib/playback';
import { useT } from '../lib/i18n';

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
  /** 試聴として流す（まだ持っていない曲）。再生の中枢は試聴音源で鳴らす */
  preview?: boolean;
  /** 試聴の音源 URL（Firestore tracks/{id}.previewUrl）。無ければ audioKey から組む */
  previewUrl?: string | null;
  /** 購入時点の価格（円）。購入の記録用 */
  priceJpy?: number;
};

type Props = {
  /** 眺めるカードの並び（開いたリストの曲順）。空にしないこと */
  tracks: PlayerTrack[];
  /** 最初に見せるカード */
  startId: string;
  /** 左上の戻る導線の文言 */
  backLabel?: string;
  onBackHome: () => void;
  /** 画面の下に置くもの（再生バナー） */
  footer?: React.ReactNode;
  /** 「この曲を再生」。この並びをその曲から流す（親が再生の中枢へ渡す） */
  onPlayHere?: (trackId: string) => void;
};

/** 輪の札の枚数。見えるのは中央 ±1 枚ぶんだけ。2.5 枚ぶん外で絵柄を差し替える */
const RING = 5;
/** 払う操作が始まる横の移動量＝タップとの境目（HOME と同じ） */
const CAR_AXIS = 6;
/** 縦にこれだけ先行したら払う操作をやめる（HOME と同じ） */
const CAR_FAIL_Y = 24;
/** カードがこれ以上傾いたら（裏返し始めたら）中央の平らな札を外す(度) */
const FLIP_HIDE_DEG = 6;
/**
 * 隣の札との間隔。HOME と同じ式（参照 STEP = 190 + 188.59/2 + 188.59×0.2 を、
 * 参照のカード幅 188.59 に対するこの画面のカード幅の比で伸縮）
 */
const stepOf = (cardW: number) => (190 + 188.59 / 2 + 188.59 * 0.2) * (cardW / 188.59);
/**
 * カードの下に並ぶ番号・曲名・状態の一行の高さ。styles の info〜sub の内訳と揃える
 *   カードとの間 20 ＋ 番号 16 ＋ 6 ＋ 曲名 28 ＋ 10 ＋ 状態か「この曲を再生」34
 * コレクションの作品詳細と同じ並び（カードの真下に番号と曲名）。
 */
const INFO_GAP = 20;
const INFO_H = INFO_GAP + 16 + 6 + 28 + 10 + 34;

/** 輪の札 1 枚（平らな絵）。絵柄が変わらないかぎり描き直さない */
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

export const PlayerScreen: React.FC<Props> = ({
  tracks,
  startId,
  backLabel = '‹ 戻る',
  onBackHome,
  footer,
  onPlayHere,
}) => {
  const t = useT();
  const pb = usePlaybackOptional();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const navTop = useTopInset(8);
  const bottomPad = useBottomInset(12);
  const count = tracks.length;

  // カードは HOME よりひと回り大きく見せる（「カードを愛でる」）。カードと、その下の
  // 番号・曲名を一つの塊にして残りの縦幅の中央に置く（2026-09-25。以前は曲名が
  // 左上・カードが中央で、縦に長い端末ほど離れて見えた）。塊が収まらない小さな
  // 端末では、カードのほうを縮めて収める
  const [cardArea, setCardArea] = useState({ w: 0, h: 0 });
  const fitW = cardArea.h > 0 ? (cardArea.h - INFO_H - 16) / CARD_ASPECT : Infinity;
  const cardW = Math.floor(Math.max(120, Math.min(screenW - 96, 240, fitW)));
  const cardH = Math.round(cardW * CARD_ASPECT);
  // 裏面の絶対サイズは HOME と揃える（HOME の裏面幅から逆算した倍率）
  const backScale = (homeCardWidth(screenH) * CARD_BACK_SCALE_MAX) / cardW;
  const step = stepOf(cardW);
  // 塊の中でのカードの中心（領域の上端から）。番号・曲名はこの下に置く
  const cardCenterY = (cardArea.h - INFO_H) / 2;
  const cardFrame = useMemo(() => ({ width: cardArea.w, height: cardArea.h }), [cardArea.w, cardArea.h]);

  // ── 通し番号（HOME と同じ。送るたびに ±1。曲は tracks[通し番号 mod 曲数]） ──
  const startIndex = Math.max(0, tracks.findIndex((x) => x.id === startId));
  const [pos, setPos] = useState(startIndex);
  const posRef = useRef(startIndex);
  const posAtMountRef = useRef(startIndex);
  const posAtMount = posAtMountRef.current;
  // 曲名が指している札（指を離した時点で行き先へ進む）
  const [chromePos, setChromePos] = useState(startIndex);
  const aimRef = useRef(startIndex);
  const trackAt = (p: number) => tracks[((p % count) + count) % count];
  const active = trackAt(pos);
  const shown = trackAt(chromePos) ?? active;

  // ── UI スレッドの値 ──
  const dragX = useSharedValue(0);
  const committedSV = useSharedValue(0);
  const gestureStart = useSharedValue(0);
  const grabOrigin = useSharedValue(0);
  const settleActive = useSharedValue(0);
  const settleTarget = useSharedValue(0);
  const dragging = useSharedValue(0);
  const claimed = useSharedValue(0);
  const cardRotation = useSharedValue(0);
  /** 1 = 中央を 3D カードが描いている / 0 = 平らな札が描いている */
  const glOn = useSharedValue(0);
  /** 0 = マウント直後。札のマウント時の値を「非表示」にしておくため */
  const ringReady = useSharedValue(0);
  useEffect(() => {
    ringReady.value = 1;
  }, [ringReady]);
  const carBusy = useDerivedValue(() =>
    settleActive.value > 0.5 || Math.abs(dragX.value - committedSV.value) > 0.5 ? 1 : 0,
  );
  const [flipped, setFlipped] = useState(false);

  // ── 受け渡し（寄せ終わった位置で札を送る） ──
  const commit = useCallback(
    (target: number) => {
      const next = posAtMountRef.current + Math.round(-target / step);
      if (next === posRef.current) return;
      posRef.current = next;
      setPos(next);
      if (aimRef.current === posRef.current) setChromePos(posRef.current);
      cardRotation.value = 0;
    },
    [step, cardRotation],
  );
  const aimChrome = useCallback(
    (target: number) => {
      const next = posAtMountRef.current + Math.round(-target / step);
      aimRef.current = next;
      setChromePos(next);
    },
    [step],
  );

  // ── 中央を 3D カードへ戻す（新しい絵を出し終えていて、止まっているとき） ──
  const glShownRef = useRef<string | null>(null);
  const activeUriRef = useRef<string | undefined>(undefined);
  activeUriRef.current = active?.artworkUrl;
  const revealRaf = useRef(0);
  const revealRetry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTries = useRef(0);
  const revealGLRef = useRef<() => void>(() => {});
  const restXOf = useCallback(
    () => -(posRef.current - posAtMountRef.current) * step,
    [step],
  );
  const retryReveal = useCallback(() => {
    if (revealRetry.current) clearTimeout(revealRetry.current);
    if (revealTries.current >= 30) return;
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
        runOnUI((restX: number) => {
          'worklet';
          if (
            settleActive.value > 0.5 ||
            dragging.value > 0.5 ||
            Math.abs(dragX.value - restX) > 0.5
          ) {
            runOnJS(retryReveal)();
            return;
          }
          committedSV.value = restX;
          glOn.value = 1;
        })(restXOf());
      });
    });
  }, [settleActive, dragging, dragX, committedSV, glOn, restXOf, retryReveal]);
  revealGLRef.current = revealGL;
  // 絵が遅いときの逃げ道: 位置の基準だけ先に送る（中央は平らな札のまま）
  const revealFallback = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  useEffect(() => {
    revealTries.current = 0;
    revealGL();
  }, [active?.artworkUrl, revealGL]);

  const onSettled = useCallback(
    (target: number) => {
      commit(target);
      revealGL();
      armRevealFallback();
    },
    [commit, revealGL, armRevealFallback],
  );

  // 指を離したあとの寄せ（HOME と同じばね・離したときの速さを引き継ぐ）
  const startSettle = useCallback(
    (target: number, velocity: number) => {
      'worklet';
      settleTarget.value = target;
      settleActive.value = 1;
      dragX.value = withSpring(target, { ...SWIPE_SPRING, velocity }, (finished) => {
        'worklet';
        if (!finished) return;
        settleActive.value = 0;
        if (Math.abs(target - committedSV.value) > 0.5) glOn.value = 0;
        runOnJS(onSettled)(target);
      });
    },
    [dragX, settleActive, settleTarget, committedSV, glOn, onSettled],
  );

  // ── 払う操作（HOME と同じ。裏返している間は無効） ──
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!flipped && count > 1)
        .activeOffsetX([-CAR_AXIS, CAR_AXIS])
        .failOffsetY([-CAR_FAIL_Y, CAR_FAIL_Y])
        .onBegin(() => {
          'worklet';
          claimed.value = Math.abs(cardRotation.value) < 90 ? 1 : 0;
        })
        .onStart((e) => {
          'worklet';
          if (!claimed.value) return;
          dragging.value = 1;
          const wasSettling = settleActive.value > 0.5;
          cancelAnimation(dragX);
          settleActive.value = 0;
          if (wasSettling) {
            grabOrigin.value = settleTarget.value;
            gestureStart.value = dragX.value - e.translationX;
          } else {
            const b = committedSV.value;
            grabOrigin.value = b + Math.round((dragX.value - b) / step) * step;
            gestureStart.value = dragX.value;
          }
        })
        .onUpdate((e) => {
          'worklet';
          if (!claimed.value) return;
          dragX.value = gestureStart.value + e.translationX;
        })
        .onEnd((e) => {
          'worklet';
          dragging.value = 0;
          if (!claimed.value) return;
          const dir = swipeDirection(e.translationX, e.velocityX, cardW);
          let target = grabOrigin.value - dir * step;
          const b = committedSV.value;
          target = Math.min(b + 2 * step, Math.max(b - 2 * step, target));
          runOnJS(aimChrome)(target);
          startSettle(target, e.velocityX);
        })
        .onFinalize(() => {
          'worklet';
          claimed.value = 0;
          dragging.value = 0;
        }),
    [
      flipped,
      count,
      claimed,
      cardRotation,
      dragging,
      settleActive,
      dragX,
      grabOrigin,
      settleTarget,
      gestureStart,
      committedSV,
      step,
      cardW,
      aimChrome,
      startSettle,
    ],
  );

  // ── 輪の札の位置と出し入れ（UI スレッドだけで決まる） ──
  const useRingSlotStyle = (i: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => {
      const c = posAtMount - dragX.value / step;
      const tt = i + RING * Math.round((c - i) / RING);
      const rel = tt - c;
      let op = ringReady.value;
      if (Math.abs(rel) > 0.5 && carBusy.value < 0.5) op = 0;
      if (tt === pos && glOn.value > 0.5) op = 0;
      // 裏返し始めたら、3D カードが中央にいるかぎり平らな札は外す
      if (
        tt === pos &&
        Math.abs(cardRotation.value) > FLIP_HIDE_DEG &&
        Math.abs(dragX.value - committedSV.value) < 0.5
      )
        op = 0;
      return { opacity: op, transform: [{ translateX: rel * step }] };
    }, [pos, step, posAtMount]);
  const ring0 = useRingSlotStyle(0);
  const ring1 = useRingSlotStyle(1);
  const ring2 = useRingSlotStyle(2);
  const ring3 = useRingSlotStyle(3);
  const ring4 = useRingSlotStyle(4);
  const ringStyles = useMemo(() => [ring0, ring1, ring2, ring3, ring4], [ring0, ring1, ring2, ring3, ring4]);
  const ringTracks = Array.from({ length: RING }, (_, i) =>
    trackAt(i + RING * Math.round((pos - i) / RING)),
  );
  const ringKey = ringTracks.map((x) => x?.artworkUrl ?? '').join('|');
  const glStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value - committedSV.value }],
  }));

  // 隣の札の絵も 3D カードへ先に渡しておく（受け渡しの待ちを短くする）
  const prevUri = trackAt(pos - 1)?.artworkUrl;
  const nextUri = trackAt(pos + 1)?.artworkUrl;
  const preloadUris = useMemo(
    () => (count > 1 ? ([prevUri, nextUri].filter(Boolean) as string[]) : []),
    [count, prevUri, nextUri],
  );
  const backData = useMemo(
    () => ({
      title: active.title,
      serial: active.serial,
      story: active.story ?? active.subtitle,
      tuning: active.tuning,
      frequencies: active.frequencies,
      artist: active.artist ?? 'NAOKI OKA',
      useCases: active.useCases,
    }),
    [active],
  );

  const cardLayer = useMemo(
    () => (
      <View style={styles.slot} pointerEvents="box-none">
        <Animated.View style={[styles.slot, glStyle]} pointerEvents="box-none">
          <CardGL
            mode="flip"
            frontUri={active.artworkUrl}
            preloadUris={preloadUris}
            width={cardW}
            height={cardH}
            depthRatio={0.016}
            frame={cardFrame}
            backScale={backScale}
            onFlipChange={setFlipped}
            onFrontShown={handleFrontShown}
            rotationOut={cardRotation}
            backData={backData}
          />
        </Animated.View>
        {ringTracks.map((tr, i) =>
          tr ? (
            <RingSlot key={i} style={ringStyles[i]} uri={tr.artworkUrl} width={cardW} height={cardH} />
          ) : null,
        )}
      </View>
    ),
    // ringTracks は毎回作り直す配列なので、中身を表す ringKey で比べる
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ringKey, ringStyles, glStyle, active, preloadUris, cardW, cardH, cardFrame, backScale, handleFrontShown, cardRotation, backData],
  );

  // 番号・曲名の出し入れ。札を払っている間は札が中央から離れるほど薄くし（行き先の
  // 曲名は指を離した時点で差し替わる）、裏返すと消す（裏面はひと回り大きくなって
  // 真下の文字にかかる。HOME の左上の曲名と同じく裏面では表の情報を出さない）
  const infoFade = useAnimatedStyle(() => {
    const f = dragX.value / step;
    const off = Math.abs(f - Math.round(f)); // 0 = 札が真ん中 / 0.5 = 札と札の中間
    const r = Math.abs(cardRotation.value) % 360;
    const tilt = Math.min(r, 360 - r);
    const op =
      interpolate(off, [0, 0.35], [1, 0], Extrapolation.CLAMP) *
      interpolate(tilt, [0, 45], [1, 0], Extrapolation.CLAMP);
    return { opacity: op };
  }, [step]);

  const onShare = useCallback(() => {
    Share.share({ message: `FLUX RING — ${shown.title}` }).catch(() => {});
  }, [shown.title]);

  // 見ているカードが流れている曲なら、その状態を一行で
  const isPlayingCard = !!pb?.current && pb.current.id === shown.id;
  const sub = isPlayingCard ? (pb?.playing ? t('playback.playing') : t('playback.paused')) : ' ';
  const canPlayHere = !isPlayingCard && !!onPlayHere;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#05040C" />
      <NebulaGL />

      <View style={[styles.topNav, { paddingTop: navTop }]}>
        <Pressable onPress={onBackHome} hitSlop={10} accessibilityRole="button">
          <Text style={styles.navText}>{backLabel}</Text>
        </Pressable>
        <Pressable onPress={onShare} hitSlop={10} accessibilityRole="button" accessibilityLabel="共有">
          <ShareIcon />
        </Pressable>
      </View>

      <View
        style={styles.cardArea}
        onLayout={(ev: LayoutChangeEvent) =>
          setCardArea({ w: ev.nativeEvent.layout.width, h: ev.nativeEvent.layout.height })
        }
      >
        {cardArea.h > 0 && (
          <>
            {/* 札の舞台は下を INFO_H だけ空け、カードを塊の上側に置く */}
            <GestureDetector gesture={gesture}>
              <View style={[styles.stage, { bottom: INFO_H }]} pointerEvents="box-none">
                {cardLayer}
              </View>
            </GestureDetector>

            <Animated.View
              style={[styles.info, { top: cardCenterY + cardH / 2 + INFO_GAP }, infoFade]}
              // 裏返している間は文字が消えているので、ボタンも押せないようにする
              pointerEvents={flipped ? 'none' : 'box-none'}
            >
              <Text style={styles.no} numberOfLines={1}>{shown.serial ?? ' '}</Text>
              <Text style={styles.title} numberOfLines={1}>{shown.title}</Text>
              <View style={styles.subRow} pointerEvents="box-none">
                {canPlayHere ? (
                  <Pressable
                    onPress={() => onPlayHere?.(shown.id)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.playHere, pressed && styles.playHerePressed]}
                    accessibilityRole="button"
                    accessibilityLabel={t('playback.playThis')}
                  >
                    <PlayMark size={13} color={COLOR.auraCyan} />
                    <Text style={styles.playHereText}>{t('playback.playThis')}</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.sub, isPlayingCard && styles.subOn]} numberOfLines={1}>{sub}</Text>
                )}
              </View>
            </Animated.View>
          </>
        )}
      </View>

      <View style={{ paddingBottom: bottomPad }}>{footer}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05040C' },
  topNav: {
    paddingTop: 52,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navText: {
    color: COLOR.textBack, // 全画面共通の「戻る」の色（作品詳細と同じ）
    fontSize: 13,
    letterSpacing: 0.5,
    fontFamily: JP_SERIF_FONT,
  },
  // カードの真下の番号・曲名・状態（高さは INFO_H の内訳）。コレクションの作品詳細と同じ字組
  info: { position: 'absolute', left: SPACE.lg, right: SPACE.lg, alignItems: 'center' },
  no: {
    height: 16,
    lineHeight: 16,
    fontSize: 11,
    letterSpacing: 2.2,
    color: COLOR.textSecondary,
    fontFamily: NUM_FONT,
  },
  title: {
    marginTop: 6,
    height: 28,
    lineHeight: 28,
    maxWidth: '100%',
    color: COLOR.textPrimary,
    fontSize: 21,
    letterSpacing: 1.26,
    fontFamily: JP_SERIF_FONT,
  },
  // 状態の一行か「この曲を再生」。どちらでも高さは同じ（切り替わっても上が動かない）
  subRow: { marginTop: 10, height: 34, alignItems: 'center', justifyContent: 'center' },
  sub: {
    height: 18,
    lineHeight: 18,
    color: COLOR.textSecondary,
    fontSize: 11,
    letterSpacing: 0.9,
  },
  // 控えめな副ボタン（主役はカード）。枠と字はシアン、地は透かし
  playHere: {
    height: 34,
    paddingHorizontal: 18,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.45)',
    backgroundColor: 'rgba(14,14,40,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  playHerePressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  playHereText: { color: COLOR.textPrimary, fontSize: 12, letterSpacing: 1.6 },
  subOn: { color: COLOR.auraCyan },
  // 3D カードの描画面が上の見出しへはみ出してタップを奪わないよう、ここで切る
  cardArea: { flex: 1, overflow: 'hidden' },
  stage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  slot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PlayerScreen;
