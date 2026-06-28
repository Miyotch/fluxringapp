/**
 * StoryScreen.tsx — ストーリー P2.1
 * ------------------------------------------------------------------
 * ワイヤーフレーム 02 / P2.1 詳細:
 *   ・ディスカバーから左スワイプで右から開く（曲は替えない・同じ曲の深部へ）
 *   ・表示順: サムネ(中央上部) → Story → 調律素材 → Artist
 *   ・各項目は絶対座標・固定高さのフロストに分離
 *   ・Story が短くても 調律素材・Artist は固定位置（レイアウトに影響させない）
 *   ・調律素材: 1行最大4つ・最大8個（2段固定）・運営プリセットから選択
 *   ・Artist 名はこの画面のみ表示。タップで作家プロフィールへ
 *   ・横スワイプ: 1/4 超で自動・加速（オーバーシュートなし）。戻るは [<<<]＋右スワイプ
 *
 * 本スケルトンは縦並びの構造を再現。横スワイプ遷移ロジックは呼び出し側で。
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { ArtworkCard } from '../components/ArtworkCard';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';

export type StoryData = {
  trackId: string;
  artworkUrl: string;
  title: string;
  story: string;             // Story 本文（短文でも可・固定枠で縦中央寄せ）
  materials: string[];       // 調律素材（最大8・2段固定）。例: ['432Hz','純正律','1/f']
  artistId: string;
  artistName: string;        // この画面のみ表示
  glowColor?: string;
  glowColor2?: string;
};

type Props = {
  data: StoryData;
  onBack: () => void;
  onOpenArtist: (artistId: string) => void;
};

export const StoryScreen: React.FC<Props> = ({ data, onBack, onOpenArtist }) => {
  // 調律素材は最大8個・1行最大4つ（2段固定）
  const materials = data.materials.slice(0, 8);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />

      {/* 戻る導線 [<<<]（右スワイプでも戻れる想定） */}
      <Pressable style={styles.back} onPress={onBack} hitSlop={12}>
        <Text style={styles.backText}>‹‹‹</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ① サムネ（中央上部・小サイズのカード構造） */}
        <View style={styles.thumbWrap}>
          <ArtworkCard
            width={120}
            imageUri={data.artworkUrl}
            glow={data.glowColor}
            glow2={data.glowColor2}
            inset={5}
          />
        </View>

        {/* ② Story（フロスト枠・短文でも固定高さ・縦中央寄せ） */}
        <View style={[styles.frost, styles.storyFrost]}>
          <Text style={styles.sectionLabel}>Story</Text>
          <Text style={styles.storyBody}>{data.story}</Text>
        </View>

        {/* ③ 調律素材（フロスト枠・最大8個 2段固定・提示のみ＝効能を書かない） */}
        <View style={[styles.frost, styles.materialFrost]}>
          <Text style={styles.sectionLabel}>調律素材</Text>
          <View style={styles.chips}>
            {materials.map((m, i) => (
              <View key={`${m}-${i}`} style={styles.chip}>
                <Text style={styles.chipText}>{m}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ④ Artist（この画面のみ・タップで作家プロフィールへ） */}
        <Pressable
          style={[styles.frost, styles.artistFrost]}
          onPress={() => onOpenArtist(data.artistId)}
        >
          <Text style={styles.sectionLabel}>Artist</Text>
          <View style={styles.artistRow}>
            <View style={styles.artistAvatar} />
            <Text style={styles.artistName}>{data.artistName}</Text>
            <Text style={styles.artistChevron}>›</Text>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  back: {
    position: 'absolute',
    // TODO: SafeAreaInsets.top を加算
    top: 52,
    left: 20,
    zIndex: 10,
  },
  backText: { color: COLOR.textSecondary, fontSize: 20, letterSpacing: 1 },
  scroll: {
    paddingTop: 96,
    paddingHorizontal: SPACE.lg,
    paddingBottom: 60,
    gap: SPACE.md,
  },
  thumbWrap: { alignItems: 'center', marginBottom: SPACE.sm },
  frost: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.12)',
    backgroundColor: 'rgba(34,36,69,0.28)',
    padding: SPACE.md,
  },
  sectionLabel: {
    color: COLOR.auraCyan,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: SPACE.sm,
  },
  // Story は短文でも固定高さ・縦中央寄せ（調律素材/Artist を押し下げない）
  storyFrost: { minHeight: 140, justifyContent: 'center' },
  storyBody: { color: COLOR.textPrimary, fontSize: 14, lineHeight: 24, letterSpacing: 0.3 },
  materialFrost: {},
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    paddingHorizontal: SPACE.md,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: 'rgba(58,61,114,0.25)',
  },
  chipText: { color: COLOR.textSecondary, fontSize: 12, letterSpacing: 0.3 },
  artistFrost: {},
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  artistAvatar: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLOR.layer,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  artistName: { flex: 1, color: COLOR.textPrimary, fontSize: 15, letterSpacing: 0.5 },
  artistChevron: { color: COLOR.textSecondary, fontSize: 20 },
});

export default StoryScreen;
