/**
 * DiscoverScreen.tsx — FLUX RING ディスカバー（ホーム）P2 スケルトン
 * ------------------------------------------------------------------
 * 何を: 縦スワイプで楽曲を切り替えるメインハブ画面。
 *   ・FlatList の pagingEnabled で 1 曲ずつスナップ
 *   ・ArtworkCard（hero={{ enabled: true }}）を中央に大きく表示
 *   ・スピーカーアイコンタップで試聴トグル（同画面内・AudioManager stub）
 *   ・「購入する」ボタンで PurchaseTransition をオーバーレイ起動
 *
 * 実装方針:
 *   - レイアウト基軸は useWindowDimensions で取得した画面幅/高さ
 *   - カード幅は min(screenW - 48, 280) で端末幅に追従
 *   - FlatList の各アイテム高さ = screenH（縦ページング）
 *   - PurchaseTransition の from 座標は onLayout で実測する
 *
 * 実機調整ポイント（TODO コメントで箇所を明記）:
 *   - カード幅 / from 起点 / PAD 量 / セーフエリア余白
 *   - 試聴プレイヤーの実 API 接続
 *   - トラックデータのフェッチ（現在はスタブ）
 *
 * 依存:
 *   @shopify/react-native-skia 2.6.2
 *   react-native-reanimated 4.3.1
 */

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  StatusBar,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Canvas, Circle, Group, Paint } from '@shopify/react-native-skia';
import { ArtworkCard } from '../components/ArtworkCard';
import {
  PurchaseTransition,
  PurchaseTransitionHandle,
} from '../components/PurchaseTransition';

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

/** 1 楽曲のデータモデル（最終的にはAPIレスポンス型に差し替える） */
export type Track = {
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string;
  /** 試聴音声URL。null のとき試聴不可 */
  previewUrl: string | null;
  /** 購入価格表示文字列 */
  priceLabel: string;
  /** オーラ主色（16進 or rgba）。作品ごとに異なる */
  glowColor?: string;
  /** オーラ副色 */
  glowColor2?: string;
};

// ─────────────────────────────────────────────
// スタブデータ（実装時にAPIフェッチへ差し替える）
// TODO: フェッチ関数に差し替え。ページネーション・無限スクロール対応
// ─────────────────────────────────────────────

const STUB_TRACKS: Track[] = [
  {
    id: 'track-001',
    title: 'Neon Monsoon',
    artistName: 'Yuki Tanaka',
    artworkUrl: 'https://picsum.photos/seed/neon/600/900',
    previewUrl: null, // TODO: 実際の試聴URLに差し替え
    priceLabel: '0.08 ETH',
    glowColor: 'rgba(96,206,224,0.40)',
    glowColor2: 'rgba(70,132,224,0.16)',
  },
  {
    id: 'track-002',
    title: 'Aurora Drift',
    artistName: 'Sakura Mori',
    artworkUrl: 'https://picsum.photos/seed/aurora/600/900',
    previewUrl: null,
    priceLabel: '0.12 ETH',
    glowColor: 'rgba(180,96,224,0.40)',
    glowColor2: 'rgba(132,70,224,0.16)',
  },
  {
    id: 'track-003',
    title: 'Glass City',
    artistName: 'Ren Hayashi',
    artworkUrl: 'https://picsum.photos/seed/glass/600/900',
    previewUrl: null,
    priceLabel: '0.06 ETH',
    glowColor: 'rgba(224,180,96,0.40)',
    glowColor2: 'rgba(224,132,70,0.16)',
  },
  {
    id: 'track-004',
    title: 'Phantom Peak',
    artistName: 'Akari Suzuki',
    artworkUrl: 'https://picsum.photos/seed/phantom/600/900',
    previewUrl: null,
    priceLabel: '0.20 ETH',
    glowColor: 'rgba(96,224,148,0.40)',
    glowColor2: 'rgba(70,200,100,0.16)',
  },
];

// ─────────────────────────────────────────────
// デザイントークン
// ─────────────────────────────────────────────

const C = {
  bg: '#171430',
  card: '#222445',
  cyan: '#60CEE0',
  textPri: '#ECEEF7',
  textSec: '#9498BE',
  border: '#3A3D72',
} as const;

