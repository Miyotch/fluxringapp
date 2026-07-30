/**
 * CollectionScreen.tsx — コレクション P3（v98_FIX トンマナ確定値）
 * ------------------------------------------------------------------
 * 数値は FR_engineering_handoff_v98_FIX の確定台帳（spec_inventory /
 * tonmana_usage_map）に一致させている。**変更禁止値**を含む:
 *   ・グリッド: 3列 / aspect 2:3 / 角丸10px / row-gap 18px / column-gap 10px
 *   ・スクロール容器: padding 24px 22px 78px ＋ 上端フェード 22px
 *   ・タイル金属フレーム: inset -1.6px / 角丸 11.6px（内側10+1.6の同心値。
 *     11px 固定は角光の原因＝v97事故）
 *   ・空スロット: rgba(255,255,255,.03) ＋ 1px dashed rgba(96,206,224,.14)
 *   ・番号: 空=中央 11px 字間.2em rgba(148,152,190,.6) /
 *           所有=上6px rgba(236,238,247,.75) shadow opacity.65
 *   ・タブ: 11px 字間.14em / OFF #9498BE・ON #ECEEF7＋下線1.5px #60CEE0
 *   ・ウィッシュ: 2列 / 角丸13.9px / gap12 / 空=白.04＋破線シアン.18＋「＋」24px
 *
 * タイルは DOM/画像のみ（WebGL不使用）＝原本と同じ。3D拡大は再生画面が担う。
 * マイコレは 21枠の常設グリッド（未購入も枠を先出し）。
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinear, Stop, Rect, RadialGradient as SvgRadial } from 'react-native-svg';
import { PurchaseModal } from '../components/PurchaseModal';
import { useT } from '../lib/i18n';
import { useTopInset } from '../lib/safeArea';
import { formatPrice, TRACK_PRICE_JPY } from '../constants/pricing';
import type { PurchaseController } from '../lib/usePurchaseFlow';

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
  onOpenTrack: (id: string) => void;     // 所有曲タップ → 再生画面
  onOpenWish: (id: string) => void;      // ウィッシュ曲タップ → ホームの該当カードへ
  /** 購入が**成立した**ときだけ呼ばれる（キャンセル・失敗では呼ばない） */
  onBuy: (item: CollectionItem) => void;
  onDiscover: () => void;                // 「作品と出会う」→ ディスカバー
  /** 購入フロー。未指定なら購入ボタンは押しても何も起きない */
  purchase?: PurchaseController;
};

// ── 確定値（v98_FIX） ──
const COLS = 3;                 // .deck-grid grid-template-columns: repeat(3,1fr)
const ROWS = 7;
const TOTAL_SLOTS = COLS * ROWS; // 21枠
const ROW_GAP = 18;             // row-gap:18px
const COL_GAP = 10;             // column-gap:10px
const PAD_X = 22;               // padding 左右
const PAD_TOP = 24;             // padding 上
const PAD_BOTTOM = 78;          // padding 下（フッター潜り）
const TILE_RADIUS = 10;         // .deck-slot border-radius
const FRAME_INSET = 1.6;        // .deck-card::before inset:-1.6px
const FRAME_RADIUS = 11.6;      // 10 + 1.6 の同心値（固定11pxは禁止）
const FADE_H = 22;              // 上端フェード 22px
const WISH_COLS = 2;
const WISH_GAP = 12;
const WISH_RADIUS = 13.9;

const C = {
  text: '#ECEEF7',
  sub: '#9498BE',
  cyan: '#60CEE0',
  slotNum: 'rgba(148,152,190,0.6)',
  filledNum: 'rgba(236,238,247,0.75)',
  emptyBg: 'rgba(255,255,255,0.03)',
  emptyBorder: 'rgba(96,206,224,0.14)',
  imgRing: 'rgba(150,165,210,0.14)',
  tabBorder: 'rgba(96,206,224,0.15)',
  wishEmptyBg: 'rgba(255,255,255,0.04)',
  wishEmptyBorder: 'rgba(96,206,224,0.18)',
  wishPlus: 'rgba(96,206,224,0.2)',
  wishBtnBorder: 'rgba(96,206,224,0.38)',
  back: '#AEB4D6',
} as const;

