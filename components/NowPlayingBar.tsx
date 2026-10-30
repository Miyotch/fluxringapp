import { SleepTimerButton } from './SleepTimerButton';
/**
 * NowPlayingBar.tsx — どの画面でもフッターのすぐ上に出る再生バナー
 * ------------------------------------------------------------------
 * 2026-10-13 小さい版へ（Spotify のミニプレイヤーの形）。
 *   ・1 行: アートの小さな札／曲名・作家名／前・再生/一時停止・次
 *   ・下端に細い進み具合の線。線の上下に指の当たりを広げてあり、ドラッグで再生位置を動かせる
 *     （触っている間は線が太くなり、時間が出る）
 *   ・押すと再生画面（カードを眺める画面）を開く
 *   ・左右に払うと、札と曲名が指について動き、離すと画面の外へ抜けて次（前）の曲が
 *     反対側から入ってくる（以前は 6 割だけ動いて元の位置へ戻っていた）
 *   ・何も流していない（キューが空）ときは描かない。一時停止中は出たまま
 *   ・2026-10-19 下に払うとバナーを隠せる（岡さん指定）。音は止めない。次に何かを
 *     流し始めたとき（キューが替わったとき）にまた出る。隠す・出すは App が持つ（hidden）
 *   ・2026-10-20 隠している間は、フッターのすぐ上に小さなつまみ（流れていれば EQ の棒）を
 *     残す。押すか上に払うとバナーが戻る（戻す手がかりが無かった。岡さん指摘）
 *   ・2026-10-15 払う動きを PanResponder＋RN Animated から RNGH の Pan＋Reanimated へ移した。
 *     以前は指の位置を JS で受けてから札へ書いていたので、再生の状態更新・カードの描画で
 *     JS が詰まると指から遅れ、離したあとの寄せも途中で書き戻されて小刻みに揺れた。
 *     いまは指の追従・寄せ・抜けて入る動きがすべて UI スレッドで完結する（曲の切り替えだけ JS）
 *
 * 位置の更新（0.25 秒ごと）は usePlaybackProgress で受け、SeekLine だけが描き直す。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SWIPE_SPRING, swipeDirection } from '../constants/swipe';
import { homeCardWidth } from '../constants/design-tokens';
import { usePlayback, usePlaybackProgress } from '../lib/playback';
import { PlayMark, PauseMark, SkipIcon, SkipPrevIcon, LoopIcon, AddToListIcon } from './icons';
import { DownloadButton } from './DownloadButton';
import { EqBars } from './EqBars';
import { useT } from '../lib/i18n';
import { JP_SERIF_FONT, NUM_FONT } from '../constants/fonts';
import { durationOf } from '../lib/durations';
import type { PlayerTrack } from '../screens/PlayerScreen';

type Props = {
  onOpen: () => void;
  /** 下に払って隠したあと。true の間は描かない */
  hidden?: boolean;
  /** 下に払った（隠す） */
  onHide?: () => void;
  /** 隠したあとのつまみを押した／上に払った（戻す） */
  onShow?: () => void;
  /** 高さが変わったとき（HOME で購入ボタンを逃がす量に使う） */
  onLayout?: (e: LayoutChangeEvent) => void;
};

/** バナーの高さ（線の当たりを含む） */
const BAR_H = 58;
/** 線の当たりの高さ。下端からこの範囲を押す／ドラッグすると再生位置が動く */
const SEEK_HIT_H = 16;

const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * 下端の細い進み具合の線。押す／ドラッグでその位置へ。指を離すまでは表示だけ動かし、
 * 離した位置へ飛ぶ（ドラッグ中に音が細切れに飛ばないように）
 */
const SeekLine: React.FC = () => {
  const { position, duration } = usePlaybackProgress();
  const pb = usePlayback();
  const pbRef = useRef(pb);
  pbRef.current = pb;
  const durRef = useRef(duration);
  durRef.current = duration;
  const [drag, setDrag] = useState<number | null>(null);
  const widthRef = useRef(0);
  const pos = drag ?? position;
  const p = duration > 0 ? Math.min(1, pos / duration) : 0;

  const at = (x: number) =>
    widthRef.current > 0 ? Math.max(0, Math.min(1, x / widthRef.current)) * durRef.current : 0;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // バナーの横払い（曲送り）に取られないように、つかんだら離さない
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => setDrag(at(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => setDrag(at(e.nativeEvent.locationX)),
      onPanResponderRelease: (e) => {
        pbRef.current.seekTo(at(e.nativeEvent.locationX));
        setDrag(null);
      },
      onPanResponderTerminate: () => setDrag(null),
    }),
  ).current;

  const seeking = drag != null;
  return (
    <View
      style={styles.seekHit}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
      }}
      {...pan.panHandlers}
      accessibilityRole="adjustable"
      accessibilityValue={{ text: `${fmt(pos)} / ${fmt(duration)}` }}
    >
      {seeking && (
        <Text style={styles.seekTime} pointerEvents="none">{`${fmt(pos)} / ${fmt(duration)}`}</Text>
      )}
      <View style={[styles.rail, seeking && styles.railOn]} pointerEvents="none">
        <View style={[styles.fill, { width: `${p * 100}%` }]} />
      </View>
    </View>
  );
};