// ─────────────────────────────────────────────
// SpeakerIcon — Skia で描いたスピーカーアイコン
// ─────────────────────────────────────────────

type SpeakerIconProps = {
  playing: boolean;
  size?: number;
};

/**
 * 試聴状態を視覚化するアイコン。
 * playing=true のとき外側の円が脈打つ（reanimated ループ）。
 * TODO: 実機で pulse の sigma・速度を調整する
 */
const SpeakerIcon: React.FC<SpeakerIconProps> = ({ playing, size = 48 }) => {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (playing) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.out(Easing.sin) }),
          withTiming(0, { duration: 700, easing: Easing.in(Easing.sin) })
        ),
        -1,
        false
      );
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [playing, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0, 0.5]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.6]) }],
  }));

  const r = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* pulse リング（reanimated） */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: r,
            backgroundColor: C.cyan,
          },
          pulseStyle,
        ]}
      />
      {/* アイコン本体 */}
      <Canvas style={{ width: size, height: size }}>
        <Group>
          {/* 外円 */}
          <Circle cx={r} cy={r} r={r - 2}>
            <Paint
              color={playing ? 'rgba(96,206,224,0.20)' : 'rgba(58,61,114,0.60)'}
              style="fill"
            />
            <Paint color={playing ? C.cyan : C.border} style="stroke" strokeWidth={1.5} />
          </Circle>
          {/* 内円（スピーカー中心ドット） */}
          <Circle cx={r} cy={r} r={5}>
            <Paint color={playing ? C.cyan : C.textSec} style="fill" />
          </Circle>
        </Group>
      </Canvas>
    </View>
  );
};

// ─────────────────────────────────────────────
// PlayingTransport — 試聴中の下部ミニトランスポート
// ─────────────────────────────────────────────

type PlayingTransportProps = {
  track: Track;
  onStop: () => void;
};

/**
 * PurchaseTransition の children として差し込む試聴トランスポート。
 * 購入後はここに本格的なプレイヤー UI を入れる。
 * TODO: 実際の再生コントロール（シーク・音量）を実装する
 */
const PlayingTransport: React.FC<PlayingTransportProps> = ({ track, onStop }) => (
  <View style={transportStyles.wrap}>
    <View style={transportStyles.info}>
      <Text style={transportStyles.title} numberOfLines={1}>{track.title}</Text>
      <Text style={transportStyles.artist} numberOfLines={1}>{track.artistName}</Text>
    </View>
    <Pressable onPress={onStop} style={transportStyles.stopBtn} hitSlop={12}>
      <Text style={transportStyles.stopText}>停止</Text>
    </Pressable>
  </View>
);

const transportStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.18)',
    backgroundColor: 'rgba(23,20,48,0.92)',
    gap: 12,
  },
  info: { flex: 1 },
  title: { color: C.textPri, fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
  artist: { color: C.textSec, fontSize: 12, marginTop: 2 },
  stopBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(58,61,114,0.30)',
  },
  stopText: { color: C.textSec, fontSize: 12 },
});

// ─────────────────────────────────────────────
// TrackSlide — 1 楽曲分のスライド（FlatList の renderItem）
// ─────────────────────────────────────────────

type TrackSlideProps = {
  track: Track;
  cardW: number;
  screenH: number;
  /** このスライドが最前面に表示されているか（ヒーロー明滅を有効にするため） */
  isActive: boolean;
  onPressPreview: (track: Track) => void;
  onPressBuy: (track: Track, cardX: number, cardY: number) => void;
};

