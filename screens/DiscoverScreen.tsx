/**
 * DiscoverScreen.tsx — ディスカバー（ホーム）P2 / 楽曲購入画面
 * ------------------------------------------------------------------
 * 参考: fr_discover_v50.html + component_catalog v50（HTMLは移植せず RN 化）。
 *
 * レイアウト（固定クローム＋横スワイプのカードページャ）:
 *   ・ブランド「Flux Ring」左上
 *   ・右上: 試聴中の EQ / 通知ベル(未読赤点) / 試聴スピーカー
 *   ・タイトル＋情景の言葉 左上
 *   ・中央: v98準拠カード（角丸作品画像＋オーラ。アクティブ面は実3D）
 *   ・下部: 発光する購入ボタン ＋ ウィッシュリスト星（所有時は再生＝星非表示）
 *   ・横スワイプで曲切替（左=次 / 右=前）
 *
 * フッターは App.tsx が描画（この画面は body 内・フッターの上に収まる）。
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  StatusBar,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useAudioPlayer } from 'expo-audio';
import { previewUrl } from '../lib/r2';
import { CardFace } from '../components/CardFace';
import { NebulaBand } from '../components/NebulaBand';
import { StarSeal } from '../components/StarSeal';
import { CardGL } from '../components/CardGL';
import type { CardBackData } from '../components/CardBack';
import { BuyButton } from '../components/BuyButton';
import { WishlistStar } from '../components/WishlistStar';
import { PurchaseModal } from '../components/PurchaseModal';
import { EqBars } from '../components/EqBars';
import { , PreviewIcon } from '../components/icons';
import { useTopInset } from '../lib/safeArea';
import { PurchaseParticles } from '../components/PurchaseParticles';
import { PurchaseCardGlow } from '../components/PurchaseCardGlow';
import { PURCHASE, FLIP_BACK_SCALE, HOME_CARD_W } from '../constants/design-tokens';
import { formatPrice, TRACK_PRICE_JPY } from '../constants/pricing';
import { JP_SERIF_FONT } from '../constants/fonts';
import type { PurchaseController } from '../lib/usePurchaseFlow';

const C = {
  page: '#0E0C20',
  text: '#ECEEF7',
  sub: '#9498BE',
  badge: '#E0584E',
} as const;

export type Track = {
  id: string;
  title: string;
  subtitle?: string;        // 情景の言葉（効能は語らない）
  artistName: string;
  artworkUrl: string;
  audioKey: string;         // R2 音源キー（試聴は公開・フルは署名付き）
  previewUrl: string | null;
  priceLabel: string;
  owned?: boolean;
  glowColor?: string;
  glowColor2?: string;
  // 裏面（タップで表示する説明）
  back?: {
    serial?: string;         // 'No. 001'
    story?: string;          // 情景の言葉（裏面の本文）
    materials?: string[];    // 原材料（例: ['朝の空気', '低い持続音']）
    tuning?: string;         // 調律名（例: '純正律'）
    frequencies?: string[];  // 周波数のみ（例: ['432 Hz', '7.83 Hz']）
    artist?: string;         // 'NAOKI OKA'
  };
};

type Props = {
  tracks?: Track[];
  hasUnread?: boolean;
  onOpenNotifications?: () => void;
  /** 購入が**成立した**ときだけ呼ばれる（キャンセル・失敗では呼ばない） */
  onBuy?: (track: Track) => void;
  /** 起動時に最初に表示するカードの id（コレクションのウィッシュから飛んできたとき用） */
  focusTrackId?: string | null;
  /** 所有している trackId（App.tsx の usePurchaseFlow から。Firestore が正） */
  ownedIds?: Set<string>;
  /** 購入フロー。未指定なら購入ボタンは押しても何も起きない（ギャラリー表示用） */
  purchase?: PurchaseController;
  /** 所有済みカードの「再生」ボタン押下 → 再生画面を開く。未指定なら何も起きない */
  onPlay?: (trackId: string) => void;
};