/** 下に払って隠すと決める移動量・速さ */
const HIDE_DY = 28;
const HIDE_VY = 600;

export const NowPlayingBar: React.FC<Props> = ({ onOpen, onLayout, hidden = false, onHide, onShow }) => {
  const t = useT();
  const pb = usePlayback();
  const pbRef = useRef(pb);
  pbRef.current = pb;
  // 送る基準は HOME・再生画面と同じ（constants/swipe.ts）。カード幅は HOME のカード
  const { width: screenW, height: screenH } = useWindowDimensions();
  const screenWRef = useRef(screenW);
  screenWRef.current = screenW;
  // 札と曲名の横位置。指に 1:1 でついてくる（UI スレッドで書く）
  const tx = useSharedValue(0);
  const busy = useSharedValue(0);
  const manySV = useSharedValue(0);
  // 描画中に共有値へ書かない（Reanimated の注意）。キューの長さが変わったときだけ写す
  const queueLen = pb.queue.length;
  useEffect(() => {
    manySV.value = queueLen >= 2 ? 1 : 0;
  }, [queueLen, manySV]);
  const cardW = homeCardWidth(screenH);

  /** 抜けきったあと（JS）: 曲を替えて、反対側から入れる */
  const afterOut = (dir: 1 | -1) => {
    if (dir === 1) pbRef.current.next();
    else pbRef.current.prev();
    tx.value = dir * screenWRef.current * 0.5;
    tx.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) }, () => {
      busy.value = 0;
    });
  };

  // 左右に払うと曲送り。縦や小さな動きは取らない（押す＝再生画面を開く、を邪魔しない）
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-14, 14])
        .onUpdate((e) => {
          'worklet';
          if (busy.value) return;
          // 1 曲しかないときは送れないので、ゴムのように少しだけ動かす
          tx.value = manySV.value ? e.translationX : e.translationX * 0.25;
        })
        .onEnd((e) => {
          'worklet';
          if (busy.value) return;
          const dir = swipeDirection(e.translationX, e.velocityX, cardW);
          if (dir !== 0 && manySV.value) {
            busy.value = 1;
            tx.value = withTiming(
              -dir * screenW,
              { duration: 160, easing: Easing.in(Easing.quad) },
              (finished) => {
                if (finished) runOnJS(afterOut)(dir);
                else busy.value = 0;
              },
            );
          } else {
            tx.value = withSpring(0, { ...SWIPE_SPRING, velocity: e.velocityX });
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cardW, screenW],
  );
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  // 下に払うと隠す。上へは動かさない。横の払い（曲送り）とは向きで分ける
  const ty = useSharedValue(0);
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;
  const hideNow = () => onHideRef.current?.();
  useEffect(() => {
    if (!hidden) ty.value = 0;
  }, [hidden, ty]);
  const down = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(12)
        .failOffsetX([-14, 14])
        .onUpdate((e) => {
          'worklet';
          ty.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          'worklet';
          if (e.translationY > HIDE_DY || e.velocityY > HIDE_VY) {
            ty.value = withTiming(BAR_H + 24, { duration: 180, easing: Easing.in(Easing.quad) }, (finished) => {
              if (finished) runOnJS(hideNow)();
            });
          } else {
            ty.value = withSpring(0, { ...SWIPE_SPRING, velocity: e.velocityY });
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const downStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
    opacity: 1 - Math.min(1, ty.value / (BAR_H + 24)) * 0.8,
  }));

  // 隠したあとのつまみ。上に払っても戻す
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  const showNow = () => onShowRef.current?.();
  const up = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(-8)
        .onEnd((e) => {
          'worklet';
          if (e.translationY < -12 || e.velocityY < -300) runOnJS(showNow)();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const cur = pb.current;
  if (!cur) return null;
  if (hidden) {
    return (
      <View style={styles.handleWrap} pointerEvents="box-none">
        <GestureDetector gesture={up}>
          <Pressable
            onPress={showNow}
            hitSlop={{ top: 12, bottom: 4, left: 16, right: 16 }}
            style={({ pressed }) => [styles.handle, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel={t('playback.showBar')}
          >
            <View style={styles.handleChevron} />
            <EqBars active={pb.playing} keepIdle />
          </Pressable>
        </GestureDetector>
      </View>
    );
  }
  const many = pb.queue.length >= 2;
  const artist = cur.artistName || cur.artist;
  const sub = pb.loading ? t('playback.loading') : cur.preview ? t('playback.previewing') : artist ?? '';

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <GestureDetector gesture={down}>
      <Animated.View style={[styles.bar, downStyle]}>
        <GestureDetector gesture={swipe}>
        <View style={styles.row} collapsable={false}>
          {/* 札と曲名。押すと再生画面、払うと曲送り（ここだけが指について動く） */}
          <Pressable
            style={styles.openArea}
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={t('playback.open', { title: cur.title })}
          >
            <Animated.View style={[styles.slide, slideStyle]}>
              <Image source={{ uri: cur.artworkUrl }} style={styles.art} />
              <View style={styles.texts}>
                <Text style={styles.title} numberOfLines={1}>{cur.title}</Text>
                {!!sub && <Text style={styles.sub} numberOfLines={1}>{sub}</Text>}
              </View>
            </Animated.View>
          </Pressable>
          <Pressable onPress={pb.prev} hitSlop={6} style={styles.btn} disabled={!many}
            accessibilityRole="button" accessibilityLabel={t('playback.prev')}>
            <View style={!many && styles.off}><SkipPrevIcon size={16} /></View>
          </Pressable>
          <Pressable onPress={pb.toggle} hitSlop={6} style={[styles.btn, styles.playBtn]}
            accessibilityRole="button" accessibilityLabel={pb.playing ? t('playback.pause') : t('playback.play')}>
            {pb.playing ? <PauseMark size={20} color="#0B0B1D" /> : <PlayMark size={20} color="#0B0B1D" />}
          </Pressable>
          <Pressable onPress={pb.next} hitSlop={6} style={styles.btn} disabled={!many}
            accessibilityRole="button" accessibilityLabel={t('playback.next')}>
            <View style={!many && styles.off}><SkipIcon size={16} /></View>
          </Pressable>
        </View>
        </GestureDetector>
        <SeekLine />
      </Animated.View>
      </GestureDetector>
    </View>
  );
};

/**
 * 大きい再生パネル（カードを眺める画面の下）。2026-10-13
 * 詳細は「今の曲を味わう画面」なので、Spotify の再生中画面と同じく操作を大きく出す。
 *   ・1 行目: 流れている曲の札・曲名・作家名／プレイリストに追加／端末に保存
 *   ・時間つきのシークバー（押す・ドラッグ）
 *   ・リピート／前／再生・一時停止（大きな白い丸）／次／（左右の釣り合い用の空き）
 */
const FullSeek: React.FC = () => {
  const { position, duration } = usePlaybackProgress();
  const pb = usePlayback();
  const pbRef = useRef(pb);
  pbRef.current = pb;
  const durRef = useRef(duration);
  durRef.current = duration;
  const [drag, setDrag] = useState<number | null>(null);
  const widthRef = useRef(0);
  const pos = drag ?? position;
  const p = duration > 0 ? Math.min(1, pos / duration) : 0;
  const at = (x: number) =>
    widthRef.current > 0 ? Math.max(0, Math.min(1, x / widthRef.current)) * durRef.current : 0;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => setDrag(at(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => setDrag(at(e.nativeEvent.locationX)),
      onPanResponderRelease: (e) => {
        pbRef.current.seekTo(at(e.nativeEvent.locationX));
        setDrag(null);
      },
      onPanResponderTerminate: () => setDrag(null),
    }),
  ).current;
  const seeking = drag != null;
  return (
    <View>
      <View
        style={full.rail}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
        }}
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityValue={{ text: `${fmt(pos)} / ${fmt(duration)}` }}
      >
        <View style={[full.line, seeking && full.lineOn]} pointerEvents="none">
          <View style={[full.fill, { width: `${p * 100}%` }]} />
        </View>
        <View style={[full.knob, seeking && full.knobOn, { left: `${p * 100}%` }]} pointerEvents="none" />
      </View>
      <View style={full.times}>
        <Text style={[full.time, seeking && { color: '#60CEE0' }]}>{fmt(pos)}</Text>
        <Text style={full.time}>{`-${fmt(Math.max(0, duration - pos))}`}</Text>
      </View>
    </View>
  );
};

