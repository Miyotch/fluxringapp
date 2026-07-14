/**
 * PlayerScreen.tsx — 再生画面（コレクションから開く）
 * ------------------------------------------------------------------
 * コレクションのカードをタップして開く再生画面。2フェーズ構成:
 *   ・ベール(veil): いきなり再生せず、コレクションをぼかしたような暗い背景に
 *                   カードと大きな再生ボタンだけを出す（魔法陣は出さない）
 *   ・再生(playing): 再生ボタンで開始。背景は星雲（NebulaGL）に切替、
 *                    下部にフロストのトランスポート（シーク・時間・再生/停止・ループ）
 *   ・上部左「コレクションへ戻る」／右に共有（旧ストーリー導線は廃止）
 *   ・EQ・曲送りなし。フッター非表示・縦画面固定。総時間は音源から自動算出
 *   ・ホーム(ディスカバー)側は従来のまま。この画面のみの挙動
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  StatusBar,
  Share,
  useWindowDimensions,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useSharedValue, useDerivedValue } from 'react-native-reanimated';
import { CardGL } from '../components/CardGL';
import { NebulaGL } from '../components/NebulaGL';
import { CardBackdrop } from '../components/CardBackdrop';
import { PlayMark, LoopIcon } from '../components/icons';
import { COLOR, SPACE, TRANSPORT } from '../constants/design-tokens';
import { formatTime } from '../lib/audio';
import { fullAudioUrl, previewUrl } from '../lib/r2';

// 共有アイコン（右上・ストーリー導線の置き換え）
const ShareIcon: React.FC = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3v13M12 3l-4 4M12 3l4 4M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
      stroke={COLOR.textSecondary}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

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
  onBackHome: () => void; // コレクションへ戻る
  onOpenStory?: () => void; // 未使用（ストーリー導線は廃止）
};

export const PlayerScreen: React.FC<Props> = ({ track, onBackHome }) => {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const cardW = Math.min(screenW - 96, 240);

  // ベール（再生前）→ 再生 の2フェーズ。初回はいきなり再生しない。
  const [phase, setPhase] = useState<'veil' | 'playing'>('veil');
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loop, setLoop] = useState(false);
  const [seekW, setSeekW] = useState(1);
  const startedFor = useRef<string | null>(null);

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
    startedFor.current = null;
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

  // 「再生」フェーズに入り、読み込めたら一度だけ再生開始
  // （ベール中は自動再生しない）
  useEffect(() => {
    if (phase === 'playing' && sourceUri && status.isLoaded && startedFor.current !== sourceUri) {
      startedFor.current = sourceUri;
      player.play();
    }
  }, [phase, sourceUri, status.isLoaded, player]);

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

  // ベールの再生ボタン → 再生フェーズへ（読み込み後に上の effect が play する）
  const startPlayback = useCallback(() => {
    setPhase('playing');
  }, []);

  const onShare = useCallback(() => {
    Share.share({ message: `FLUX RING — ${track.title}` }).catch(() => {});
  }, [track.title]);

  // タップ位置でシーク
  const onSeekPress = useCallback((e: GestureResponderEvent) => {
    if (duration <= 0) return;
    const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekW));
    player.seekTo(ratio * duration);
  }, [duration, seekW, player]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />

      {/* 背景（コレクション再生画面・魔法陣は出さない）:
          ・ベール中 = コレクションをぼかしたような暗い背景（作品画像を強ブラー）
          ・再生中   = 星雲（NebulaGL） */}
      {phase === 'veil' ? (
        <>
          <Image
            source={{ uri: track.artworkUrl }}
            style={styles.veilImage}
            blurRadius={40}
          />
          <View style={styles.veilScrim} />
        </>
      ) : (
        <NebulaGL />
      )}

      {/* 上部導線: コレクションへ戻る / 共有（ストーリー導線は廃止） */}
      <View style={styles.topNav}>
        <Pressable onPress={onBackHome} hitSlop={10}>
          <Text style={styles.navText}>‹ コレクションへ戻る</Text>
        </Pressable>
        <Pressable onPress={onShare} hitSlop={10} accessibilityLabel="共有">
          <ShareIcon />
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
        {phase === 'playing' && loading && <Text style={styles.subtitle}>読み込み中…</Text>}
        {error && <Text style={styles.err}>{error}</Text>}
      </View>

      {/* ベール（再生前）: 再生ボタンだけを大きく置く */}
      {phase === 'veil' && (
        <View style={styles.veilControls}>
          <Pressable
            style={({ pressed }) => [styles.veilPlay, pressed && { opacity: 0.8 }]}
            onPress={startPlayback}
            hitSlop={12}
            accessibilityLabel="再生"
          >
            <View style={styles.veilPlayGlow} />
            <PlayMark size={26} />
          </Pressable>
        </View>
      )}

      {/* フロストのトランスポート（再生フェーズのみ） */}
      {phase === 'playing' && (
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
      )}
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
  // ベール背景（コレクションをぼかしたような暗い面）
  veilImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.32 },
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