type MineSlot = { key: string; item: CollectionItem | null; no: string };

// パネル背景: radial #14122e → #0a0a1c 46% → #05040c
const PanelBackground: React.FC<{ w: number; h: number }> = ({ w, h }) => (
  <Svg style={StyleSheet.absoluteFill} width={w} height={h} pointerEvents="none">
    <Defs>
      <SvgRadial id="colbg" cx="50%" cy="34%" r="120%">
        <Stop offset="0" stopColor="#14122e" />
        <Stop offset="0.46" stopColor="#0a0a1c" />
        <Stop offset="1" stopColor="#05040c" />
      </SvgRadial>
    </Defs>
    <Rect x="0" y="0" width={w} height={h} fill="url(#colbg)" />
  </Svg>
);

// 上端フェード（原本の mask-image:linear-gradient(transparent 0, #000 22px) 相当）
const TopFade: React.FC<{ w: number }> = ({ w }) => (
  <Svg style={styles.topFade} width={w} height={FADE_H} pointerEvents="none">
    <Defs>
      <SvgLinear id="fade" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#0a0a1c" stopOpacity={1} />
        <Stop offset="1" stopColor="#0a0a1c" stopOpacity={0} />
      </SvgLinear>
    </Defs>
    <Rect x="0" y="0" width={w} height={FADE_H} fill="url(#fade)" />
  </Svg>
);

// 金属フレーム付きのタイル（.deck-card::before の同心フレーム）
const MetalTile: React.FC<{ uri: string; w: number; h: number }> = ({ uri, w, h }) => (
  <View style={{ width: w, height: h }}>
    {/* 金属フレーム: inset -1.6px・角丸11.6px・160deg グラデ */}
    <Svg
      style={{ position: 'absolute', left: -FRAME_INSET, top: -FRAME_INSET }}
      width={w + FRAME_INSET * 2}
      height={h + FRAME_INSET * 2}
      pointerEvents="none"
    >
      <Defs>
        {/* 160deg ≒ 左上→右下寄りの斜め */}
        <SvgLinear id="metal" x1="0.18" y1="0" x2="0.82" y2="1">
          <Stop offset="0" stopColor="#E7EAEF" />
          <Stop offset="0.46" stopColor="#ABB1BB" />
          <Stop offset="1" stopColor="#D0D5DC" />
        </SvgLinear>
      </Defs>
      <Rect
        x="0"
        y="0"
        width={w + FRAME_INSET * 2}
        height={h + FRAME_INSET * 2}
        rx={FRAME_RADIUS}
        ry={FRAME_RADIUS}
        fill="url(#metal)"
      />
    </Svg>
    <Image
      source={{ uri }}
      style={{
        width: w,
        height: h,
        borderRadius: TILE_RADIUS,
        borderWidth: 1,
        borderColor: C.imgRing,
      }}
      resizeMode="cover"
    />
  </View>
);

