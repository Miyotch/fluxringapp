/**
 * OnboardingScreen.tsx — オンボーディング P0
 * ------------------------------------------------------------------
 * ワイヤーフレーム 01:
 *   ・新規のみ。情景カード3枚を横スワイプ → サインアップ/ログインへ
 *   ・スキップなし・効能訴求なし（情景の言葉のみ）
 *   ・既存ユーザーは直行（呼び出し側で初回判定）
 *   ・下部にページドット（○ ● ○）とサインアップ/ログインボタン
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';

// 情景3枚（効能は語らない・情景の言葉のみ）。TODO: 実画像 + コピーを運営登録に差し替え
type Scene = { id: string; words: string; imageUri: string };

const SCENES: Scene[] = [
  { id: 's1', words: '夜明け前、まだ青い部屋に最初の光がにじむ', imageUri: 'https://picsum.photos/seed/scene1/900/1600' },
  { id: 's2', words: '遠い汽笛が、眠りのふちをそっと撫でていく',     imageUri: 'https://picsum.photos/seed/scene2/900/1600' },
  { id: 's3', words: '星の生まれる夜、音はまだ言葉になる前',         imageUri: 'https://picsum.photos/seed/scene3/900/1600' },
];

type Props = {
  onSignUp: () => void;
  onLogin: () => void;
};

export const OnboardingScreen: React.FC<Props> = ({ onSignUp, onLogin }) => {
  const { width: screenW } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const renderScene = useCallback(
    ({ item }: { item: Scene }) => (
      <View style={[styles.scene, { width: screenW }]}>
        {/* 情景ビジュアル（フルブリード）。TODO: 実画像 + ヒーロー発光を載せる */}
        <View style={styles.sceneVisual}>
          <Text style={styles.sceneIndex}>情景ビジュアル</Text>
        </View>
        {/* 情景の言葉 */}
        <Text style={styles.sceneWords}>{item.words}</Text>
      </View>
    ),
    [screenW]
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />

      <View style={styles.brandWrap}>
        <Text style={styles.brand}>FLUX RING</Text>
      </View>

      {/* 情景カード（横スワイプ3枚） */}
      <FlatList
        data={SCENES}
        keyExtractor={(s) => s.id}
        renderItem={renderScene}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.pager}
      />

      {/* ページドット */}
      <View style={styles.dots}>
        {SCENES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {/* CTA: ログイン / 新規登録（位置入れ替え済み） */}
      <View style={styles.cta}>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
          onPress={onLogin}
        >
          <Text style={styles.secondaryLabel}>ログイン</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          onPress={onSignUp}
        >
          <Text style={styles.primaryLabel}>新規登録</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  brandWrap: {
    // TODO: SafeAreaInsets.top を加算
    paddingTop: 60,
    alignItems: 'center',
  },
  brand: { color: COLOR.textSecondary, fontSize: 13, letterSpacing: 6 },
  pager: { flex: 1 },
  scene: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.xl,
  },
  sceneVisual: {
    width: '86%',
    aspectRatio: 2 / 3,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: 'rgba(34,36,69,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sceneIndex: { color: COLOR.textSecondary, fontSize: 13, letterSpacing: 1 },
  sceneWords: {
    marginTop: SPACE.lg,
    color: COLOR.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: SPACE.lg },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLOR.border },
  dotActive: { backgroundColor: COLOR.textPrimary },
  cta: {
    paddingHorizontal: SPACE.xl,
    // TODO: SafeAreaInsets.bottom を加算
    paddingBottom: 40,
    gap: SPACE.sm,
  },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.auraCyan,
    backgroundColor: 'rgba(96,206,224,0.08)',
    alignItems: 'center',
  },
  primaryLabel: { color: COLOR.textPrimary, fontSize: 15, fontWeight: '600', letterSpacing: 1 },
  secondaryBtn: {
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.border,
    alignItems: 'center',
  },
  secondaryLabel: { color: COLOR.textSecondary, fontSize: 15, letterSpacing: 1 },
});

export default OnboardingScreen;
