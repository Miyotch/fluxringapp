/**
 * NowPlayingBar.tsx — どの画面でもフッターのすぐ上に出る再生バナー（0.2.0 第 2 段階）
 * ------------------------------------------------------------------
 *   ・左にアートの小さな札、曲名、右に再生／一時停止と次へ。上端に細い進み具合の線
 *   ・押すと再生画面を開く。左右に払うと前の曲・次の曲
 *   ・何も流していない（キューが空）ときは描かない。一時停止中は出たまま
 *
 * 位置の更新（0.25 秒ごと）は usePlaybackProgress で受け、ここだけが描き直す。
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { swipeDirection } from '../constants/swipe';
import { homeCardWidth } from '../constants/design-tokens';
import { usePlayback, usePlaybackProgress } from '../lib/playback';
import { PlayMark, PauseMark, SkipIcon, SkipPrevIcon, RewindIcon, FastForwardIcon, LoopIcon } from './icons';
import { useT } from '../lib/i18n';
import { JP_SERIF_FONT, NUM_FONT } from '../constants/fonts';

/** 払っている間、バーが指について動く割合（全部付けると画面の端まで出ていくので半分強） */
const FOLLOW_R = 0.6;

type Props = {
  onOpen: () => void;
  /** 高さが変わったとき（HOME で購入ボタンを逃がす量に使う） */
  onLayout?: (e: LayoutChangeEvent) => void;
};

/** 10 秒ぶんの移動 */
const SKIP_SEC = 10;

const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** 経過時間・再生バー・曲の長さ。位置の更新で描き直すのはここだけ。押す／ドラッグでその位置へ移動 */
const SeekRow: React.FC = () => {
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

  return (
    <View style={styles.seek}>
      <Text style={styles.time}>{fmt(pos)}</Text>
      <View
        style={styles.rail}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
        }}
        {...pan.panHandlers}
      >
        <View style={styles.railLine} pointerEvents="none">
          <View style={[styles.fill, { width: `${p * 100}%` }]} />
        </View>
        <View style={[styles.knob, { left: `${p * 100}%` }]} pointerEvents="none" />
      </View>
      <Text style={styles.time}>{fmt(duration)}</Text>
    </View>
  );
};

export const NowPlayingBar: React.FC<Props> = ({ onOpen, onLayout }) => {
  const t = useT();
  const pb = usePlayback();
  const pbRef = useRef(pb);
  pbRef.current = pb;
  // 送る基準は HOME・再生画面と同じ（constants/swipe.ts）。カード幅は HOME のカード
  const { height: screenH } = useWindowDimensions();
  const cardWRef = useRef(homeCardWidth(screenH));
  cardWRef.current = homeCardWidth(screenH);
  // 払っている間、バーが指について動き、離すと戻る（以前は動かず曲だけ替わっていた）
  const tx = useRef(new Animated.Value(0)).current;

  // 左右に払うと曲送り。縦や小さな動きは取らない（押す＝再生画面を開く、を邪魔しない）
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        tx.setValue(g.dx * FOLLOW_R);
      },
      onPanResponderRelease: (_e, g) => {
        const dir = swipeDirection(g.dx, g.vx * 1000, cardWRef.current);
        if (dir === 1) pbRef.current.next();
        else if (dir === -1) pbRef.current.prev();
        Animated.spring(tx, {
          toValue: 0,
          velocity: g.vx,
          stiffness: 260,
          damping: 30,
          mass: 1,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(tx, { toValue: 0, stiffness: 260, damping: 30, mass: 1, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const progress = usePlaybackProgress();
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const cur = pb.current;
  if (!cur) return null;

  return (
    <Animated.View
      style={[styles.wrap, { transform: [{ translateX: tx }] }]}
      onLayout={onLayout}
      {...swipe.panHandlers}
    >
      <Pressable
        style={({ pressed }) => [styles.bar, pressed && { opacity: 0.9 }]}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={t('playback.open', { title: cur.title })}
      >
        <View style={styles.top}>
          <Image source={{ uri: cur.artworkUrl }} style={styles.art} />
          <View style={styles.texts}>
            <Text style={styles.title} numberOfLines={1}>{cur.title}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {pb.loading
                ? t('playback.loading')
                : !pb.playing
                ? t('playback.paused')
                : cur.preview
                ? t('playback.previewing')
                : t('playback.playing')}
            </Text>
          </View>
        </View>
        <SeekRow />
        <View style={styles.ctrls}>
          <Pressable onPress={pb.prev} hitSlop={8} style={styles.btn} disabled={pb.queue.length < 2}
            accessibilityRole="button" accessibilityLabel={t('playback.prev')}>
            <View style={pb.queue.length < 2 && { opacity: 0.3 }}><SkipPrevIcon size={18} /></View>
          </Pressable>
          <Pressable onPress={() => pb.seekTo(Math.max(0, progressRef.current.position - SKIP_SEC))} hitSlop={8} style={styles.btn}
            accessibilityRole="button" accessibilityLabel={t('playback.rewind')}>
            <RewindIcon size={18} />
          </Pressable>
          <Pressable onPress={pb.toggle} hitSlop={8} style={styles.btn}
            accessibilityRole="button" accessibilityLabel={pb.playing ? t('playback.pause') : t('playback.play')}>
            {pb.playing ? <PauseMark size={26} /> : <PlayMark size={26} />}
          </Pressable>
          <Pressable onPress={() => pb.seekTo(Math.min(progressRef.current.duration, progressRef.current.position + SKIP_SEC))} hitSlop={8} style={styles.btn}
            accessibilityRole="button" accessibilityLabel={t('playback.forward')}>
            <FastForwardIcon size={18} />
          </Pressable>
          <Pressable onPress={pb.next} hitSlop={8} style={styles.btn} disabled={pb.queue.length < 2}
            accessibilityRole="button" accessibilityLabel={t('playback.next')}>
            <View style={pb.queue.length < 2 && { opacity: 0.3 }}><SkipIcon size={18} /></View>
          </Pressable>
          <Pressable onPress={() => pb.setRepeat(pb.repeat === 'one' ? 'ring' : 'one')} hitSlop={8} style={styles.btn}
            accessibilityRole="button" accessibilityLabel={t('playback.repeat')}>
            <LoopIcon size={18} on={pb.repeat === 'one'} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingBottom: 8 },
  bar: {
    borderRadius: 14,
    backgroundColor: 'rgba(20,22,52,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.25)',
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8 },
  seek: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 2 },
  time: { fontFamily: NUM_FONT, fontSize: 11, color: '#9498BE', minWidth: 32, textAlign: 'center' },
  rail: { flex: 1, height: 24, justifyContent: 'center' },
  railLine: { height: 4, borderRadius: 2, backgroundColor: 'rgba(96,206,224,0.16)', overflow: 'hidden' },
  fill: { height: 4, backgroundColor: '#60CEE0' },
  knob: { position: 'absolute', top: 7, width: 10, height: 10, borderRadius: 5, marginLeft: -5, backgroundColor: '#ECEEF7' },
  ctrls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 6 },
  // カードと同じ縦横比（1:1.56）
  art: { width: 28, height: 44, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' },
  texts: { flex: 1, minWidth: 0 },
  title: { color: '#ECEEF7', fontSize: 13, letterSpacing: 0.6, fontFamily: JP_SERIF_FONT },
  sub: { color: '#9498BE', fontSize: 10.5, marginTop: 3, letterSpacing: 0.4 },
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});

export default NowPlayingBar;