export const CollectionScreen: React.FC<Props> = ({
  owned,
  wishlist,
  onOpenTrack,
  onOpenWish,
  onBuy,
  onDiscover,
  purchase,
}) => {
  const t = useT();
  const titleTop = useTopInset(14); // 従来 58px（=44+14）
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [seg, setSeg] = useState<Segment>('mine');
  const [purchaseTarget, setPurchaseTarget] = useState<CollectionItem | null>(null);

  // ウィッシュの金額表示。ストアのローカライズ価格を正とし、未取得のときだけ
  // pricing.ts の ¥2,500 にフォールバックする。
  // （item.priceLabel は buyLabel()＝「購入する ¥2,500」でボタン全体のラベルのため、
  //   そのまま t('collection.buy', { price }) に渡すと「購入する 購入する ¥2,500」になる）
  const priceOf = (item: CollectionItem) =>
    purchase?.displayPriceOf(item.id) ?? formatPrice(TRACK_PRICE_JPY);

  // 購入成立でモーダルを閉じ、成立したときだけ onBuy を通知する。
  // コレクション側では泡演出を出さない（ホームの購入完了演出＝RisingBubbles が正）。
  useEffect(() => {
    if (!purchase) return;
    return purchase.onSuccess((trackId) => {
      setPurchaseTarget((prev) => (prev && prev.id === trackId ? null : prev));
      const bought = wishlist.find((w) => w.id === trackId);
      if (bought) onBuy(bought);
    });
  }, [purchase, wishlist, onBuy]);

  // 3列: (画面幅 - 左右padding - 列間×2) / 3。タイルは aspect 2:3
  const colW = (screenW - PAD_X * 2 - COL_GAP * (COLS - 1)) / COLS;
  const colH = colW * 1.5;
  const wishW = (screenW - PAD_X * 2 - WISH_GAP * (WISH_COLS - 1)) / WISH_COLS;
  const wishH = wishW * 1.5;

  // マイコレは常に21枠。所有分を先頭から詰め、残りは通し番号だけの枠。
  const mineSlots: MineSlot[] = Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
    key: owned[i]?.id ?? `empty-${i}`,
    item: owned[i] ?? null,
    no: String(i + 1).padStart(2, '0'),
  }));

  // ── マイコレの1枠 ──
  const renderMineSlot = ({ item: slot, index }: { item: MineSlot; index: number }) => (
    <Animated.View
      key={`mine-${slot.key}`}
      entering={FadeInUp.duration(420).delay((index % 8) * 55)}
      style={{ width: colW, marginBottom: ROW_GAP }}
    >
      {slot.item ? (
        <Pressable onPress={() => onOpenTrack(slot.item!.id)}>
          <MetalTile uri={slot.item.artworkUrl} w={colW} h={colH} />
          {/* 所有タイルの番号: 上6px・opacity.65 */}
          <Text style={styles.filledNum}>{slot.no}</Text>
        </Pressable>
      ) : (
        <View style={[styles.emptySlot, { width: colW, height: colH }]}>
          <Text style={styles.slotNum}>{slot.no}</Text>
        </View>
      )}
    </Animated.View>
  );

  // ── ウィッシュの1枠（2列・角丸13.9px・下部に曲名と購入ボタン） ──
  const renderWish = ({ item, index }: { item: CollectionItem; index: number }) => (
    <Animated.View
      key={`wish-${item.id}`}
      entering={FadeInUp.duration(420).delay((index % 8) * 55)}
      style={{ width: wishW, marginBottom: WISH_GAP }}
    >
      <Pressable onPress={() => onOpenWish(item.id)} style={styles.wishSlot}>
        <Image
          source={{ uri: item.artworkUrl }}
          style={{ width: wishW, height: wishH }}
          resizeMode="cover"
        />
        {/* 下部グラデ＋曲名＋購入ボタン（.wl-go） */}
        <View style={styles.wishGo}>
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <SvgLinear id="wgo" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor="#05040c" stopOpacity={0.9} />
                <Stop offset="1" stopColor="#05040c" stopOpacity={0} />
              </SvgLinear>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#wgo)" />
          </Svg>
          <Text style={styles.wishName} numberOfLines={1}>{item.title}</Text>
          <Pressable
            style={({ pressed }) => [styles.wishBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              purchase?.dismiss(); // 前回の失敗表示を持ち越さない
              setPurchaseTarget(item);
            }}
          >
            <Text style={styles.wishBtnLabel} numberOfLines={1}>
              {t('collection.buy', { price: priceOf(item) })}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1c" />
      <PanelBackground w={screenW} h={screenH} />

      {/* タイトル（.skh: 上58px / 18px / 字間.05em） */}
      <Text style={[styles.skh, { paddingTop: titleTop }]}>{t('collection.title')}</Text>

      {/* タブ（.col-tabs: 左右22px / 下線 rgba(96,206,224,.15)） */}
      <View style={styles.colTabs}>
        {(['mine', 'wish'] as Segment[]).map((k) => (
          <Pressable key={k} style={styles.colTab} onPress={() => setSeg(k)}>
            <Text style={[styles.colTabText, seg === k && styles.colTabTextOn]}>
              {k === 'mine' ? t('collection.owned') : t('collection.wishlist')}
            </Text>
            {seg === k && <View style={styles.colTabUnderline} />}
          </Pressable>
        ))}
      </View>

      {/* グリッド（上端フェード付き） */}
      <View style={styles.pagesWrap}>
        {seg === 'mine' ? (
          <FlatList
            data={mineSlots}
            key="mine"
            keyExtractor={(s) => s.key}
            renderItem={renderMineSlot}
            numColumns={COLS}
            columnWrapperStyle={{ gap: COL_GAP }}
            contentContainerStyle={styles.pages}
            showsVerticalScrollIndicator={false}
          />
        ) : wishlist.length === 0 ? (
          <View style={styles.empty}>
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
            renderItem={renderWish}
            numColumns={WISH_COLS}
            columnWrapperStyle={{ gap: WISH_GAP }}
            contentContainerStyle={styles.pages}
            showsVerticalScrollIndicator={false}
          />
        )}
        <TopFade w={screenW} />
      </View>

      <PurchaseModal
        visible={purchaseTarget != null}
        target={
          purchaseTarget
            ? {
                id: purchaseTarget.id,
                title: purchaseTarget.title,
                priceLabel: priceOf(purchaseTarget),
                artworkUrl: purchaseTarget.artworkUrl,
              }
            : null
        }
        state={purchase?.state ?? 'idle'}
        reason={purchase?.reason}
        // 金額 / 確定ボタンのどちらも OS の課金シートを起動する。
        // 所有化と onBuy は成立してから（上の purchase.onSuccess）行う。
        onConfirm={() => {
          if (purchaseTarget) purchase?.start(purchaseTarget.id);
        }}
        onCancel={() => {
          setPurchaseTarget(null);
          purchase?.dismiss();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a1c' },

  // .skh: padding 58px 22px 6px / 18px / 字間.05em / #ECEEF7
  skh: {
    paddingTop: 58,
    paddingHorizontal: PAD_X,
    paddingBottom: 6,
    fontSize: 18,
    letterSpacing: 0.9,
    color: C.text,
  },

  // .col-tabs / .col-tab
  colTabs: {
    flexDirection: 'row',
    marginHorizontal: PAD_X,
    borderBottomWidth: 1,
    borderBottomColor: C.tabBorder,
  },
  colTab: { flex: 1, paddingTop: 12, paddingBottom: 10, alignItems: 'center' },
  colTabText: { fontSize: 11, letterSpacing: 1.54, color: C.sub },
  colTabTextOn: { color: C.text },
  colTabUnderline: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: -1,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: C.cyan,
  },

  // .deck-pages: padding 24px 22px 78px ＋ 上端フェード22px
  pagesWrap: { flex: 1 },
  pages: {
    paddingTop: PAD_TOP,
    paddingHorizontal: PAD_X,
    paddingBottom: PAD_BOTTOM,
  },
  topFade: { position: 'absolute', left: 0, top: 0 },

  // .deck-slot.empty
  emptySlot: {
    borderRadius: TILE_RADIUS,
    backgroundColor: C.emptyBg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.emptyBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // .slot-num（空スロット: 中央）
  slotNum: { fontSize: 11, letterSpacing: 2.2, color: C.slotNum },
  // .deck-slot.filled .slot-num（所有: 上6px・opacity.65）
  filledNum: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 6,
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.filledNum,
    opacity: 0.65,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  // ウィッシュ（.wl-slot / .wl-go / .wl-name / .wl-btn）
  wishSlot: { borderRadius: WISH_RADIUS, overflow: 'hidden', position: 'relative' },
  wishGo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 40,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  wishName: { fontSize: 12, letterSpacing: 0.6, color: C.text, marginBottom: 7 },
  wishBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.wishBtnBorder,
    borderRadius: 11,
  },
  wishBtnLabel: { fontSize: 9.5, letterSpacing: 0.95, color: C.cyan },

  // 空状態
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  emptyTitle: { color: C.text, fontSize: 17, letterSpacing: 0.5 },
  emptyBody: { color: C.sub, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  discoverBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(150,165,210,0.22)',
  },
  discoverLabel: { color: C.text, fontSize: 14, letterSpacing: 0.5 },
});

export default CollectionScreen;