/** 何も流していないときの線（動かない） */
const IdleSeek: React.FC<{ duration?: number }> = ({ duration }) => (
  <View>
    <View style={full.rail}>
      <View style={full.line} />
      <View style={[full.knob, { left: 0 }]} />
    </View>
    <View style={full.times}>
      <Text style={full.time}>0:00</Text>
      <Text style={full.time}>{duration ? `-${fmt(duration)}` : ''}</Text>
    </View>
  </View>
);

export const NowPlayingFull: React.FC<{
  /** プレイリストに追加のシートを開く */
  onAddToPlaylist?: (track: { id: string; title: string }) => void;
  /**
   * 何も流していないときに出す待ち受け（見ているカード）。▶ でその曲から流す。
   * 無ければ何も描かない（2026-10-20。起動直後にカード詳細を開くと、パネルが無くて
   * カードが下へずれていた）
   */
  idle?: { track: PlayerTrack; onPlay: () => void };
}> = ({ onAddToPlaylist, idle }) => {
  const t = useT();
  const pb = usePlayback();
  const cur = pb.current;
  if (!cur) {
    if (!idle) return null;
    const it = idle.track;
    return (
      <View style={full.wrap}>
      <SleepTimerButton />
        <View style={full.head}>
          <Image source={{ uri: it.artworkUrl }} style={full.art} />
          <View style={full.texts}>
            <Text style={full.title} numberOfLines={1}>{it.title}</Text>
            <Text style={full.sub} numberOfLines={1}>{it.artistName || it.artist || ''}</Text>
          </View>
          {onAddToPlaylist && (
            <Pressable
              onPress={() => onAddToPlaylist({ id: it.id, title: it.title })}
              hitSlop={6}
              style={({ pressed }) => [full.icon, pressed && full.iconPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('playlist.addTo')}
            >
              <AddToListIcon size={24} />
            </Pressable>
          )}
          <DownloadButton keys={[it.audioKey]} label={it.title} size={24} />
        </View>
        <IdleSeek duration={durationOf(it.audioKey || it.id) ?? it.durationSec} />
        <View style={full.ctrls}>
          <View style={[full.side, styles.off]}>
            <LoopIcon size={20} on={pb.repeat === 'one'} />
          </View>
          <View style={[full.skip, styles.off]}><SkipPrevIcon size={24} /></View>
          <Pressable
            onPress={idle.onPlay}
            style={({ pressed }) => [full.play, pressed && { transform: [{ scale: 0.94 }] }]}
            accessibilityRole="button"
            accessibilityLabel={t('playback.play')}
          >
            <PlayMark size={30} color="#0B0B1D" />
          </Pressable>
          <View style={[full.skip, styles.off]}><SkipIcon size={24} /></View>
          <View style={full.side} />
        </View>
      </View>
    );
  }
  const many = pb.queue.length >= 2;
  const artist = cur.artistName || cur.artist;
  return (
    <View style={full.wrap}>
      <SleepTimerButton />
      <View style={full.head}>
        <Image source={{ uri: cur.artworkUrl }} style={full.art} />
        <View style={full.texts}>
          <Text style={full.title} numberOfLines={1}>{cur.title}</Text>
          <Text style={full.sub} numberOfLines={1}>
            {pb.loading ? t('playback.loading') : cur.preview ? t('playback.previewing') : artist ?? ''}
          </Text>
        </View>
        {!cur.preview && onAddToPlaylist && (
          <Pressable
            onPress={() => onAddToPlaylist({ id: cur.id, title: cur.title })}
            hitSlop={6}
            style={({ pressed }) => [full.icon, pressed && full.iconPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('playlist.addTo')}
          >
            <AddToListIcon size={24} />
          </Pressable>
        )}
        {!cur.preview && <DownloadButton keys={[cur.audioKey]} label={cur.title} size={24} />}
      </View>
      <FullSeek />
      <View style={full.ctrls}>
        <Pressable
          onPress={() => pb.setRepeat(pb.repeat === 'one' ? 'ring' : 'one')}
          hitSlop={8}
          style={full.side}
          accessibilityRole="button"
          accessibilityLabel={t('playback.repeat')}
          accessibilityState={{ selected: pb.repeat === 'one' }}
        >
          <LoopIcon size={20} on={pb.repeat === 'one'} />
        </Pressable>
        <Pressable onPress={pb.prev} hitSlop={8} style={full.skip} disabled={!many}
          accessibilityRole="button" accessibilityLabel={t('playback.prev')}>
          <View style={!many && styles.off}><SkipPrevIcon size={24} /></View>
        </Pressable>
        <Pressable
          onPress={pb.toggle}
          style={({ pressed }) => [full.play, pressed && { transform: [{ scale: 0.94 }] }]}
          accessibilityRole="button"
          accessibilityLabel={pb.playing ? t('playback.pause') : t('playback.play')}
        >
          {pb.playing ? <PauseMark size={28} color="#0B0B1D" /> : <PlayMark size={30} color="#0B0B1D" />}
        </Pressable>
        <Pressable onPress={pb.next} hitSlop={8} style={full.skip} disabled={!many}
          accessibilityRole="button" accessibilityLabel={t('playback.next')}>
          <View style={!many && styles.off}><SkipIcon size={24} /></View>
        </Pressable>
        {/* 左のリピートと釣り合わせる空き */}
        <View style={full.side} />
      </View>
    </View>
  );
};

const full = StyleSheet.create({
  wrap: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  art: { width: 30, height: 47, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' },
  texts: { flex: 1, minWidth: 0 },
  title: { color: '#ECEEF7', fontSize: 16, letterSpacing: 0.8, fontFamily: JP_SERIF_FONT },
  sub: { color: '#9498BE', fontSize: 12, marginTop: 3, letterSpacing: 0.8, fontFamily: JP_SERIF_FONT },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  iconPressed: { backgroundColor: 'rgba(96,206,224,0.12)' },
  rail: { height: 28, justifyContent: 'center', marginTop: 8 },
  line: { height: 3, borderRadius: 2, backgroundColor: 'rgba(236,238,247,0.18)', overflow: 'hidden' },
  lineOn: { height: 5 },
  fill: { height: '100%', backgroundColor: '#60CEE0' },
  knob: { position: 'absolute', top: 8, width: 12, height: 12, borderRadius: 6, marginLeft: -6, backgroundColor: '#ECEEF7' },
  knobOn: { transform: [{ scale: 1.4 }] },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  time: { fontFamily: NUM_FONT, fontSize: 11, color: '#9498BE' },
  ctrls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  side: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  skip: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ECEEF7', alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingBottom: 8 },
  // 隠したあとのつまみ（フッターのすぐ上・中央）
  handleWrap: { alignItems: 'center', paddingBottom: 6 },
  handle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 26,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: 'rgba(20,22,52,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.32)',
  },
  // 上向きの山（つまみの印）
  handleChevron: {
    width: 7,
    height: 7,
    marginTop: 3,
    borderLeftWidth: 1.5,
    borderTopWidth: 1.5,
    borderColor: '#ECEEF7',
    transform: [{ rotate: '45deg' }],
  },
  bar: {
    height: BAR_H,
    borderRadius: 12,
    backgroundColor: 'rgba(20,22,52,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.22)',
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 6,
    paddingBottom: 4,
    gap: 2,
  },
  // 払ったとき、札と曲名がボタンの下へ潜って見えるように切る
  openArea: { flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center', overflow: 'hidden' },
  slide: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // カードと同じ縦横比（1:1.56）
  art: { width: 26, height: 40, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)' },
  texts: { flex: 1, minWidth: 0 },
  title: { color: '#ECEEF7', fontSize: 13.5, letterSpacing: 0.6, fontFamily: JP_SERIF_FONT },
  sub: { color: '#9498BE', fontSize: 11, marginTop: 2, letterSpacing: 0.6, fontFamily: JP_SERIF_FONT },
  btn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  // 再生／一時停止は白い丸で一番目立たせる
  playBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#ECEEF7', marginHorizontal: 2 },
  off: { opacity: 0.3 },
  // 線の当たり（下端 16px）。見た目の線は下端に置く
  seekHit: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SEEK_HIT_H,
    justifyContent: 'flex-end',
  },
  rail: { height: 2, backgroundColor: 'rgba(96,206,224,0.16)' },
  railOn: { height: 5 },
  fill: { height: '100%', backgroundColor: '#60CEE0' },
  seekTime: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    fontFamily: NUM_FONT,
    fontSize: 11,
    color: '#60CEE0',
    backgroundColor: 'rgba(20,22,52,0.96)',
    paddingHorizontal: 4,
  },
});

export default NowPlayingBar;