// フォールバック用スタブ（App からは stubData を渡す）
const FALLBACK: Track[] = [
  {
    id: 't1', title: '冬明け', subtitle: '夜明け前、まだ青い部屋に最初の光がにじむ',
    artistName: '岡ナオキ', artworkUrl: 'https://picsum.photos/seed/fuyuake/640/960',
    audioKey: 'blue', previewUrl: null, priceLabel: '¥2,500',
    glowColor: 'rgba(96,206,224,0.42)', glowColor2: 'rgba(70,132,224,0.16)',
    back: {
      serial: 'No. 001',
      story: '夜明け前、まだ青い部屋に最初の光がにじむ。音は何も足さず、ただ部屋の温度をわずかに上げていく。',
      materials: ['純正律'],
      frequencies: ['432 Hz', '7.83 Hz'],
      artist: 'NAOKI OKA',
    },
  },
];

export const DiscoverScreen: React.FC<Props> = ({
  tracks = FALLBACK,
  hasUnread = true,
  onOpenNotifications,
  onBuy,
  focusTrackId,
  ownedIds,
  purchase,
  onPlay,
}) => {
  // ウィッシュから飛んできたときは、その曲のカードを最初に表示する。
  const initialIndex = focusTrackId
    ? Math.max(0, tracks.findIndex((t) => t.id === focusTrackId))
    : 0;
  // 上部クローム（ブランド／右上アイコン／タイトル）はセーフエリア下へ寄せる。
  // 原本 v98 は top:22/26/58 の相対配置。その間隔を保ったまま、最上段の
  // topRight を insets.top + 8 に合わせて全体を同じだけ下げる。
  const topRightY = useTopInset(8);
  const chromeShift = topRightY - 22;
  const [slideH, setSlideH] = useState(0);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [flipped, setFlipped] = useState(false); // アクティブカードが裏面か（横スクロール可否用）
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  // 購入の光粒子演出（元のカード位置から下部いっぱいに舞い上がる）
  const [showPurchaseFx, setShowPurchaseFx] = useState(false);
  // 購入確認ポップアップの対象（null=非表示）
  const [purchaseTarget, setPurchaseTarget] = useState<Track | null>(null);
  // 購入は成立したが、まだ「再生」表示に切り替えていない trackId。
  // 演出が立ち切る前にボタンが変わると、事後報告に見えるため一拍待たせる。
  const [pendingReveal, setPendingReveal] = useState<Set<string>>(new Set());

  const { width: screenW } = useWindowDimensions();
  const active = tracks[activeIndex] ?? tracks[0];
  // 調律陣（StarSeal）のスケール基準。v98 カルーセル確定値 BASE_W = 164 × 1.15 = 188.6 で、
  // この値のとき陣が参照実装と 1:1 になる。陣は検証済みの確定値なのでここは動かさない。
  const SEAL_REF_W = 189;
  // カードだけを陣より一回り小さくして、陣とカードのバランスをモック寄りにする。
  // HOME_CARD_W は design-tokens.ts に切り出し済み（PlayerScreen が裏面の
  // 絶対サイズをホームに揃えるために参照するため）。
  const cardW = HOME_CARD_W;
  const cardH = Math.round(cardW * 1.5);
  const cardRadius = Math.round(0.085 * cardW); // CardAura と同じ角丸比率

  // 裏返し時、拡大されたカード（FLIP_BACK_SCALE）が下部の購入ボタン／ウィッシュ星と
  // 被るため、flipped の間は隠すのではなく、拡大後のカード下端よりさらに下へ
  // スライドさせて「カードの下」に表示する（カードの拡大率はStorySeal等と同じく
  // 実機調整済みの確定値のためカード側は動かさない）。
  const BOTTOM_BASE = 109 + slideH * 0.02; // 通常時（表向き）の bottom 値
  const FLIPPED_GAP = 16; // 拡大カード下端からの余白
  // カードはスライド内で縦中央に配置される（styles.slide）ため、中心から
  // 拡大後の半分の高さぶん下が裏面カードの下端。そこに GAP を足した位置まで
  // 沈める。極端に小さい画面でも張り付きすぎないよう最低16pxは確保する。
  const flippedBottom = Math.max(
    16,
    slideH / 2 - (cardH * FLIP_BACK_SCALE) / 2 - FLIPPED_GAP,
  );
  const bottomChromeT = useSharedValue(0);
  useEffect(() => {
    bottomChromeT.value = withTiming(flipped ? 1 : 0, {
      duration: 260,
      easing: Easing.inOut(Easing.quad),
    });
  }, [flipped, bottomChromeT]);
  const bottomChromeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bottomChromeT.value * (BOTTOM_BASE - flippedBottom) }],
  }));

  // 購入確定時のカード発光・浮遊（PurchaseCardGlow ＋ このカード自身のtranslate/scale）
  const cardGlow = useSharedValue(0);
  const cardTranslateY = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const cardFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardTranslateY.value }, { scale: cardScale.value }],
  }));

  // フェーズ1(0-400ms)発光イン＋持ち上げ／フェーズ2(400-1000ms)微浮遊のまま保持／
  // フェーズ3(1000-1600ms)発光・位置ともに元へ収束
  const triggerCardGlow = useCallback(() => {
    const rise = { duration: 400, easing: Easing.out(Easing.quad) };
    const settle = { duration: 600, easing: Easing.inOut(Easing.quad) };
    cardGlow.value = withSequence(withTiming(1, rise), withDelay(600, withTiming(0, settle)));
    cardTranslateY.value = withSequence(withTiming(-10, rise), withDelay(600, withTiming(0, settle)));
    cardScale.value = withSequence(withTiming(1.02, rise), withDelay(600, withTiming(1, settle)));
  }, [cardGlow, cardTranslateY, cardScale]);

  // 試聴プレイヤー（30秒・公開URL）
  const preview = useAudioPlayer();

  // カード裏面の刻印データ。renderItem 内でオブジェクトリテラルを組むと
  // 再レンダーのたびに参照が変わり、CardGL 内の裏面テクスチャ生成 useEffect
  // （依存に backData を持つ）が毎回走ってしまう。刻印は 1024×1536 の Skia
  // サーフェスを同期生成するため、タップ直後にこれが挟まると数十〜百ms級の
  // ヒッチになり、フリップ演出のフレームを丸ごと食う。曲一覧が変わらない限り
  // 同じ参照を返して再生成を止める。
  const backDataById = useMemo(() => {
    const m = new Map<string, CardBackData>();
    for (const t of tracks) {
      m.set(t.id, {
        title: t.title,
        serial: t.back?.serial,
        story: t.back?.story ?? t.subtitle,
        materials: t.back?.materials,
        tuning: t.back?.tuning,
        frequencies: t.back?.frequencies,
        artist: t.back?.artist,
      });
    }
    return m;
  }, [tracks]);

  const onRootLayout = (e: LayoutChangeEvent) => setSlideH(e.nativeEvent.layout.height);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
        // 曲が変わったら横スクロールを必ず復活（旧アクティブの CardGL は
        // アンマウントされるので表裏状態も自然にリセットされる）
        setFlipped(false);
      }
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // 試聴は自動開始しない（スピーカーボタンの押下だけをトリガーにする）。
  // 曲を切り替えたら再生中の試聴は止める。
  // ※フェードインは音源ファイル側で定義する方針のため、アプリ側では行わない。
  useEffect(() => {
    preview.pause();
    setPlayingId(null);
  }, [activeIndex, preview]);

  const togglePreview = useCallback(() => {
    if (!active) return;
    if (playingId === active.id) {
      preview.pause();
      setPlayingId(null);
      return;
    }
    const url = active.previewUrl ?? previewUrl(active.audioKey);
    if (!url) return; // 試聴未設定（R2 未設定）
    preview.replace({ uri: url });
    preview.play();
    setPlayingId(active.id);
  }, [active, playingId, preview]);

  const toggleWishlist = useCallback((id: string) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // 所有判定。pendingReveal に居る間は「まだ所有していない」ように見せる（演出の順序のため）
  const isOwned = useCallback(
    (track?: Track | null) => {
      if (!track) return false;
      if (pendingReveal.has(track.id)) return false;
      return track.owned === true || ownedIds?.has(track.id) === true;
    },
    [ownedIds, pendingReveal],
  );

  // 「購入する」押下 → まず購入確認ポップアップを開く（所有済みは再生画面へ）
  const handleBuy = useCallback(() => {
    if (!active) return;
    if (isOwned(active)) {
      onPlay?.(active.id);
      return;
    }
    purchase?.dismiss(); // 前回の失敗表示を持ち越さない
    setPurchaseTarget(active);
  }, [active, isOwned, purchase, onPlay]);

  // ポップアップの金額 or 確定ボタン → OS の課金シートへ。
  // ここでは所有状態も演出も動かさない。成立したかどうかは purchase.onSuccess で受ける
  // （requestPurchase の戻り値は結果ではないため）。
  const confirmPurchase = useCallback(() => {
    const target = purchaseTarget;
    if (!target) return;
    setPlayingId(null);
    purchase?.start(target.id);
  }, [purchaseTarget, purchase]);

  // モーダルを閉じる（キャンセル／閉じる／暗幕タップ）。所有状態は変えない
  const closePurchase = useCallback(() => {
    setPurchaseTarget(null);
    purchase?.dismiss();
  }, [purchase]);

  // ── 購入成立後の順序 ──
  // (1) モーダルを fade out → (2) PURCHASE.sheetSettleMs 待つ（Modal の消え際と
  // OS 課金シートの dismiss に演出を重ねない）→ (3) 光粒子をマウント＋カード発光/浮遊を
  // トリガー → (4) PURCHASE.ownedRevealDelayMs 後に所有済み化して購入ボタンを「再生」へ →
  // (5) onDone で光粒子をアンマウント、画面遷移はしない（ホームに留まる）。
  //
  // PurchaseTransition（拡大＋星点火＋トランスポート）はここでは使わない。
  // ホームの完了演出は PurchaseParticles＋PurchaseCardGlow を正とする（元のカード位置
  // で光粒子が舞い上がり、カード自身がふわっと発光・浮遊する。複製カードは出さない
  // 方針を維持するため）。PurchaseTransition は ComponentGallery の部品デモとして据え置き。
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onBuyRef = useRef(onBuy);
  onBuyRef.current = onBuy;

  useEffect(() => {
    if (!purchase) return;
    return purchase.onSuccess((trackId) => {
      const bought = tracks.find((tr) => tr.id === trackId);
      setPurchaseTarget(null);
      setPlayingId(null);
      setPendingReveal((prev) => new Set(prev).add(trackId));
      if (bought) onBuyRef.current?.(bought);

      timersRef.current.push(
        setTimeout(() => {
          setShowPurchaseFx(true);
          triggerCardGlow();
          timersRef.current.push(
            setTimeout(() => {
              setPendingReveal((prev) => {
                const next = new Set(prev);
                next.delete(trackId);
                return next;
              });
            }, PURCHASE.ownedRevealDelayMs),
          );
        }, PURCHASE.sheetSettleMs),
      );
    });
  }, [purchase, tracks, triggerCardGlow]);

  // アンマウント時に演出タイマーを止める（解放後の setState を防ぐ）
  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    },
    [],
  );

  const isPreviewing = playingId != null && playingId === active?.id;

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      <StatusBar barStyle="light-content" backgroundColor={C.page} />

      {/* 最背面: 天の川バンド（NebulaBand）。カード左上あたりに紫の星雲が
          密集する帯を敷く全面背景（自身が bgbase グラデーションも描く）。
          調律陣（StarSeal）はこの上に重ねる装飾レイヤーで、背景自体を置き換えない。 */}
      <NebulaBand />

      {/* 調律陣の背景。スケール基準はカード幅（cardW）に固定する。
          画面基準（width/heightのみ）だとタブレットで画面ごと拡大され、
          カードに対して陣だけが不釣り合いに巨大化する（iPad実測で参照比1.71倍）。
          中心は実際にカードが描かれる位置（スライド中央）に一致させる。 */}
      {slideH > 0 && (
        <StarSeal
          width={screenW}
          height={slideH}
          cardWidth={SEAL_REF_W}
          centerX={screenW / 2}
          centerY={slideH / 2}
          style={styles.sealLayer}
        />
      )}

      {/* カードページャ。表面=横スワイプで曲切替＋タップで裏返し、
          裏面=全方向360°回転（横スワイプは無効） */}
      {slideH > 0 && (
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.id}
          horizontal
          pagingEnabled
          scrollEnabled={!flipped}
          showsHorizontalScrollIndicator={false}
          extraData={activeIndex}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: screenW, offset: screenW * index, index })}
          renderItem={({ item, index }) => (
            <View style={[styles.slide, { width: screenW, height: slideH }]}>
              {index === activeIndex ? (
                // アクティブ面: v98準拠の実3Dカード（角丸・厚み・オーラ）。
                // 表面=角丸の作品画像＋タップで180°横回転で裏返し / 裏面=
                // アルミ刻印面（再生画面と同一デザイン）＋全方向360°回転。
                // タップ→フリップは内部完結（FlatList のセル再レンダーに依存しない）。
                // Animated.View でラップし、購入確定時だけ浮遊(translateY/scale)させる。
                <Animated.View style={[{ width: cardW, height: cardH }, cardFloatStyle]}>
                  {showPurchaseFx && (
                    <PurchaseCardGlow width={cardW} height={cardH} radius={cardRadius} glow={cardGlow} />
                  )}
                  <CardGL
                    mode="flip"
                    backStyle="aluminum"
                    frontUri={item.artworkUrl}
                    width={cardW}
                    height={cardH}
                    aura={{ a: item.glowColor, b: item.glowColor2 }}
                    onFlipChange={setFlipped}
                    backData={backDataById.get(item.id)}
                  />
                </Animated.View>
              ) : (
                // 非アクティブは軽量な静止カード（角丸＋オーラ・v98の表面と同一デザイン）
                <CardFace
                  uri={item.artworkUrl}
                  width={cardW}
                  height={cardH}
                  auraA={item.glowColor}
                  auraB={item.glowColor2}
                />
              )}
            </View>
          )}
        />
      )}

      {/* ── 固定クローム（active に連動） ── */}
      <View style={styles.chrome} pointerEvents="box-none">
        {/* ブランド */}
        <Text style={[styles.brand, { top: 26 + chromeShift }]}>Flux Ring</Text>

        {/* 右上: ベル+EQ(1段目) / 試聴(2段目)。EQ は試聴中だけ動く
            （試聴を止めたらボリュームアニメーションも消える）。
            1段目はベルを左・EQメーターを右の順で並べる。 */}
        <View style={[styles.topRight, { top: topRightY + 5 }]} pointerEvents="box-none">
          <View style={styles.iconsRow1}>
            <Pressable onPress={onOpenNotifications} hitSlop={10} style={styles.bell}>
              <BellIcon size={24} />
              {hasUnread && <View style={styles.bdot} />}
            </Pressable>
            <EqBars active={isPreviewing} />
          </View>
          <Pressable onPress={togglePreview} hitSlop={10} style={styles.iconsRow2}>
            <PreviewIcon size={24} on={isPreviewing} />
          </Pressable>
        </View>

        {/* タイトル（1行のみ。eyeコピー・情景サブタイトルはモック確定値により非表示） */}
        <View style={[styles.texts, { top: 41 + chromeShift }]} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>{active?.title}</Text>
        </View>

        {/* 下部: 購入ボタン ＋ ウィッシュ星。
            裏返し中は拡大されたカードと被るため、下スライドして「カードの下」に
            表示位置を移す（隠さず常に見える・タップも可能なまま）。 */}
        <Animated.View
          style={[styles.bottom, { bottom: BOTTOM_BASE }, bottomChromeStyle]}
          pointerEvents="box-none"
        >
          {(() => {
            const owned = isOwned(active);
            return (
              <>
                <BuyButton
                  owned={owned}
                  priceLabel={active ? purchase?.displayPriceOf(active.id) : undefined}
                  onPress={handleBuy}
                />
                {/* 所有済みでは星を非表示 */}
                {!owned && (
                  <View style={styles.starSlot}>
                    <WishlistStar
                      inWishlist={active ? wishlist.has(active.id) : false}
                      onToggle={() => active && toggleWishlist(active.id)}
                    />
                  </View>
                )}
              </>
            );
          })()}
        </Animated.View>
      </View>

      {/* 購入の光粒子（画面下部から舞い上がる・複製カードは出さない） */}
      {showPurchaseFx && slideH > 0 && (
        <PurchaseParticles
          width={screenW}
          height={slideH}
          onDone={() => setShowPurchaseFx(false)}
        />
      )}

      {/* 購入確認ポップアップ。
          金額はストアのローカライズ価格（displayPrice）を正とし、未取得のときだけ
          pricing.ts の ¥2,500 にフォールバックする。track.priceLabel は
          buyLabel()（「購入する ¥2,500」）でボタン全体のラベルなので使わない。 */}
      <PurchaseModal
        visible={purchaseTarget != null}
        target={
          purchaseTarget
            ? {
                id: purchaseTarget.id,
                title: purchaseTarget.title,
                priceLabel:
                  purchase?.displayPriceOf(purchaseTarget.id) ?? formatPrice(TRACK_PRICE_JPY),
                artworkUrl: purchaseTarget.artworkUrl,
              }
            : null
        }
        state={purchase?.state ?? 'idle'}
        reason={purchase?.reason}
        onConfirm={confirmPurchase}
        onCancel={closePurchase}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.page },
  slide: { alignItems: 'center', justifyContent: 'center' },
  sealLayer: { position: 'absolute', top: 0, left: 0 },

  chrome: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  brand: {
    position: 'absolute',
    // top は SafeArea を加味して JSX 側で上書き（既定は原本 v98 の値）
    top: 26, left: 22,
    fontSize: 10, letterSpacing: 4, color: 'rgba(148,152,190,0.45)', fontWeight: '300',
  },
  topRight: { position: 'absolute', top: 22, right: 20, alignItems: 'flex-end' },
  iconsRow1: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  iconsRow2: { marginTop: 10 },
  bell: {},
  bdot: {
    position: 'absolute', top: -1, right: -1,
    width: 6, height: 6, borderRadius: 3, backgroundColor: C.badge,
  },
  texts: { position: 'absolute', left: 22, right: 120, top: 58 },
  // .title: 18px / 字間.05em / text-shadow 0 1px 10px rgba(0,0,0,.5)
  title: {
    fontSize: 18,
    letterSpacing: 0.36, // fontSize×0.02
    color: C.text,
    fontFamily: JP_SERIF_FONT, // 和文＝明朝（ゴシックで出ていたのを修正）
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },

  // .bottom: 原本 bottom:calc(146px + 2vh)（フッター54px込みのデバイス基準）。
  // 本アプリはフッターを親が描くため、本体領域基準へ 54px 差し引いて 92px + 2vh。
  bottom: {
    position: 'absolute', left: 0, right: 0,
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
