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
 *
 * 位置の更新（0.25 秒ごと）は usePlaybackProgress で受け、SeekLine だけが描き直す。
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { PlayMark, PauseMark, SkipIcon, SkipPrevIcon } from './icons';
import { useT } from '../lib/i18n';
import { JP_SERIF_FONT, NUM_FONT } from '../constants/fonts';

type Props = {
  onOpen: () => void;
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

export const NowPlayingBar: React.FC<Props> = ({ onOpen, onLayout }) => {
  const t = useT();
  const pb = usePlayback();
  const pbRef = useRef(pb);
  pbRef.current = pb;
  // 送る基準は HOME・再生画面と同じ（constants/swipe.ts）。カード幅は HOME のカード
  const { width: screenW, height: screenH } = useWindowDimensions();
  const cardWRef = useRef(homeCardWidth(screenH));
  cardWRef.current = homeCardWidth(screenH);
  const screenWRef = useRef(screenW);
  screenWRef.current = screenW;
  // 札と曲名の横位置。指に 1:1 でついてくる
  const tx = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);

  const snapBack = (vx = 0) =>
    Animated.spring(tx, {
      toValue: 0,
      velocity: vx,
      stiffness: 260,
      damping: 30,
      mass: 1,
      useNativeDriver: true,
    }).start();

  /** 画面の外へ抜けてから曲を替え、反対側から入れる。dir: 1=次 / -1=前 */
  const slideTo = (dir: 1 | -1) => {
    const w = screenWRef.current;
    busy.current = true;
    Animated.timing(tx, {
      toValue: -dir * w,
      duration: 160,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      if (dir === 1) pbRef.current.next();
      else pbRef.current.prev();
      tx.setValue(dir * w * 0.5);
      Animated.timing(tx, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        busy.current = false;
      });
    });
  };

  // 左右に払うと曲送り。縦や小さな動きは取らない（押す＝再生画面を開く、を邪魔しない）
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        !busy.current && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        // 1 曲しかないときは送れないので、ゴムのように少しだけ動かす
        const single = pbRef.current.queue.length < 2;
        tx.setValue(single ? g.dx * 0.25 : g.dx);
      },
      onPanResponderRelease: (_e, g) => {
        const dir = swipeDirection(g.dx, g.vx * 1000, cardWRef.current);
        if (dir !== 0 && pbRef.current.queue.length >= 2) slideTo(dir);
        else snapBack(g.vx);
      },
      onPanResponderTerminate: () => snapBack(),
    }),
  ).current;

  const cur = pb.current;
  if (!cur) return null;
  const many = pb.queue.length >= 2;
  const artist = cur.artistName || cur.artist;
  const sub = pb.loading ? t('playback.loading') : cur.preview ? t('playback.previewing') : artist ?? '';

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <View style={styles.bar} {...swipe.panHandlers}>
        <View style={styles.row}>
          {/* 札と曲名。押すと再生画面、払うと曲送り（ここだけが指について動く） */}
          <Pressable
            style={styles.openArea}
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={t('playback.open', { title: cur.title })}
          >
            <Animated.View style={[styles.slide, { transform: [{ translateX: tx }] }]}>
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
        <SeekLine />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingBottom: 8 },
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