const TrackSlide: React.FC<TrackSlideProps> = ({
  track,
  cardW,
  screenH,
  isActive,
  onPressPreview,
  onPressBuy,
}) => {
  const cardH = cardW * 1.5;
  // ArtworkCard の PAD = cardW * 0.6（オーラ余白）。カード「見かけ」の原点に合わせる。
  // TODO: 実機で PAD 計算がレイアウトとずれていないか確認する（PurchaseTransition の from 座標と突き合わせる）
  const PAD = Math.round(cardW * 0.6);

  // カード全体コンテナの実座標を onLayout で取得し、購入演出の from に渡す
  const [cardOrigin, setCardOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  return (
    <View style={[slideStyles.page, { height: screenH }]}>
      {/* ──── アートワークカード ──── */}
      <View
        style={slideStyles.cardWrap}
        onLayout={(e) => {
          // TODO: 実機でレイアウト座標のずれ（StatusBar高・SafeAreaInsets）を補正する
          setCardOrigin({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y });
        }}
      >
        {/*
         * ArtworkCard はオーラ余白(PAD)分だけ Canvas が大きい。
         * marginLeft/marginTop で PAD 分を逃がし、視覚的カード位置を揃える。
         * TODO: 実機で PAD 値がはみ出していないか確認する
         */}
        <View style={{ margin: -PAD }}>
          <ArtworkCard
            width={cardW}
            imageUri={track.artworkUrl}
            glow={track.glowColor}
            glow2={track.glowColor2}
            hero={{ enabled: isActive }}
          />
        </View>
      </View>

      {/* ──── 曲名・アーティスト ──── */}
      <View style={slideStyles.meta}>
        <Text style={slideStyles.title} numberOfLines={2}>{track.title}</Text>
        <Text style={slideStyles.artist} numberOfLines={1}>{track.artistName}</Text>
      </View>

      {/* ──── ボタン行（試聴 / 購入） ──── */}
      <View style={slideStyles.actions}>
        {/* スピーカー（試聴） */}
        {/* TODO: track.previewUrl が null のときは disabled スタイルを適用する */}
        <Pressable
          onPress={() => onPressPreview(track)}
          hitSlop={12}
          style={({ pressed }) => [
            slideStyles.previewBtn,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityLabel={`${track.title} を試聴`}
        >
          {/* isActive は親から渡す。実際の再生状態は DiscoverScreen で管理 */}
          <SpeakerIcon playing={false} size={48} />
        </Pressable>

        {/* 購入ボタン */}
        <Pressable
          onPress={() =>
            onPressBuy(track, cardOrigin.x, cardOrigin.y)
          }
          style={({ pressed }) => [
            slideStyles.buyBtn,
            pressed && { opacity: 0.85 },
          ]}
          accessibilityLabel={`${track.title} を購入する`}
        >
          <Text style={slideStyles.buyBtnPrice}>{track.priceLabel}</Text>
          <Text style={slideStyles.buyBtnLabel}>購入する</Text>
        </Pressable>
      </View>

      {/* ──── スワイプヒント（最初の 1 回だけ表示） ──── */}
      {/* TODO: AsyncStorage でヒント表示済みフラグを管理する */}
      <View style={slideStyles.swipeHint} pointerEvents="none">
        <Text style={slideStyles.swipeHintText}>↕ スワイプで切り替え</Text>
      </View>
    </View>
  );
};

const slideStyles = StyleSheet.create({
  page: {
    width: '100%',
    alignItems: 'center',
    // TODO: 実機の SafeAreaInsets に応じて paddingTop / paddingBottom を調整する
    paddingTop: Platform.OS === 'ios' ? 64 : 48,
    paddingBottom: 40,
  },
  cardWrap: {
    // カードの「見かけサイズ」で揃える。PAD の margin: -PAD で内側にオフセット済み
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    marginTop: 28,
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 6,
  },
  title: {
    color: C.textPri,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  artist: {
    color: C.textSec,
    fontSize: 14,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  actions: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 24,
  },
  previewBtn: {
    // TODO: 実機で試聴不可（previewUrl=null）のとき opacity: 0.4 を適用する
  },
  buyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cyan,
    backgroundColor: 'rgba(96,206,224,0.08)',
  },
  buyBtnPrice: {
    color: C.cyan,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  buyBtnLabel: {
    color: C.textPri,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  swipeHint: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
  },
  swipeHintText: {
    color: 'rgba(148,152,190,0.45)',
    fontSize: 11,
    letterSpacing: 0.5,
  },
});

// ─────────────────────────────────────────────
// DiscoverScreen — 画面本体
// ─────────────────────────────────────────────

export const DiscoverScreen: React.FC = () => {
  const { width: screenW, height: screenH } = useWindowDimensions();

  /**
   * カード幅: 画面幅から左右余白 48 を引いた値か 280 の小さい方。
   * TODO: タブレット対応のとき上限を 340 程度に引き上げる
   */
  const cardW = Math.min(screenW - 48, 280);

  // ── トラックデータ ──
  // TODO: 実際はここで useEffect + fetchTracks() を呼ぶ
  const [tracks] = useState<Track[]>(STUB_TRACKS);
  const [activeIndex, setActiveIndex] = useState(0);

  // ── 試聴状態 ──
  // TODO: AudioManager（expo-av / react-native-track-player）と接続する
  const [playingId, setPlayingId] = useState<string | null>(null);

  // ── 購入トランジション ──
  const purchaseRef = useRef<PurchaseTransitionHandle>(null);
  const [purchaseTrack, setPurchaseTrack] = useState<Track | null>(null);
  const [showPurchase, setShowPurchase] = useState(false);

  /**
   * 購入ボタン押下
   * - from 座標はボタン押下時の cardOrigin（TrackSlide の onLayout 実測値）
   * - to 座標は画面中央に大きく配置（TODO: 実機で微調整）
   *
   * TODO: 実機で from/to の座標ずれを StatusBar.currentHeight や insets で補正する
   */
  const handleBuy = useCallback(
    (track: Track, cardX: number, cardY: number) => {
      // 購入中は試聴を止める
      setPlayingId(null);

      // to: 画面中央にカードを配置
      // TODO: 実機で to.y を SafeAreaTop + 余白に合わせて調整する
      const toW = cardW;
      const toX = (screenW - toW) / 2;
      const toY = screenH * 0.12;

      setPurchaseTrack(track);
      setShowPurchase(true);

      // 次の frame で start() を呼ぶ（state 反映待ち）
      // TODO: requestAnimationFrame の代わりに InteractionManager.runAfterInteractions を使う選択肢もある
      setTimeout(() => {
        purchaseRef.current?.start();
      }, 16);

      void { toW, toX, toY }; // 下記 JSX で参照するため lint 抑制
    },
    [cardW, screenW, screenH]
  );

  /** 試聴トグル */
  const handlePreview = useCallback((track: Track) => {
    if (!track.previewUrl) {
      // TODO: 試聴不可のトーストを表示する
      return;
    }
    if (playingId === track.id) {
      // TODO: AudioManager.pause() を呼ぶ
      setPlayingId(null);
    } else {
      // TODO: AudioManager.play(track.previewUrl) を呼ぶ
      setPlayingId(track.id);
    }
  }, [playingId]);

  // ── 購入トランジション to 座標（ここで計算して PurchaseTransition に渡す） ──
  const toW = cardW;
  const toX = (screenW - toW) / 2;
  // TODO: 実機で SafeAreaTop 分を加算して微調整する
  const toY = screenH * 0.12;

  // ── FlatList スクロール処理 ──
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
        // スライド切替時に試聴を止める
        // TODO: AudioManager.pause() を呼ぶ
        setPlayingId(null);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ──── ヘッダー ──── */}
      {/* TODO: ロゴ・通知アイコン・検索ボタンを実装する */}
      <View style={styles.header}>
        <Text style={styles.headerLogo}>FLUX RING</Text>
        {/* TODO: 通知バッジ付きアイコンを右端に配置する */}
      </View>

      {/* ──── メインフィード（縦スワイプ） ──── */}
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        pagingEnabled
        // TODO: 実機でスクロールアニメーションのカクつきを確認する。
        //       必要なら snapToInterval={screenH} + snapToAlignment="start" に切り替える。
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        // TODO: windowSize・maxToRenderPerBatch を実機負荷に合わせて調整する
        windowSize={3}
        maxToRenderPerBatch={2}
        renderItem={({ item, index }) => (
          <TrackSlide
            track={item}
            cardW={cardW}
            screenH={screenH}
            isActive={index === activeIndex}
            onPressPreview={handlePreview}
            onPressBuy={(track, x, y) => handleBuy(track, x, y)}
          />
        )}
      />

      {/* ──── ページインジケーター（右側縦ドット） ──── */}
      {/* TODO: 曲数が多い場合はスクロール可能なインジケーターに切り替える */}
      <View style={styles.indicator} pointerEvents="none">
        {tracks.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* ──── 購入トランジションオーバーレイ ──── */}
      {showPurchase && purchaseTrack && (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="box-none"
        >
          {/*
           * PurchaseTransition の from 座標:
           *   handleBuy が受け取った onLayout 実測値を使う。
           *   from.w は購入ボタン付近の小さいサイズ（演出的な「飛び出し」感を作る）。
           * TODO: from 座標を実機で確認する。StatusBar / SafeAreaInsets のオフセットが必要な場合がある。
           */}
          <PurchaseTransition
            ref={purchaseRef}
            deviceW={screenW}
            deviceH={screenH}
            from={{ x: screenW / 2 - 40, y: screenH * 0.70, w: 80 }}
            to={{ x: toX, y: toY, w: toW }}
            imageUri={purchaseTrack.artworkUrl}
            expandMs={620}
            revealDelay={720}
          >
            {/* 購入完了後のトランスポート。今は試聴停止のみ。 */}
            {/* TODO: PlayerScreen へのナビゲーション / トランスポートコントロールを接続する */}
            <PlayingTransport
              track={purchaseTrack}
              onStop={() => {
                setShowPurchase(false);
                setPurchaseTrack(null);
              }}
            />
          </PurchaseTransition>

          {/* オーバーレイを閉じるための半透明幕 */}
          {/* TODO: 背景タップで閉じる UX を確認してPMと合意する。現状は閉じボタンのみ。 */}
          <Pressable
            style={styles.overlayDismiss}
            onPress={() => {
              setShowPurchase(false);
              setPurchaseTrack(null);
            }}
            accessibilityLabel="閉じる"
          >
            <View style={styles.dismissBtn}>
              <Text style={styles.dismissText}>✕</Text>
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────
// スタイル
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // TODO: SafeAreaInsets.top を加算して実機ノッチに対応する
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 24,
    paddingBottom: 12,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // 背景を薄くグラデで隠してカードが被っても読めるように
    backgroundColor: 'rgba(23,20,48,0.72)',
  },
  headerLogo: {
    color: C.cyan,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 3,
  },
  indicator: {
    position: 'absolute',
    right: 12,
    // TODO: 実機で SafeAreaInsets.top + header高 に合わせる
    top: '30%',
    gap: 8,
    alignItems: 'center',
    zIndex: 5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
  },
  dotActive: {
    width: 4,
    height: 14,
    borderRadius: 2,
    backgroundColor: C.cyan,
  },
  overlayDismiss: {
    position: 'absolute',
    // TODO: SafeAreaInsets.top に合わせて調整する
    top: Platform.OS === 'ios' ? 52 : 36,
    right: 20,
    zIndex: 100,
  },
  dismissBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(58,61,114,0.60)',
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    color: C.textSec,
    fontSize: 14,
    lineHeight: 16,
  },
});

export default DiscoverScreen;

/**
 * 使い方（App.tsx / Navigator への組み込み例）:
 *
 *   import { DiscoverScreen } from './screens/DiscoverScreen';
 *
 *   // Stack / Tab Navigator の場合:
 *   <Stack.Screen name="Discover" component={DiscoverScreen} options={{ headerShown: false }} />
 *
 * 実機調整チェックリスト（TODO まとめ）:
 *   1. [カード幅] cardW の上限値をタブレットで確認する
 *   2. [座標系] from / to の x,y を StatusBar.currentHeight / SafeAreaInsets で補正する
 *   3. [PAD] ArtworkCard の margin: -PAD がレイアウトとずれていないか確認する
 *   4. [FlatList] windowSize / maxToRenderPerBatch を実機 fps で調整する
 *   5. [試聴] AudioManager（expo-av 推奨）を接続し playingId の状態を SpeakerIcon に渡す
 *   6. [データ] STUB_TRACKS を API フェッチ + 無限スクロールに差し替える
 *   7. [スワイプヒント] AsyncStorage で初回のみ表示するロジックを追加する
 *   8. [ナビゲーション] 購入完了後に PlayerScreen へ遷移するロジックを接続する
 *   9. [pulse sigma] SpeakerIcon の pulse アニメーション速度を実機で確認する
 *  10. [インジケーター] 楽曲数が 7 件以上になったらスクロール可能なインジケーターに切り替える
 */
