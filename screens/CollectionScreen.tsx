/**
 * CollectionScreen.tsx — コレクション P3
 * ------------------------------------------------------------------
 * ワイヤーフレーム 03 / P3・初動:
 *   ・上部セグメントで マイコレクション（所有）/ ウィッシュリスト を切替
 *   ・2列グリッド・カードやや小さめ（grid gap 18 / 左右 padding 38）
 *   ・マイコレ＝所有の記録（明・シアンドット）
 *   ・ウィッシュ＝欲しいものの保留（沈めない・価格を添える・「購入する ¥2,500」）
 *   ・楽曲タップ → ストーリー（P2.1）
 *   ・ウィッシュが空のとき: 「まだ、ひとつも。」＋「作品と出会う」
 *   ・ヒーロー/オーラはグリッドでは省略・控えめ（subdued）
 *   ・シルエット表示・シリーズは Phase2
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { ArtworkCard } from '../components/ArtworkCard';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';

export type CollectionItem = {
  id: string;
  title: string;
  artworkUrl: string;
  owned: boolean;
  audioKey?: string;         // R2 音源キー（再生画面へ）
  priceLabel?: string;       // ウィッシュ用
  glowColor?: string;
  glowColor2?: string;
};

type Segment = 'mine' | 'wish';

type Props = {
  owned: CollectionItem[];
  wishlist: CollectionItem[];
  onOpenTrack: (id: string) => void;     // タップ→ストーリー
  onBuy: (item: CollectionItem) => void; // ウィッシュの購入ボタン
  onDiscover: () => void;                // 「作品と出会う」→ ディスカバー
};

const GRID_GAP = 18;
const SIDE_PAD = 38;

export const CollectionScreen: React.FC<Props> = ({
  owned,
  wishlist,
  onOpenTrack,
  onBuy,
  onDiscover,
}) => {
  const { width: screenW } = useWindowDimensions();
  const [seg, setSeg] = useState<Segment>('mine');

  // 2列・列幅 = (画面幅 - 左右padding - 中央gap) / 2
  const colW = (screenW - SIDE_PAD * 2 - GRID_GAP) / 2;

  const data = seg === 'mine' ? owned : wishlist;

  const renderItem = ({ item }: { item: CollectionItem }) => (
    <Pressable
      style={[styles.cell, { width: colW }]}
      onPress={() => onOpenTrack(item.id)}
    >
      {/*
       * ArtworkCard の Canvas はオーラ余白(PAD)分だけ実寸より大きい。
       * 実寸サイズ(colW × colW*1.5)のコンテナで中央寄せし、Canvas の
       * はみ出しを左右対称にすることで、画像とタイトルの中心を揃える。
       */}
      <View style={{ width: colW, height: colW * 1.5, alignItems: 'center', justifyContent: 'center' }}>
        <ArtworkCard
          width={colW}
          imageUri={item.artworkUrl}
          glow={item.glowColor}
          glow2={item.glowColor2}
          inset={5}
          subdued
        />
      </View>
      <View style={styles.cellMeta}>
        <Text style={styles.cellTitle} numberOfLines={1}>{item.title}</Text>
        {seg === 'mine' ? (
          <View style={styles.ownedRow}>
            <View style={styles.ownedDot} />
            <Text style={styles.ownedText}>所有済み</Text>
          </View>
        ) : (
          // ウィッシュ: 購入ボタン明示（金額タップ購入は審査NG＝ボタンから起動）
          <Pressable
            style={({ pressed }) => [styles.buyBtn, pressed && { opacity: 0.85 }]}
            onPress={() => onBuy(item)}
          >
            <Text style={styles.buyLabel}>購入する {item.priceLabel ?? '¥2,500'}</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />

      {/* ヘッダー（所有数は事実のみ・競わせない） */}
      <View style={styles.header}>
        <Text style={styles.h1}>コレクション</Text>
        {seg === 'mine' && (
          <Text style={styles.count}>{owned.length} の作品を所有</Text>
        )}
      </View>

      {/* セグメント切替 */}
      <View style={styles.segment}>
        <Pressable
          style={[styles.segBtn, seg === 'mine' && styles.segBtnActive]}
          onPress={() => setSeg('mine')}
        >
          <Text style={[styles.segText, seg === 'mine' && styles.segTextActive]}>
            マイコレクション
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segBtn, seg === 'wish' && styles.segBtnActive]}
          onPress={() => setSeg('wish')}
        >
          <Text style={[styles.segText, seg === 'wish' && styles.segTextActive]}>
            ウィッシュリスト
          </Text>
        </Pressable>
      </View>

      {/* グリッド or 空状態 */}
      {data.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyOrb} />
          <Text style={styles.emptyTitle}>まだ、ひとつも。</Text>
          <Text style={styles.emptyBody}>出会った作品が、ここに静かに集まります。</Text>
          <Pressable
            style={({ pressed }) => [styles.discoverBtn, pressed && { opacity: 0.8 }]}
            onPress={onDiscover}
          >
            <Text style={styles.discoverLabel}>作品と出会う</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{ gap: GRID_GAP }}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  header: {
    // TODO: SafeAreaInsets.top を加算
    paddingTop: 56,
    paddingHorizontal: SIDE_PAD,
    gap: 4,
  },
  h1: { color: COLOR.textPrimary, fontSize: 24, fontWeight: '700', letterSpacing: 0.5 },
  count: { color: COLOR.textSecondary, fontSize: 13 },
  segment: {
    flexDirection: 'row',
    marginHorizontal: SIDE_PAD,
    marginTop: SPACE.md,
    marginBottom: SPACE.md,
    padding: 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: 'rgba(34,36,69,0.30)',
  },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.sm, alignItems: 'center' },
  segBtnActive: { backgroundColor: 'rgba(96,206,224,0.12)' },
  segText: { color: COLOR.textSecondary, fontSize: 13, letterSpacing: 0.3 },
  segTextActive: { color: COLOR.textPrimary, fontWeight: '600' },
  grid: { paddingHorizontal: SIDE_PAD, paddingBottom: 40, gap: GRID_GAP },
  cell: { marginBottom: GRID_GAP },
  cellMeta: { marginTop: SPACE.sm, gap: 6 },
  cellTitle: { color: COLOR.textPrimary, fontSize: 14, letterSpacing: 0.3 },
  ownedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ownedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLOR.auraCyan },
  ownedText: { color: COLOR.textSecondary, fontSize: 12 },
  buyBtn: {
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLOR.auraCyan,
    backgroundColor: 'rgba(96,206,224,0.08)',
    alignItems: 'center',
  },
  buyLabel: { color: COLOR.auraCyan, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xl, gap: SPACE.md },
  emptyOrb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(124,98,214,0.18)',
    marginBottom: SPACE.sm,
  },
  emptyTitle: { color: COLOR.textPrimary, fontSize: 17, letterSpacing: 0.5 },
  emptyBody: { color: COLOR.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  discoverBtn: {
    marginTop: SPACE.md,
    paddingVertical: 12,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  discoverLabel: { color: COLOR.textPrimary, fontSize: 14, letterSpacing: 0.5 },
});

export default CollectionScreen;
