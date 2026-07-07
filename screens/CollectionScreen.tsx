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
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ArtworkCard } from '../components/ArtworkCard';
import { ShuffleIcon } from '../components/icons';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';
import { useT } from '../lib/i18n';

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

const NUM_COLUMNS = 3;
const GRID_GAP = 12;
const SIDE_PAD = 20;

export const CollectionScreen: React.FC<Props> = ({
  owned,
  wishlist,
  onOpenTrack,
  onBuy,
  onDiscover,
}) => {
  const t = useT();
  const { width: screenW } = useWindowDimensions();
  const [seg, setSeg] = useState<Segment>('mine');

  // 3列・列幅 = (画面幅 - 左右padding - 列間gap×(列数-1)) / 列数
  const colW = (screenW - SIDE_PAD * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const data = seg === 'mine' ? owned : wishlist;

  // 所有曲からランダムに1曲を再生（シャッフル）
  const handleShuffle = () => {
    if (owned.length === 0) return;
    const idx = Math.floor(Math.random() * owned.length);
    onOpenTrack(owned[idx].id);
  };

  const renderItem = ({ item, index }: { item: CollectionItem; index: number }) => (
    // カードは段階的にふわっと浮き出る（reanimated entering）
    <Animated.View
      // seg を key に混ぜて、タブ切替のたびに再アニメーションさせる
      key={`${seg}-${item.id}`}
      entering={FadeInUp.duration(420).delay((index % 8) * 55)}
      style={[styles.cell, { width: colW }]}
    >
      <Pressable onPress={() => onOpenTrack(item.id)}>
        {/*
         * ArtworkCard の Canvas はオーラ余白(PAD)分だけ実寸より大きい。
         * 実寸サイズ(colW × colW*1.5)のコンテナで中央寄せし、画像とタイトルの中心を揃える。
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
              <Text style={styles.ownedText}>{t('collection.ownedTag')}</Text>
            </View>
          ) : (
            // ウィッシュ: 購入ボタン明示（金額タップ購入は審査NG＝ボタンから起動）
            <Pressable
              style={({ pressed }) => [styles.buyBtn, pressed && { opacity: 0.85 }]}
              onPress={() => onBuy(item)}
            >
              <Text style={styles.buyLabel} numberOfLines={1} adjustsFontSizeToFit>
                {t('collection.buy', { price: item.priceLabel ?? '¥2,500' })}
              </Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />

      {/* ヘッダー（所有数は事実のみ・競わせない） */}
      <View style={styles.header}>
        <Text style={styles.h1}>{t('collection.title')}</Text>
        {seg === 'mine' && (
          <Text style={styles.count}>{t('collection.ownedCount', { n: owned.length })}</Text>
        )}
      </View>

      {/* セグメント切替 */}
      <View style={styles.segment}>
        <Pressable
          style={[styles.segBtn, seg === 'mine' && styles.segBtnActive]}
          onPress={() => setSeg('mine')}
        >
          <Text style={[styles.segText, seg === 'mine' && styles.segTextActive]}>
            {t('collection.owned')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segBtn, seg === 'wish' && styles.segBtnActive]}
          onPress={() => setSeg('wish')}
        >
          <Text style={[styles.segText, seg === 'wish' && styles.segTextActive]}>
            {t('collection.wishlist')}
          </Text>
        </Pressable>
      </View>

      {/* シャッフル（マイコレ・所有2曲以上のときだけ表示。グレーアウトでなく消える） */}
      {seg === 'mine' && owned.length >= 2 && (
        <View style={styles.shuffleRow}>
          <Pressable
            style={({ pressed }) => [styles.shuffleBtn, pressed && { opacity: 0.7 }]}
            onPress={handleShuffle}
            accessibilityRole="button"
            accessibilityLabel={t('collection.shuffle')}
          >
            <ShuffleIcon size={12} color={COLOR.textSecondary} />
            <Text style={styles.shuffleLabel}>{t('collection.shuffle')}</Text>
          </Pressable>
        </View>
      )}

      {/* グリッド or 空状態 */}
      {data.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyOrb} />
          <Text style={styles.emptyTitle}>{t('collection.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('collection.emptyBody')}</Text>
          <Pressable
            style={({ pressed }) => [styles.discoverBtn, pressed && { opacity: 0.8 }]}
            onPress={onDiscover}
          >
            <Text style={styles.discoverLabel}>{t('collection.discover')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data}
          // seg を key に含め、タブ切替でリストを作り直して再アニメーション
          key={seg}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
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
  shuffleRow: { alignItems: 'flex-end', marginHorizontal: SIDE_PAD, marginBottom: SPACE.sm },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: 'rgba(34,36,69,0.30)',
  },
  shuffleLabel: { color: COLOR.textSecondary, fontSize: 10.5, letterSpacing: 1 },
  grid: { paddingHorizontal: SIDE_PAD, paddingBottom: 40, gap: GRID_GAP },
  cell: { marginBottom: GRID_GAP },
  cellMeta: { marginTop: 6, gap: 4 },
  // 3列でカードが小さいので文字も小さめ
  cellTitle: { color: COLOR.textPrimary, fontSize: 11, letterSpacing: 0.2 },
  ownedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownedDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLOR.auraCyan },
  ownedText: { color: COLOR.textSecondary, fontSize: 10 },
  buyBtn: {
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLOR.auraCyan,
    backgroundColor: 'rgba(96,206,224,0.08)',
    alignItems: 'center',
  },
  buyLabel: { color: COLOR.auraCyan, fontSize: 9.5, fontWeight: '600', letterSpacing: 0.2 },
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
