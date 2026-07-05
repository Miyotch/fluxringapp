/**
 * DiscoverScreen.tsx — ディスカバー（ホーム）P2 / 楽曲購入画面
 * ------------------------------------------------------------------
 * 参考: fr_discover_v50.html + component_catalog v50（HTMLは移植せず RN 化）。
 *
 * レイアウト（固定クローム＋縦スワイプのカードページャ）:
 *   ・ブランド「Flux Ring」左上
 *   ・右上: 試聴中の EQ / 通知ベル(未読赤点) / 試聴スピーカー
 *   ・タイトル＋情景の言葉 左上
 *   ・中央: ArtworkCard（hero 明滅・作品オーラ）
 *   ・下部: 発光する購入ボタン ＋ ウィッシュリスト星（所有時は再生＝星非表示）
 *   ・縦スワイプで曲切替（上=次 / 下=前）
 *
 * フッターは App.tsx が描画（この画面は body 内・フッターの上に収まる）。
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  StatusBar,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { ArtworkCard } from '../components/ArtworkCard';
import { BuyButton } from '../components/BuyButton';
import { WishlistStar } from '../components/WishlistStar';
import { BellIcon, PreviewIcon } from '../components/icons';
import {
  PurchaseTransition,
  PurchaseTransitionHandle,
} from '../components/PurchaseTransition';

const C = {
  page: '#0E0C20',
  text: '#ECEEF7',
  sub: '#9498BE',
  cyan: '#60CEE0',
  badge: '#E0584E',
} as const;

export type Track = {
  id: string;
  title: string;
  subtitle?: string;        // 情景の言葉（効能は語らない）
  artistName: string;
  artworkUrl: string;
  previewUrl: string | null;
  priceLabel: string;
  owned?: boolean;
  glowColor?: string;
  glowColor2?: string;
};

type Props = {
  tracks?: Track[];
  hasUnread?: boolean;
  onOpenNotifications?: () => void;
  onBuy?: (track: Track) => void;
};

// フォールバック用スタブ（App からは stubData を渡す）
const FALLBACK: Track[] = [
  {
    id: 't1', title: '冬明け', subtitle: '夜明け前、まだ青い部屋に最初の光がにじむ',
    artistName: '岡ナオキ', artworkUrl: 'https://picsum.photos/seed/fuyuake/640/960',
    previewUrl: null, priceLabel: '¥2,500',
    glowColor: 'rgba(96,206,224,0.42)', glowColor2: 'rgba(70,132,224,0.16)',
  },
];

// ── 試聴中の EQ バー（component_catalog: audio.on） ──
const EqBars: React.FC<{ active: boolean }> = ({ active }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = active
      ? withRepeat(withSequence(
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 500, easing: Easing.inOut(Easing.sin) }),
        ), -1, false)
      : withTiming(0, { duration: 200 });
  }, [active, p]);

  // フックは常に同数・同順で呼ぶ（条件分岐やループ内で呼ばない）
  const s0 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + p.value * 0.5 }] }));
  const s1 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + p.value * 1.0 }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + p.value * 0.7 }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.5 + p.value * 1.0 }] }));

  if (!active) return null;
  const bars = [s0, s1, s2, s3];
  return (
    <View style={styles.eq}>
      {bars.map((st, i) => (
        <Animated.View key={i} style={[styles.eqBar, { height: 5 + i * 2 }, st]} />
      ))}
    </View>
  );
};

export const DiscoverScreen: React.FC<Props> = ({
  tracks = FALLBACK,
  hasUnread = true,
  onOpenNotifications,
  onBuy,
}) => {
  const [slideH, setSlideH] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  // 購入トランジション
  const purchaseRef = useRef<PurchaseTransitionHandle>(null);
  const [purchaseTrack, setPurchaseTrack] = useState<Track | null>(null);
  const [showPurchase, setShowPurchase] = useState(false);

  const active = tracks[activeIndex] ?? tracks[0];
  const cardW = 180;

  const onRootLayout = (e: LayoutChangeEvent) => setSlideH(e.nativeEvent.layout.height);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
        setPlayingId(null); // 曲切替で試聴停止
      }
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const togglePreview = useCallback(() => {
    if (!active) return;
    // TODO: expo-av で active.previewUrl を再生/停止
    setPlayingId((cur) => (cur === active.id ? null : active.id));
  }, [active]);

  const toggleWishlist = useCallback((id: string) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleBuy = useCallback(() => {
    if (!active) return;
    setPlayingId(null);
    if (onBuy) { onBuy(active); return; }
    // ローカルで購入演出を再生
    setPurchaseTrack(active);
    setShowPurchase(true);
    setTimeout(() => purchaseRef.current?.start(), 16);
  }, [active, onBuy]);

  const isPreviewing = playingId != null && playingId === active?.id;

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      <StatusBar barStyle="light-content" backgroundColor={C.page} />

      {/* 縦スワイプのカードページャ（カードのみ） */}
      {slideH > 0 && (
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          windowSize={3}
          maxToRenderPerBatch={2}
          renderItem={({ item, index }) => (
            <View style={[styles.slide, { height: slideH }]}>
              <ArtworkCard
                width={cardW}
                imageUri={item.artworkUrl}
                glow={item.glowColor}
                glow2={item.glowColor2}
                hero={{ enabled: index === activeIndex }}
              />
            </View>
          )}
        />
      )}

      {/* ── 固定クローム（active に連動） ── */}
      <View style={styles.chrome} pointerEvents="box-none">
        {/* ブランド */}
        <Text style={styles.brand}>Flux Ring</Text>

        {/* 右上: EQ / ベル / 試聴 */}
        <View style={styles.topRight} pointerEvents="box-none">
          <View style={styles.icons}>
            <EqBars active={isPreviewing} />
            <Pressable onPress={onOpenNotifications} hitSlop={10} style={styles.bell}>
              <BellIcon size={17} />
              {hasUnread && <View style={styles.bdot} />}
            </Pressable>
            <Pressable onPress={togglePreview} hitSlop={10}>
              <PreviewIcon size={17} on={isPreviewing} />
            </Pressable>
          </View>
        </View>

        {/* タイトル＋情景 */}
        <View style={styles.texts} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>{active?.title}</Text>
          {active?.subtitle && (
            <Text style={styles.subt} numberOfLines={2}>{active.subtitle}</Text>
          )}
        </View>

        {/* 下部: 購入ボタン ＋ ウィッシュ星 */}
        <View style={styles.bottom} pointerEvents="box-none">
          <BuyButton owned={active?.owned} onPress={handleBuy} />
          {/* 所有済みでは星を非表示 */}
          {!active?.owned && (
            <View style={styles.starSlot}>
              <WishlistStar
                inWishlist={active ? wishlist.has(active.id) : false}
                onToggle={() => active && toggleWishlist(active.id)}
              />
            </View>
          )}
        </View>
      </View>

      {/* 購入トランジション */}
      {showPurchase && purchaseTrack && slideH > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <PurchaseTransition
            ref={purchaseRef}
            deviceW={400}
            deviceH={slideH}
            from={{ x: 200 - 40, y: slideH * 0.7, w: 80 }}
            to={{ x: (400 - cardW) / 2, y: slideH * 0.12, w: cardW }}
            imageUri={purchaseTrack.artworkUrl}
            expandMs={620}
            revealDelay={720}
          >
            <View style={styles.transport}>
              <Text style={styles.transportText}>{purchaseTrack.title} — 再生中</Text>
            </View>
          </PurchaseTransition>
          <Pressable
            style={styles.dismiss}
            onPress={() => { setShowPurchase(false); setPurchaseTrack(null); }}
            accessibilityLabel="閉じる"
          >
            <Text style={styles.dismissText}>✕</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.page },
  slide: { alignItems: 'center', justifyContent: 'center' },

  chrome: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  brand: {
    position: 'absolute',
    // TODO: SafeAreaInsets.top を加算
    top: 26, left: 22,
    fontSize: 10, letterSpacing: 4, color: C.sub, fontWeight: '300',
  },
  topRight: { position: 'absolute', top: 22, right: 20 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  bell: {},
  bdot: {
    position: 'absolute', top: -1, right: -1,
    width: 6, height: 6, borderRadius: 3, backgroundColor: C.badge,
  },
  eq: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 },
  eqBar: { width: 2, borderRadius: 1, backgroundColor: C.cyan },

  texts: { position: 'absolute', left: 22, right: 120, top: 58 },
  title: { fontSize: 18, letterSpacing: 0.9, color: C.text },
  subt: { fontSize: 11, color: C.sub, fontWeight: '300', marginTop: 4, lineHeight: 17 },

  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 36,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  starSlot: { position: 'absolute', left: '50%', marginLeft: 64 + 12 },

  transport: {
    paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(96,206,224,0.18)',
    backgroundColor: 'rgba(23,20,48,0.92)', alignItems: 'center',
  },
  transportText: { color: C.text, fontSize: 13, letterSpacing: 0.3 },
  dismiss: {
    position: 'absolute', top: 52, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(58,61,114,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  dismissText: { color: C.sub, fontSize: 14 },
});

export default DiscoverScreen;
