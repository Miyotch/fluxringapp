/**
 * PlayerScreen.tsx — 再生画面（プレイヤー）
 * ------------------------------------------------------------------
 * ワイヤーフレーム 02 / PLAYER:
 *   ・所有曲の本再生。ディスカバーと同じ背景・アニメーション
 *   ・上部中央に共有カード（サムネ・カード構造）、下にフロストのトランスポート
 *   ・トランスポート最小セット: シーク(ノブ付き)・現在/総時間・再生/停止・ループ
 *   ・EQ・曲送りなし。曲間は無音。バックグラウンド再生対応
 *   ・フッターは出さない。縦画面固定。総時間は音源から自動算出
 *   ・上部の戻り導線「ホームへ戻る」／右に「ストーリー」
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { ArtworkCard } from '../components/ArtworkCard';
import { Card3D } from '../components/Card3D';
import { CardBack } from '../components/CardBack';
import { PlayMark, LoopIcon } from '../components/icons';
import { COLOR, SPACE, TRANSPORT } from '../constants/design-tokens';
import { formatTime } from '../lib/audio';
import { fullAudioUrl } from '../lib/r2';

export type PlayerTrack = {
  id: string;
  title: string;
  subtitle?: string;        // 情景の言葉（任意）
  artworkUrl: string;
  audioKey: string;         // R2 のフル音源キー（所有者のみ・署名付き）
  durationSec?: number;     // フォールバック表示用（実尺は音源から自動算出）
  glowColor?: string;
  glowColor2?: string;
};

type Props = {
  track: PlayerTrack;
  onBackHome: () => void;
  onOpenStory: () => void;
};

export const PlayerScreen: React.FC<Props> = ({ track, onBackHome, onOpenStory }) => {
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.min(screenW - 96, 240);

  const [error, setError] = useState<string | null>(null);
  const [loop, setLoop] = useState(false);
  const [seekW, setSeekW] = useState(1);

  // expo-audio プレイヤー（ソースは解決後に replace で流し込む）
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  // フル音源の署名付きURLを取得（所有権は Worker 側で確認）
  useEffect(() => {
    let alive = true;
    setError(null);
    (async () => {
      try {
        const url = await fullAudioUrl(track.audioKey);
        if (!alive) return;
        player.replace({ uri: url });
        player.play();
      } catch (e: any) {
        if (alive) setError(e?.message ?? '音源を取得できませんでした');
      }
    })();
    return () => { alive = false; };
  }, [track.audioKey, player]);

  // ループ反映
  useEffect(() => { player.loop = loop; }, [loop, player]);

  const duration = status.duration || track.durationSec || 0;
  const position = status.currentTime || 0;
  const playing = status.playing;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  const togglePlay = useCallback(() => {
    if (playing) player.pause();
    else player.play();
  }, [playing, player]);

  // タップ位置でシーク
  const onSeekPress = useCallback((e: GestureResponderEvent) => {
    if (duration <= 0) return;
    const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekW));
    player.seekTo(ratio * duration);
  }, [duration, seekW, player]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />

      {/* 上部導線: ホームへ戻る / ストーリー */}
      <View style={styles.topNav}>
        <Pressable onPress={onBackHome} hitSlop={10}>
          <Text style={styles.navText}>‹ ホームへ戻る</Text>
        </Pressable>
        <Pressable onPress={onOpenStory} hitSlop={10}>
          <Text style={styles.navText}>ストーリー ›</Text>
        </Pressable>
      </View>

      {/* 共有カード（指でなぞって360°回転・厚みつき） */}
      <View style={styles.cardArea}>
        <Card3D
          width={cardW}
          height={cardW * 1.5}
          front={
            <ArtworkCard
              width={cardW}
              imageUri={track.artworkUrl}
              glow={track.glowColor}
              glow2={track.glowColor2}
              hero={{ enabled: true }}
            />
          }
          back={
            <CardBack
              width={Math.round(cardW * 1.2)}
              data={{ title: track.title, story: track.subtitle, artist: 'NAOKI OKA' }}
            />
          }
        />
      </View>

      {/* 曲名・情景 */}
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
        {track.subtitle && <Text style={styles.subtitle} numberOfLines={1}>{track.subtitle}</Text>}
        {error && <Text style={styles.err}>{error}</Text>}
      </View>

      {/* フロストのトランスポート */}
      <View style={styles.transport}>
        {/* シークバー（上下拡張の当たり領域でタップシーク） */}
        <Pressable
          style={styles.seekHit}
          onPress={onSeekPress}
          onLayout={(ev: LayoutChangeEvent) => setSeekW(ev.nativeEvent.layout.width)}
        >
          <View style={styles.seekTrack}>
            <View style={[styles.seekFill, { width: `${progress * 100}%` }]} />
            <View style={[styles.seekKnob, { left: `${progress * 100}%` }]} />
          </View>
        </Pressable>
        {/* 時間 */}
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatTime(position)}</Text>
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>
        {/* コントロール: 左54pxスペース / 中央 再生・停止 / 右 ループ */}
        <View style={styles.controls}>
          <View style={{ width: TRANSPORT.controlLeftPad }} />
          <Pressable
            style={styles.playBtn}
            onPress={togglePlay}
            hitSlop={10}
            accessibilityLabel={playing ? '一時停止' : '再生'}
          >
            {playing ? (
              <View style={styles.pauseRow}>
                <View style={styles.pauseBar} />
                <View style={styles.pauseBar} />
              </View>
            ) : (
              <PlayMark size={19} />
            )}
          </Pressable>
          <Pressable
            style={styles.loopBtn}
            onPress={() => setLoop((l) => !l)}
            hitSlop={10}
            accessibilityLabel="ループ"
          >
            <LoopIcon size={16} on={loop} />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  topNav: {
    // TODO: SafeAreaInsets.top を加算
    paddingTop: 52,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navText: { color: COLOR.textSecondary, fontSize: 13, letterSpacing: 0.4 },
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  meta: { alignItems: 'center', paddingHorizontal: SPACE.xl, gap: 4, marginBottom: SPACE.lg },
  title: { color: COLOR.textPrimary, fontSize: 20, fontWeight: '700', letterSpacing: 0.5 },
  subtitle: { color: COLOR.textSecondary, fontSize: 13, letterSpacing: 0.3 },
  err: { color: COLOR.badge, fontSize: 12, marginTop: 4, textAlign: 'center' },
  transport: {
    marginHorizontal: SPACE.lg,
    // TODO: SafeAreaInsets.bottom を加算
    marginBottom: 40,
    padding: SPACE.md,
    borderRadius: TRANSPORT.radius,
    borderWidth: 1,
    borderColor: TRANSPORT.borderColor,
    backgroundColor: TRANSPORT.bg,
    // TODO: 実機では Skia の BackdropBlur で blur(14px) saturate(1.3) を表現する
  },
  // 上下拡張のタップ当たり領域（見た目バーは中央）
  seekHit: { height: 24, justifyContent: 'center', marginBottom: SPACE.xs },
  seekTrack: {
    height: TRANSPORT.seekBarHeight,
    borderRadius: TRANSPORT.seekBarHeight / 2,
    backgroundColor: 'rgba(148,152,190,0.25)',
    justifyContent: 'center',
  },
  seekFill: {
    height: TRANSPORT.seekBarHeight,
    borderRadius: TRANSPORT.seekBarHeight / 2,
    backgroundColor: TRANSPORT.seekBarColor,
  },
  seekKnob: {
    position: 'absolute',
    width: TRANSPORT.seekKnobSize,
    height: TRANSPORT.seekKnobSize,
    borderRadius: TRANSPORT.seekKnobSize / 2,
    backgroundColor: '#FFFFFF',
    marginLeft: -TRANSPORT.seekKnobSize / 2,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACE.md },
  time: { color: COLOR.textSecondary, fontSize: 11, letterSpacing: 0.5 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xl },
  playBtn: {
    width: TRANSPORT.playBtnSize,
    height: TRANSPORT.playBtnSize,
    borderRadius: TRANSPORT.playBtnSize / 2,
    borderWidth: 1,
    borderColor: TRANSPORT.playBtnBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseRow: { flexDirection: 'row', gap: 4 },
  pauseBar: { width: 3, height: 14, borderRadius: 1.5, backgroundColor: COLOR.textPrimary },
  loopBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },
});

export default PlayerScreen;
