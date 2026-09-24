/**
 * NowPlayingBar.tsx — どの画面でもフッターのすぐ上に出る再生バナー（0.2.0 第 2 段階）
 * ------------------------------------------------------------------
 *   ・左にアートの小さな札、曲名、右に再生／一時停止と次へ。上端に細い進み具合の線
 *   ・押すと再生画面を開く。左右に払うと前の曲・次の曲
 *   ・何も流していない（キューが空）ときは描かない。一時停止中は出たまま
 *
 * 位置の更新（0.25 秒ごと）は usePlaybackProgress で受け、ここだけが描き直す。
 */

import React, { useRef } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { usePlayback, usePlaybackProgress } from '../lib/playback';
import { PlayMark, PauseMark, SkipIcon } from './icons';
import { useT } from '../lib/i18n';

const SWIPE_PX = 48;

type Props = {
  onOpen: () => void;
  /** 高さが変わったとき（HOME で購入ボタンを逃がす量に使う） */
  onLayout?: (e: LayoutChangeEvent) => void;
};

/** 進み具合の線だけを描き直す部品 */
const ProgressLine: React.FC = () => {
  const { position, duration } = usePlaybackProgress();
  const p = duration > 0 ? Math.min(1, position / duration) : 0;
  return (
    <View style={styles.track} pointerEvents="none">
      <View style={[styles.fill, { width: `${p * 100}%` }]} />
    </View>
  );
};

export const NowPlayingBar: React.FC<Props> = ({ onOpen, onLayout }) => {
  const t = useT();
  const pb = usePlayback();
  const pbRef = useRef(pb);
  pbRef.current = pb;

  // 左右に払うと曲送り。縦や小さな動きは取らない（押す＝再生画面を開く、を邪魔しない）
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_e, g) => {
        if (g.dx <= -SWIPE_PX) pbRef.current.next();
        else if (g.dx >= SWIPE_PX) pbRef.current.prev();
      },
    }),
  ).current;

  const cur = pb.current;
  if (!cur) return null;

  return (
    <View style={styles.wrap} onLayout={onLayout} {...swipe.panHandlers}>
      <Pressable
        style={({ pressed }) => [styles.bar, pressed && { opacity: 0.9 }]}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={t('playback.open', { title: cur.title })}
      >
        <ProgressLine />
        <Image source={{ uri: cur.artworkUrl }} style={styles.art} />
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>{cur.title}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {pb.loading ? t('playback.loading') : pb.playing ? t('playback.playing') : t('playback.paused')}
            {pb.queue.length > 1 ? `　${pb.index + 1} / ${pb.queue.length}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={pb.toggle}
          hitSlop={10}
          style={styles.btn}
          accessibilityRole="button"
          accessibilityLabel={pb.playing ? t('playback.pause') : t('playback.play')}
        >
          {pb.playing ? <PauseMark size={20} /> : <PlayMark size={20} />}
        </Pressable>
        <Pressable
          onPress={pb.next}
          hitSlop={10}
          style={styles.btn}
          disabled={pb.queue.length < 2}
          accessibilityRole="button"
          accessibilityLabel={t('playback.next')}
        >
          <View style={pb.queue.length < 2 && { opacity: 0.3 }}>
            <SkipIcon size={18} />
          </View>
        </Pressable>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingBottom: 8 },
  bar: {
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(20,22,52,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
    overflow: 'hidden',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: 'rgba(96,206,224,0.12)',
  },
  fill: { height: 2, backgroundColor: '#60CEE0' },
  art: { width: 28, height: 42, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' },
  texts: { flex: 1, minWidth: 0 },
  title: { color: '#ECEEF7', fontSize: 13, letterSpacing: 0.3 },
  sub: { color: '#9498BE', fontSize: 10.5, marginTop: 2, letterSpacing: 0.4 },
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});

export default NowPlayingBar;
