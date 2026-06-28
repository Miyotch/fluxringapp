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

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { ArtworkCard } from '../components/ArtworkCard';
import { COLOR, SPACE, TRANSPORT } from '../constants/design-tokens';

export type PlayerTrack = {
  id: string;
  title: string;
  subtitle?: string;        // 情景の言葉（任意）
  artworkUrl: string;
  durationSec: number;      // 音源から自動算出
  glowColor?: string;
  glowColor2?: string;
};

type Props = {
  track: PlayerTrack;
  onBackHome: () => void;
  onOpenStory: () => void;
};

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const PlayerScreen: React.FC<Props> = ({ track, onBackHome, onOpenStory }) => {
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.min(screenW - 96, 240);

  // TODO: expo-av / react-native-track-player と接続。今はローカル state スタブ
  const [playing, setPlaying] = useState(true);
  const [loop, setLoop] = useState(false);
  const [positionSec] = useState(Math.floor(track.durationSec * 0.33));

  const progress = track.durationSec > 0 ? positionSec / track.durationSec : 0;

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

      {/* 共有カード（サムネ・カード構造） */}
      <View style={styles.cardArea}>
        <ArtworkCard
          width={cardW}
          imageUri={track.artworkUrl}
          glow={track.glowColor}
          glow2={track.glowColor2}
          hero={{ enabled: true }}
        />
      </View>

      {/* 曲名・情景 */}
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
        {track.subtitle && <Text style={styles.subtitle} numberOfLines={1}>{track.subtitle}</Text>}
      </View>

      {/* フロストのトランスポート */}
      <View style={styles.transport}>
        {/* シークバー */}
        <View style={styles.seekRow}>
          <View style={styles.seekTrack}>
            <View style={[styles.seekFill, { width: `${progress * 100}%` }]} />
            {/* 白ノブ */}
            <View style={[styles.seekKnob, { left: `${progress * 100}%` }]} />
          </View>
        </View>
        {/* 時間 */}
        <View style={styles.timeRow}>
          <Text style={styles.time}>{fmt(positionSec)}</Text>
          <Text style={styles.time}>{fmt(track.durationSec)}</Text>
        </View>
        {/* コントロール: 左54pxスペース / 中央 再生・停止 / 右 ループ */}
        <View style={styles.controls}>
          <View style={{ width: TRANSPORT.controlLeftPad }} />
          <Pressable
            style={styles.playBtn}
            onPress={() => setPlaying((p) => !p)}
            hitSlop={10}
            accessibilityLabel={playing ? '一時停止' : '再生'}
          >
            <Text style={styles.playGlyph}>{playing ? '❚❚' : '▶'}</Text>
          </Pressable>
          <Pressable
            style={styles.loopBtn}
            onPress={() => setLoop((l) => !l)}
            hitSlop={10}
            accessibilityLabel="ループ"
          >
            <Text style={[styles.loopGlyph, { color: loop ? COLOR.auraCyan : COLOR.textSecondary }]}>
              ↻
            </Text>
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
  seekRow: { marginBottom: SPACE.sm },
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
  playGlyph: { color: COLOR.textPrimary, fontSize: 14 },
  loopBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },
  loopGlyph: { fontSize: 18 },
});

export default PlayerScreen;
