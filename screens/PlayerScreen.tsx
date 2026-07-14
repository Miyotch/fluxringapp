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

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useSharedValue, useDerivedValue } from 'react-native-reanimated';
import { CardGL } from '../components/CardGL';
import { StarSeal } from '../components/StarSeal';
import { CardBackdrop } from '../components/CardBackdrop';
import { PlayMark, LoopIcon } from '../components/icons';
import { COLOR, SPACE, TRANSPORT } from '../constants/design-tokens';
import { formatTime } from '../lib/audio';
import { fullAudioUrl, previewUrl } from '../lib/r2';

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
  const { width: screenW, height: screenH } = useWindowDimensions();
  const cardW = Math.min(screenW - 96, 240);

  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loop, setLoop] = useState(false);
  const [seekW, setSeekW] = useState(1);
  const autoplayedFor = useRef<string | null>(null);

  // 背面レイヤー（StarSeal / CardBackdrop）用。x/y は root 内でのカード領域位置
  const [cardArea, setCardArea] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const cardH = Math.round(cardW * 1.5);
  // CardGL の回転角（度）・ドラッグ量を購読して背面を追従させる
  const rotationSV = useSharedValue(0);
  const dragXSV = useSharedValue(0);
  const slideFadeSV = useSharedValue(1);
  // 裏返り進捗（0=表, 1=裏）・表面度（1=表, 0=裏）を回転角から導出
  const aProgSV = useDerivedValue(
    () => (1 - Math.cos((rotationSV.value * Math.PI) / 180)) / 2,
    [rotationSV],
  );
  const foreSV = useDerivedValue(
    () => (Math.cos((rotationSV.value * Math.PI) / 180) + 1) / 2,
    [rotationSV],
  );

  // expo-audio プレイヤー（ソースをフックに渡して確実に読み込ませる）
  const player = useAudioPlayer(sourceUri ?? undefined);
  const status = useAudioPlayerStatus(player);

  // 音源URLを解決：フル音源（Worker・所有権）→ 失敗時は試聴音源にフォールバック
  useEffect(() => {
    let alive = true;
    setError(null);
    setSourceUri(null);
    autoplayedFor.current = null;
    (async () => {
      try {
        const url = await fullAudioUrl(track.audioKey);
        if (alive) setSourceUri(url);
      } catch {
        const pv = previewUrl(track.audioKey);
        if (pv) {
          if (alive) {
            setSourceUri(pv);
            setError('※ フル音源が未設定のため試聴音源を再生中');
          }
        } else if (alive) {
          setError('音源が未設定です（app.json の extra.r2 / R2 に音源を配置）');
        }
      }
    })();
    return () => { alive = false; };
  }, [track.audioKey]);

  // 読み込めたら一度だけ自動再生
  useEffect(() => {
    if (sourceUri && status.isLoaded && autoplayedFor.current !== sourceUri) {
      autoplayedFor.current = sourceUri;
      player.play();
    }
  }, [sourceUri, status.isLoaded, player]);

  // ループ反映
  useEffect(() => { player.loop = loop; }, [loop, player]);

  const duration = status.duration || track.durationSec || 0;
  const position = status.currentTime || 0;
  const playing = status.playing;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const loading = !!sourceUri && !status.isLoaded && !error;

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

      {/* 背景：調律陣（全画面・中心=カード中心。参照実装と同じく画面全体に広がる） */}
      {cardArea.w > 0 && (
        <StarSeal
          width={screenW}
          height={screenH}
          centerX={cardArea.x + cardArea.w / 2}
          centerY={cardArea.y + cardArea.h / 2}
          cardWidth={cardW}
          style={styles.sealLayer}
        />
      )}

      {/* 上部導線: ホームへ戻る / ストーリー */}
      <View style={styles.topNav}>
        <Pressable onPress={onBackHome} hitSlop={10}>
          <Text style={styles.navText}>‹ ホームへ戻る</Text>
        </Pressable>
        <Pressable onPress={onOpenStory} hitSlop={10}>
          <Text style={styles.navText}>ストーリー ›</Text>
        </Pressable>
      </View>

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
        {/* カード直下：発光・影レイヤー（ドラッグ追従） */}
        {cardArea.w > 0 && (
          <CardBackdrop
            width={cardArea.w}
            height={cardArea.h}
            centerX={cardArea.w / 2}
            centerY={cardArea.h / 2}
            cardW={cardW}
            cardH={cardH}
            auraA={track.glowColor}
            auraB={track.glowColor2}
            dragX={dragXSV}
            slideFade={slideFadeSV}
            aProg={aProgSV}
            fore={foreSV}
            style={styles.backLayer}
          />
        )}
        {/* 実3D（WebGL）カード: 指ドラッグで全方向360°回転・厚み1mm */}
        <CardGL
          frontUri={track.artworkUrl}
          width={cardW}
          height={cardH}
          depthRatio={0.016}
          backData={{
            title: track.title,
            story: track.subtitle,
            materials: ['純正律'],
            frequencies: ['432 Hz', '7.83 Hz'],
            artist: 'NAOKI OKA',
          }}
          rotationOut={rotationSV}
          dragXOut={dragXSV}
        />
      </View>

      {/* 曲名・情景 */}
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
        {track.subtitle && <Text style={styles.subtitle} numberOfLines={1}>{track.subtitle}</Text>}
        {loading && <Text style={styles.subtitle}>読み込み中…</Text>}
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
  backLayer: { position: 'absolute', top: 0, left: 0 },
  sealLayer: { position: 'absolute', top: 0, left: 0 },
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
