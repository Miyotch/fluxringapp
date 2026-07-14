/**
 * CollectionScreen.tsx — コレクション P3
 * ------------------------------------------------------------------
 * ワイヤーフレーム 03 / P3・初動:
 *   ・上部セグメントで マイコレクション（所有）/ ウィッシュリスト を切替
 *   ・3列×7行＝21枠のグリッド。未購入でも枠（点線・通し番号）をあらかじめ表示
 *   ・マイコレ＝所有の記録（明・シアンドット）。未所有の枠はダミー（タップ不可）
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
const NUM_ROWS = 7;
const TOTAL_SLOTS = NUM_COLUMNS * NUM_ROWS; // 21枠。未購入でも枠を先出しする
const GRID_GAP = 12;
const SIDE_PAD = 20;

// マイコレクションの1枠（所有=item あり／未所有=null のダミー枠）
type MineSlot = { key: string; item: CollectionItem | null; no: string };

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

  // マイコレは常に21枠。所有分を先頭から詰め、残りは通し番号だけのダミー枠。
  const mineSlots: MineSlot[] = Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
    key: owned[i]?.id ?? `empty-${i}`,
    item: owned[i] ?? null,
    no: String(i + 1).padStart(2, '0'),
  }));

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

  // マイコレ用: 所有=通常カード／未所有=通し番号だけの点線ダミー枠（タップ不可）
  const renderMineSlot = ({ item: slot, index }: { item: MineSlot; index: number }) =>
    slot.item ? (
      renderItem({ item: slot.item, index })
    ) : (
      <Animated.View
        key={`mine-${slot.key}`}
        entering={FadeInUp.duration(420).delay((index % 8) * 55)}
        style={[styles.cell, { width: colW }]}
      >
        <View style={[styles.emptySlot, { width: colW, height: colW * 1.5 }]}>
          <Text style={styles.emptySlotNo}>{slot.no}</Text>
        </View>
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

      {/* グリッド or 空状態 */}
      {seg === 'mine' ? (
        // マイコレは常に21枠のグリッド（未購入は通し番号だけの点線ダミー枠）
        <FlatList
          data={mineSlots}
          key="mine"
          keyExtractor={(s) => s.key}
          renderItem={renderMineSlot}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={{ gap: GRID_GAP }}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      ) : wishlist.length === 0 ? (
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
          data={wishlist}
          key="wish"
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
  grid: { paddingHorizontal: SIDE_PAD, paddingTop: SPACE.sm, paddingBottom: 40, gap: GRID_GAP },
  cell: { marginBottom: GRID_GAP },
  // 未所有の枠（通し番号のみの点線ダミー・タップ不可）
  emptySlot: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(96,206,224,0.28)',
    backgroundColor: 'rgba(34,36,69,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotNo: { color: COLOR.textSecondary, fontSize: 12, letterSpacing: 1, opacity: 0.6 },
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
