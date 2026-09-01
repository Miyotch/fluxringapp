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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  StyleSheet,
  StatusBar,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CardGL } from '../components/CardGL';
import Svg, { Defs, LinearGradient as SvgLinear, Stop, Rect, RadialGradient as SvgRadial } from 'react-native-svg';
import { PurchaseModal } from '../components/PurchaseModal';
import { StarIcon } from '../components/icons';
import type { CardOrigin, CardOriginItem } from '../components/CardAfterimage';
import { useT } from '../lib/i18n';
import { useTopInset } from '../lib/safeArea';
import { formatPrice, TRACK_PRICE_JPY } from '../constants/pricing';
import { useAudioPlayer } from 'expo-audio';
import { previewUrl as r2PreviewUrl } from '../lib/r2';
import { NUM_FONT, JP_SERIF_FONT } from '../constants/fonts';
import type { PurchaseController } from '../lib/usePurchaseFlow';

export type CollectionItem = {
  id: string;
  title: string;
  artworkUrl: string;
  owned: boolean;
  audioKey?: string;         // R2 音源キー（再生画面へ）
  priceLabel?: string;       // ウィッシュ用
  serialNo?: string;         // 'No. 003'。ウィッシュリストとマイコレを同じ番号軸で読ませる
  subtitle?: string;         // 情景の言葉（作品詳細の1行）
  /** 試聴URL。null/未設定なら audioKey から R2 の固定名で組む。どちらも無ければ試聴なし */
  previewUrl?: string | null;
  glowColor?: string;
  glowColor2?: string;
  /** カード裏面の刻印。作品詳細の 3D カード（CardGL）でホーム・再生画面と同じ裏面を出す */
  back?: {
    serial?: string;
    story?: string;
    materials?: string[];
    tuning?: string;
    frequencies?: string[];
    artist?: string;
  };
};

// 参照 fr_v98_wish.html の col-tabs（すべて / 所有 / ウィッシュリスト）
type Segment = 'all' | 'mine' | 'wish';
const SEGMENTS: Segment[] = ['all', 'mine', 'wish'];

type Props = {
  owned: CollectionItem[];
  wishlist: CollectionItem[];
  /**
   * 所有曲タップ → 再生画面。
   * origin はタップされたタイルの画面絶対座標（フライトイン演出の起点）。
   * afterimages はタップ時点でコレクション画面に見えていた所有済みタイル
   * すべての座標＋アートワーク（残像を残す全箇所）。
   */
  onOpenTrack: (id: string, origin?: CardOrigin, afterimages?: CardOriginItem[]) => void;
  /** 購入が**成立した**ときだけ呼ばれる（キャンセル・失敗では呼ばない） */
  onBuy: (item: CollectionItem) => void;
  onDiscover: () => void;                // 「作品と出会う」→ ディスカバー
  /** ウィッシュリストから外す（タイル右上の★）。未指定なら★を出さない */
  onRemoveWish?: (trackId: string) => void;
  /** 連作の総数。ウィッシュリストの「どこまで集まったか」を出すために使う */
  totalWorks?: number;
  /**
   * 連作の全作品（通し番号順）。「すべて」の板をこの並びで描く。
   * 未指定なら所有＋ウィッシュから組み立てる（部品デモ用のフォールバック）。
   */
  allWorks?: CollectionItem[];
  /** ★のトグル（作品詳細から）。未指定なら詳細に★を出さない */
  onToggleWish?: (trackId: string) => void;
  /** ★が付いている trackId。未指定なら wishlist 配列から判定する */
  wishlistIds?: Set<string>;
  /** 購入フロー。未指定なら購入ボタンは押しても何も起きない */
  purchase?: PurchaseController;
};

// View.measureInWindow はコールバック形式なので、複数タイルを Promise.all で
// まとめて測れるよう薄くラップする。
const measureView = (node: View) =>
  new Promise<CardOrigin>((resolve) => {
    node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });

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

// ── タブの横スワイプ切替（実機調整ポイント） ──
// 中身は縦スクロールの FlatList なので、「明確に横」のときだけ引き取る。
const SWIPE_CLAIM_PX = 12;    // これだけ横に動いたら判定を始める
const SWIPE_H_RATIO = 1.4;    // |dx| がこの倍率で |dy| を上回ること（縦スクロールを奪わない）
const SWIPE_COMMIT_PX = 48;   // 切替を確定する移動量
const SWIPE_COMMIT_VX = 0.35; // 速いフリックはこの速度で確定（移動量が短くても切替）

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

// soon … まだ作品が存在しない席。番号を出すと「その番号の作品はもうある」と
//        読めてしまうので、実体のある作品数より先は Coming Soon に置き換える。
type MineSlot = { key: string; item: CollectionItem | null; no: string; soon: boolean };

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
  onBuy,
  onDiscover,
  onRemoveWish,
  totalWorks,
  allWorks,
  onToggleWish,
  wishlistIds,
  purchase,
}) => {
  const t = useT();
  const titleTop = useTopInset(14); // 従来 58px（=44+14）
  const { width: screenW, height: screenH } = useWindowDimensions();
  // 参照の既定タブは「すべて」。連作の全体像を先に見せ、そこから所有／欲しいへ絞る。
  const [seg, setSeg] = useState<Segment>('all');
  const [purchaseTarget, setPurchaseTarget] = useState<CollectionItem | null>(null);
  // 枠タップで立ち上がる作品詳細（参照 .work）。null=閉じている
  const [detailId, setDetailId] = useState<string | null>(null);
  // 試聴中の trackId。ホーム（DiscoverScreen）と同じ expo-audio の使い方に揃える
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const preview = useAudioPlayer();
  // ウィッシュリストから買った直後に出す一行（「《朝靄》は No. 003 の枠へ。」）
  const [movedNote, setMovedNote] = useState<string | null>(null);
  // タップされたタイルの画面絶対座標を測るための参照（再生画面の残像アニメーション用）
  const tileRefs = useRef<Map<string, View>>(new Map());

  // タブの横スワイプ切替。中身は縦スクロールの FlatList なので、
  // Capture 側で「明確に横」のジェスチャだけ先に引き取る。
  //   ・非 Capture だと FlatList が先に応答者になり、スワイプが届かないことがある
  //   ・横優位（|dx| > 1.4×|dy|）に限定するので、通常の縦スクロールは奪わない
  const segSwipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        Math.abs(g.dx) > SWIPE_CLAIM_PX && Math.abs(g.dx) > Math.abs(g.dy) * SWIPE_H_RATIO,
      onPanResponderRelease: (_e, g) => {
        const far = Math.abs(g.dx) >= SWIPE_COMMIT_PX;
        const fast = Math.abs(g.vx) >= SWIPE_COMMIT_VX;
        if (!far && !fast) return; // 迷い程度の動きでは切り替えない
        // タブは [すべて, 所有, ウィッシュ] の並び。左スワイプ=次 / 右スワイプ=前。
        setSeg((prev) => {
          const i = SEGMENTS.indexOf(prev);
          const next = i + (g.dx < 0 ? 1 : -1);
          return SEGMENTS[Math.max(0, Math.min(SEGMENTS.length - 1, next))];
        });
      },
    }),
  ).current;

  // ウィッシュの金額表示。ストアのローカライズ価格を正とし、未取得のときだけ
  // pricing.ts の ¥2,500 にフォールバックする。
  // （item.priceLabel は buyLabel()＝「購入する ¥2,500」でボタン全体のラベルのため、
  //   そのまま t('collection.buy', { price }) に渡すと「購入する 購入する ¥2,500」になる）
  const priceOf = (item: CollectionItem) =>
    purchase?.displayPriceOf(item.id) ?? formatPrice(TRACK_PRICE_JPY);

  // 「すべて」の板に並べる作品。連作の定位置＝この配列の順序がそのまま枠の順序。
  const works = useMemo<CollectionItem[]>(() => {
    if (allWorks && allWorks.length) return allWorks;
    // フォールバック（部品デモ）。所有→ウィッシュの順で重複を除く
    const seen = new Set<string>();
    const merged: CollectionItem[] = [];
    for (const w of [...owned, ...wishlist]) {
      if (seen.has(w.id)) continue;
      seen.add(w.id);
      merged.push(w);
    }
    return merged;
  }, [allWorks, owned, wishlist]);

  const ownedIds = useMemo(() => new Set(owned.map((o) => o.id)), [owned]);
  const wishIds = useMemo(
    () => wishlistIds ?? new Set(wishlist.map((w) => w.id)),
    [wishlistIds, wishlist],
  );

  // 枠の状態は参照 render() と同じ3値。'none' は決定どおり A（番号のみ）で描く。
  const slotState = useCallback(
    (id: string): 'own' | 'wish' | 'none' =>
      ownedIds.has(id) ? 'own' : wishIds.has(id) ? 'wish' : 'none',
    [ownedIds, wishIds],
  );

  // 30秒試聴。ホームと同じく「もう一度押す＝止める」。
  const togglePreview = useCallback(
    (item: CollectionItem) => {
      if (previewingId === item.id) {
        preview.pause();
        setPreviewingId(null);
        return;
      }
      const url = item.previewUrl ?? (item.audioKey ? r2PreviewUrl(item.audioKey) : null);
      if (!url) return; // 試聴未設定
      preview.replace({ uri: url });
      preview.play();
      setPreviewingId(item.id);
    },
    [previewingId, preview],
  );

  const stopPreview = useCallback(() => {
    if (previewingId == null) return;
    preview.pause();
    setPreviewingId(null);
  }, [previewingId, preview]);

  // タブを移ったら試聴は止める（見えていない作品が鳴り続けないように）
  useEffect(() => {
    stopPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seg]);
  // 画面を離れるときの停止は「何もしない」のが正しい。
  // useAudioPlayer は内部の useReleasingSharedObject が unmount の cleanup で
  // player.release() を呼ぶ。そのフックはこの画面の先頭（238行目）で呼ばれている＝
  // React はフック宣言順に cleanup を走らせるので、release() が先に効く。
  // そのあとで pause() を呼ぶと解放済みのネイティブ shared object を触ることになり、
  // JS の fatal exception → RCTFatal → SIGABRT で落ちる（カードを押して再生画面や
  // ホームへ移った瞬間にこの画面が unmount されるため、そこで必ず踏む）。
  // release() 自体が再生を止めるので、音が鳴り続ける心配はない。

  const detail = useMemo(
    () => (detailId ? works.find((w) => w.id === detailId) ?? null : null),
    [detailId, works],
  );

  // ── 作品詳細のカード ────────────────────────────────────────────
  // 平らな Image ではなく、ホーム／再生画面と同じ CardGL を置く。タップで表↔裏、
  // 裏面は指で回せる。板・ウィッシュ・マイコレのどこから開いても同じカードを
  // 触ることになる（以前は所有タイルだけが本物のカードで、他は静止画だった）。
  // 参照の .wcard は枠幅43%（≒149px）だったが、静止画ではなく触れるカードに
  // なったので、タイル（約100px）から開いたときに「拡大した」と分かる大きさへ
  // 上げる。画面高に対する比で決め、下の番号・曲名・3ボタンが押し出されない
  // よう 330px で頭打ちにする（iPhone SE の高さでも収まる）。
  const workCardH = Math.min(
    Math.round(screenH * 0.42),
    330,
    Math.round((screenW - PAD_X * 2) * 1.5),
  );
  const workCardW = Math.round(workCardH / 1.5);
  // frame は「カードを収める枠の実寸」。CardGL はこれを基に
  //   裏面の拡大率 S = min(1.28, 枠幅*0.86/カード幅, 枠高*0.82/カード高)
  //   持ち上げ量   = 枠高 * 0.03（上へ）
  // を決める。画面全体（screenH）を枠として渡すと S が上限 1.28 に張り付き、
  // さらに持ち上げが 25px 以上になって、フリップした裏面が上の「戻る」まで
  // 覆ってしまった。ホームは枠＝カルーセル領域であって画面全体ではない。
  //
  // ここではカード高の 1.45 倍を枠として渡す。S は 0.82*1.45 = 1.189 で頭打ちに
  // なり、持ち上げも 0.0435*カード高 に収まる。裏面が上へ出る量は
  //   カード高*(S-1)/2 + 持ち上げ ≒ カード高 * 0.138
  // で、下の CARD_HEADROOM がその実測ぶんの余白。
  const workCardFrame = useMemo(
    () => ({ width: screenW, height: Math.round(workCardH * 1.45) }),
    [screenW, workCardH],
  );
  // フリップした裏面が上へせり出す量ぶんの余白。これを空けておかないと
  // 「戻る」が裏面の下に隠れる。
  const cardHeadroom = Math.ceil(workCardH * 0.138) + 8;
  // 裏面の刻印。参照が変わるたび 1024×1536 の Skia サーフェスを同期生成するので、
  // 開いている作品が変わったときだけ作り直す（DiscoverScreen と同じ規律）。
  const workBackData = useMemo(
    () =>
      detail
        ? {
            title: detail.title,
            serial: detail.back?.serial ?? detail.serialNo,
            story: detail.back?.story ?? detail.subtitle,
            materials: detail.back?.materials,
            tuning: detail.back?.tuning,
            frequencies: detail.back?.frequencies,
            artist: detail.back?.artist ?? 'NAOKI OKA',
          }
        : undefined,
    [detail],
  );

  // タイル→カードのフライトイン。マイコレのタイルから再生画面を開くときと同じ
  // 演出（PlayerScreen の①）を、この面の中で完結させる。押したタイルの矩形に
  // 同じ見かけサイズで重ねてから、詳細のカード位置へ 400ms で寄せる。
  const flightFrom = useRef<CardOrigin | null>(null);
  const workCardRef = useRef<View>(null);
  const cardTX = useSharedValue(0);
  const cardTY = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const cardFlightStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cardTX.value },
      { translateY: cardTY.value },
      { scale: cardScale.value },
    ],
  }));

  // 詳細のカード枠のレイアウトが決まった瞬間に、押したタイルから飛ばす。
  // measureInWindow はアニメを載せていない外枠に対して呼ぶ（変形中のノードを
  // 測ると着地点がずれる）。
  const onWorkCardLayout = useCallback(() => {
    const from = flightFrom.current;
    const node = workCardRef.current;
    flightFrom.current = null;
    if (!from || !node) return;
    node.measureInWindow((x, y, w, h) => {
      if (!w || !h) return;
      const flight = { duration: 400, easing: Easing.out(Easing.cubic) };
      cardTX.value = from.x + from.width / 2 - (x + w / 2);
      cardTY.value = from.y + from.height / 2 - (y + h / 2);
      cardScale.value = from.width / w;
      cardTX.value = withTiming(0, flight);
      cardTY.value = withTiming(0, flight);
      cardScale.value = withTiming(1, flight);
    });
  }, [cardScale, cardTX, cardTY]);

  // 板／ウィッシュのタイル。押した矩形を測ってから詳細を開く（測れなければ
  // フライトインなしでそのまま開く＝演出が出ないだけで動作は同じ）。
  const detailRefs = useRef<Map<string, View>>(new Map());
  const openDetail = useCallback(async (id: string, refKey: string) => {
    const node = detailRefs.current.get(refKey);
    flightFrom.current = node ? await measureView(node) : null;
    setDetailId(id);
  }, []);

  // 詳細を閉じるときは変形をリセットする（次に開いたときに前回の残りから
  // 始まらないように）。
  const closeDetail = useCallback(() => {
    stopPreview();
    setDetailId(null);
    flightFrom.current = null;
    cardTX.value = 0;
    cardTY.value = 0;
    cardScale.value = 1;
  }, [cardScale, cardTX, cardTY, stopPreview]);

  // 購入成立でモーダルを閉じ、成立したときだけ onBuy を通知する。
  // コレクション側では演出を出さない（ホームの購入完了演出＝PurchaseParticles が正）。
  //
  // ただしウィッシュリストから買ったときだけは一行残す。ウィッシュリストのタイルは所有になった瞬間に
  // 黙って消える（wishlistItems から外れる）ので、そのままだと「買ったのに
  // 減った」という引き算の体験になる。どの枠へ移ったかを言い切ってから消す。
  useEffect(() => {
    if (!purchase) return;
    return purchase.onSuccess((trackId) => {
      setPurchaseTarget((prev) => (prev && prev.id === trackId ? null : prev));
      const bought = wishlist.find((w) => w.id === trackId);
      if (bought) {
        setMovedNote(
          t('collection.movedTo', { title: bought.title, serial: bought.serialNo ?? '' }).trim(),
        );
        onBuy(bought);
      }
    });
  }, [purchase, wishlist, onBuy, t]);

  // 移動の一行は数秒で静かに引く（残し続けると通知のように読める）
  useEffect(() => {
    if (!movedNote) return;
    const id = setTimeout(() => setMovedNote(null), 3200);
    return () => clearTimeout(id);
  }, [movedNote]);

  // 3列: (画面幅 - 左右padding - 列間×2) / 3。タイルは aspect 2:3
  const colW = (screenW - PAD_X * 2 - COL_GAP * (COLS - 1)) / COLS;
  const colH = colW * 1.5;
  const wishW = (screenW - PAD_X * 2 - WISH_GAP * (WISH_COLS - 1)) / WISH_COLS;
  const wishH = wishW * 1.5;

  // マイコレは常に21枠。所有分を先頭から詰め、残りは通し番号だけの枠。
  // 実体のある作品数。これより先の席は番号ではなく Coming Soon。
  // 空席が「未所有（作品はある）」なのか「まだ作品が無い」のかは番号では
  // 区別できないので、ここだけが判断材料になる。
  const worksCount = totalWorks ?? works.length;

  const mineSlots: MineSlot[] = Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
    key: owned[i]?.id ?? `empty-${i}`,
    item: owned[i] ?? null,
    no: String(i + 1).padStart(2, '0'),
    soon: i >= worksCount,
  }));

  // ── マイコレの1枠 ──
  const renderMineSlot = ({ item: slot, index }: { item: MineSlot; index: number }) => (
    <Animated.View
      key={`mine-${slot.key}`}
      entering={FadeInUp.duration(420).delay((index % 8) * 55)}
      style={{ width: colW, marginBottom: ROW_GAP }}
    >
      {slot.item ? (
        <Pressable
          ref={(el) => {
            if (el) tileRefs.current.set(slot.key, el);
            else tileRefs.current.delete(slot.key);
          }}
          onPress={async () => {
            const id = slot.item!.id;
            const node = tileRefs.current.get(slot.key);
            if (!node) {
              onOpenTrack(id);
              return;
            }
            const tappedOrigin = await measureView(node);
            // 今この画面に見えている所有済みタイル全部（tileRefs は所有タイルにしか
            // ref を張らないので、ここに集まっているのはすべて所有分）を同時に測る。
            const ownedById = new Map(owned.map((o) => [o.id, o]));
            const measured = await Promise.all(
              Array.from(tileRefs.current.entries()).map(async ([key, n]) => {
                const item = ownedById.get(key);
                if (!item) return null;
                const origin = await measureView(n);
                return { uri: item.artworkUrl, origin };
              }),
            );
            const afterimages = measured.filter((m): m is CardOriginItem => m !== null);
            onOpenTrack(id, tappedOrigin, afterimages);
          }}
        >
          <MetalTile uri={slot.item.artworkUrl} w={colW} h={colH} />
          {/* 所有タイルの番号: 上6px・opacity.65 */}
          <Text style={styles.filledNum}>{slot.no}</Text>
        </Pressable>
      ) : (
        <View style={[styles.emptySlot, { width: colW, height: colH }]}>
          {slot.soon ? (
            <Text style={styles.slotSoon} numberOfLines={2}>{t('collection.comingSoon')}</Text>
          ) : (
            <Text style={styles.slotNum}>{slot.no}</Text>
          )}
        </View>
      )}
    </Animated.View>
  );

  // 枠の通し番号。serialNo（'No. 003'）があれば数字だけ取り出し、無ければ並び順。
  // マイコレの空枠と同じ2桁の字組に揃えて、同じ番号軸で読めるようにする。
  const slotNo = (item: CollectionItem, index: number) => {
    const digits = item.serialNo?.replace(/[^0-9]/g, '');
    return (digits && digits.replace(/^0+(?=\d)/, '').padStart(2, '0')) ||
      String(index + 1).padStart(2, '0');
  };

  // 板は最低 21 枠（マイコレと同じ盤面）。作品が足りないぶんは番号だけの空席で埋める。
  // 連作は「どこが空いているか」が見える場なので、作品数ぶんだけ縮めると盤に見えない。
  const boardSlots: MineSlot[] = Array.from(
    { length: Math.max(TOTAL_SLOTS, works.length) },
    (_, i) => ({
      key: works[i]?.id ?? `board-empty-${i}`,
      item: works[i] ?? null,
      no: works[i] ? slotNo(works[i], i) : String(i + 1).padStart(2, '0'),
      // 板は works をそのまま並べるので、item が無い＝まだ作品が無い席
      soon: !works[i],
    }),
  );

  // ── 「すべて」の板の1枠（参照 .slot の3状態） ──
  //   own  … 金属フレーム（マイコレと同じ MetalTile）
  //   wish … 沈んだアート＋シアンの内枠＋★
  //   none … 番号のみ（決定 A。未発表作品の存在を予告しない）
  //
  // ※ 沈み方は参照の filter: brightness(.52) saturate(.62) 相当。RN の Image に
  //   CSS フィルタは無いので、黒地の上に opacity .52 で重ねて brightness だけ
  //   合わせている（彩度は落としていない）。グリッド全枠に ColorMatrix を敷くと
  //   スクロールが重くなるため、ここは明度合わせに留める。
  const renderBoardSlot = ({ item: slot, index }: { item: MineSlot; index: number }) => {
    const item = slot.item;
    const no = slot.no;
    // まだ作品が入っていない席。参照の「決めが要る」枠は A（番号のみ）で確定
    if (!item) {
      return (
        <Animated.View
          key={`all-${slot.key}`}
          entering={FadeInUp.duration(420).delay((index % 8) * 55)}
          style={{ width: colW, marginBottom: ROW_GAP }}
        >
          <View style={[styles.emptySlot, { width: colW, height: colH }]}>
            <Text style={styles.slotSoon} numberOfLines={2}>{t('collection.comingSoon')}</Text>
          </View>
        </Animated.View>
      );
    }
    const state = slotState(item.id);
    return (
      <Animated.View
        key={`all-${slot.key}`}
        entering={FadeInUp.duration(420).delay((index % 8) * 55)}
        style={{ width: colW, marginBottom: ROW_GAP }}
      >
        <Pressable
          ref={(el) => {
            if (el) detailRefs.current.set(`all-${item.id}`, el);
            else detailRefs.current.delete(`all-${item.id}`);
          }}
          onPress={() => openDetail(item.id, `all-${item.id}`)}
        >
          {state === 'own' ? (
            <>
              <MetalTile uri={item.artworkUrl} w={colW} h={colH} />
              <Text style={styles.filledNum}>{no}</Text>
            </>
          ) : state === 'wish' ? (
            <View style={[styles.boardWish, { width: colW, height: colH }]}>
              <Image
                source={{ uri: item.artworkUrl }}
                style={{ width: colW, height: colH, opacity: 0.52 }}
                resizeMode="cover"
              />
              <View style={styles.boardWishEdge} pointerEvents="none" />
              <Text style={[styles.filledNum, styles.boardWishNum]}>{no}</Text>
              <View style={styles.boardWishStar} pointerEvents="none">
                <StarIcon size={13} filled />
              </View>
            </View>
          ) : (
            <View style={[styles.emptySlot, { width: colW, height: colH }]}>
              <Text style={styles.slotNum}>{no}</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  };

  // ── ウィッシュの1枠（2列・角丸13.9px） ──
  // v98 は購入ボタンをアートの上に重ねていたが、曲名と2段に積むとアートの
  // 下 1/3 が潰れる。作品を覆わないよう、タイル内には通し番号と曲名だけを残し、
  // 購入はタイルの外（下段・全幅）へ出した。
  //   ※ v98_FIX 台帳の変更禁止値（2列 / 角丸13.9 / gap12）はそのまま維持している。
  //     動かしたのは .wl-btn の位置だけ。ハンドオフには差分として記載が要る。
  const renderWish = ({ item, index }: { item: CollectionItem; index: number }) => (
    <Animated.View
      key={`wish-${item.id}`}
      entering={FadeInUp.duration(420).delay((index % 8) * 55)}
      style={{ width: wishW, marginBottom: WISH_GAP }}
    >
      {/* タップ＝作品詳細。マイコレのタイル（タップ＝再生）と同じ「押したら
          その作品が立ち上がる」挙動に揃える。以前はホームの該当カードへ
          飛ばしていたが、コレクションを見ている最中に画面ごと持って行かれる
          ので、この面の中で購入と★まで完結させる。 */}
      <Pressable
        ref={(el) => {
          if (el) detailRefs.current.set(`wish-${item.id}`, el);
          else detailRefs.current.delete(`wish-${item.id}`);
        }}
        onPress={() => openDetail(item.id, `wish-${item.id}`)}
        style={styles.wishSlot}
      >
        <Image
          source={{ uri: item.artworkUrl }}
          style={{ width: wishW, height: wishH }}
          resizeMode="cover"
        />

        {/* 通し番号。マイコレの空枠・所有枠と同じ字組で、連作の同じ軸に載せる */}
        {!!item.serialNo && (
          <Text style={styles.wishSerial} numberOfLines={1}>
            {item.serialNo}
          </Text>
        )}

        {/* ★（塗り）＝ウィッシュリストから外す。ホームまで戻らずここで畳めるように */}
        {onRemoveWish && (
          <Pressable
            style={styles.wishStar}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('collection.wishRemove')}
            onPress={() => onRemoveWish(item.id)}
          >
            <StarIcon size={15} filled />
          </Pressable>
        )}

        {/* 下部グラデ＋曲名（.wl-go） */}
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
        </View>
      </Pressable>

      {/* 試聴と購入はアートの外・横並び。ウィッシュリストは「まだ持っていない」を
          並べる場なので、所有側の「タップ＝再生」に対して、ここは
          「聴いてから決める」の 2 手（試聴／購入）を必ず出す。 */}
      <View style={styles.wishActs}>
        <Pressable
          style={({ pressed }) => [
            styles.wishBtn,
            styles.wishActBtn,
            previewingId === item.id && styles.wishBtnOn,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => togglePreview(item)}
        >
          <Text style={styles.wishBtnLabel} numberOfLines={1}>
            {previewingId === item.id ? t('collection.previewStop') : t('collection.preview')}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.wishBtn,
            styles.wishActBtn,
            styles.wishBuyBtn,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => {
            stopPreview();
            purchase?.dismiss(); // 前回の失敗表示を持ち越さない
            setPurchaseTarget(item);
          }}
        >
          <Text style={[styles.wishBtnLabel, styles.wishBuyLabel]} numberOfLines={1}>
            {t('collection.buy', { price: priceOf(item) })}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );

  // ── ウィッシュリストの見出し（集める行 ＋ 直前の移動の一行） ──
  // 進捗バーは置かない。ウィッシュリストは「まだ持っていない」を並べる場なので、
  // 達成度を煽る形にすると PRICING.md の「煽らない・売り込まない」から外れる。
  // 連作の総数と、いま自分がどこに居るかだけを静かに示す。
  const renderWishHeader = () => (
    <View style={styles.wishHeader}>
      {totalWorks != null && (
        <Text style={styles.wishProgress}>
          {t('collection.wishProgress', {
            owned: owned.length,
            total: totalWorks,
            wish: wishlist.length,
          })}
        </Text>
      )}
      {!!movedNote && <Text style={styles.wishMoved}>{movedNote}</Text>}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1c" />
      <PanelBackground w={screenW} h={screenH} />

      {/* タイトル（.skh: 上58px / 18px / 字間.05em） */}
      <Text style={[styles.skh, { paddingTop: titleTop }]}>{t('collection.title')}</Text>

      {/* タブ（.col-tabs: 左右22px / 下線 rgba(96,206,224,.15)） */}
      <View style={styles.colTabs}>
        {SEGMENTS.map((k) => {
          // 参照 .cnt: 0 件のときは数字を出さない（空の枠を数字で強調しない）
          const count = k === 'mine' ? owned.length : k === 'wish' ? wishlist.length : 0;
          const label =
            k === 'all'
              ? t('collection.all')
              : k === 'mine'
              ? t('collection.owned')
              : t('collection.wishlist');
          return (
            <Pressable key={k} style={styles.colTab} onPress={() => setSeg(k)}>
              <Text style={[styles.colTabText, seg === k && styles.colTabTextOn]} numberOfLines={1}>
                {label}
                {count > 0 ? ` ${count}` : ''}
              </Text>
              {seg === k && <View style={styles.colTabUnderline} />}
            </Pressable>
          );
        })}
      </View>

      {/* グリッド（上端フェード付き）。横スワイプでマイコレ↔ウィッシュを切替 */}
      <View style={styles.pagesWrap} {...segSwipe.panHandlers}>
        {seg === 'all' ? (
          <FlatList
            data={boardSlots}
            key="all"
            keyExtractor={(s) => s.key}
            renderItem={renderBoardSlot}
            numColumns={COLS}
            columnWrapperStyle={{ gap: COL_GAP }}
            contentContainerStyle={styles.pages}
            showsVerticalScrollIndicator={false}
          />
        ) : seg === 'mine' ? (
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
            ListHeaderComponent={renderWishHeader}
            numColumns={WISH_COLS}
            columnWrapperStyle={{ gap: WISH_GAP }}
            contentContainerStyle={styles.pages}
            showsVerticalScrollIndicator={false}
          />
        )}
        <TopFade w={screenW} />
      </View>

      {/* 枠タップで立ち上がる作品（参照 .work）。所有なら「再生する」、
          未所有なら ★ / 30秒 試聴 / 迎える の3手。ここが「再生ではなく試聴と購入」の実体。 */}
      {detail && (
        <View style={[styles.work, { paddingTop: titleTop + 8 }]}>
          <Pressable style={styles.workBack} hitSlop={10} onPress={closeDetail}>
            <Text style={styles.workBackLabel}>{`‹ ${t('collection.back')}`}</Text>
          </Pressable>

          {/* 外枠はアニメを載せない＝着地点の実測用。内側の Animated.View だけが
              タイルから飛んでくる。CardGL の Canvas はカード実寸より外へはみ出す
              （裏面が S=1.28 で拡大する）ので、ここで overflow を切ってはいけない。 */}
          <View
            ref={workCardRef}
            onLayout={onWorkCardLayout}
            style={[
              styles.workCardBox,
              { width: workCardW, height: workCardH, marginTop: cardHeadroom },
            ]}
          >
            <Animated.View
              style={[
                { width: workCardW, height: workCardH },
                slotState(detail.id) !== 'own' && styles.workCardDim,
                cardFlightStyle,
              ]}
            >
              <CardGL
                mode="flip"
                backStyle="aluminum"
                frontUri={detail.artworkUrl}
                width={workCardW}
                height={workCardH}
                shadow
                frame={workCardFrame}
                backData={workBackData}
              />
            </Animated.View>
          </View>

          {!!detail.serialNo && <Text style={styles.workNo}>{detail.serialNo}</Text>}
          <Text style={styles.workTitle} numberOfLines={1}>{detail.title}</Text>
          {!!detail.subtitle && <Text style={styles.workSub}>{detail.subtitle}</Text>}

          <View style={styles.workActs}>
            {slotState(detail.id) === 'own' ? (
              <Pressable
                style={({ pressed }) => [
                  styles.workBtn,
                  styles.workBtnSolid,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => {
                  closeDetail();
                  onOpenTrack(detail.id);
                }}
              >
                <Text style={[styles.workBtnLabel, styles.workBtnSolidLabel]}>
                  {t('collection.play')}
                </Text>
              </Pressable>
            ) : (
              <>
                {/* ★＝ウィッシュリストに置く／外す。板の空席からも入れる2つ目の登録点 */}
                {onToggleWish && (
                  <Pressable
                    style={styles.workStar}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('collection.wishRemove')}
                    onPress={() => onToggleWish(detail.id)}
                  >
                    <StarIcon size={17} filled={wishIds.has(detail.id)} />
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.workBtn,
                    previewingId === detail.id && styles.wishBtnOn,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => togglePreview(detail)}
                >
                  <Text style={styles.workBtnLabel}>
                    {previewingId === detail.id
                      ? t('collection.previewStop')
                      : t('collection.preview')}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.workBtn,
                    styles.workBtnSolid,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => {
                    stopPreview();
                    purchase?.dismiss();
                    setPurchaseTarget(detail);
                  }}
                >
                  <Text style={[styles.workBtnLabel, styles.workBtnSolidLabel]} numberOfLines={1}>
                    {t('collection.buy', { price: priceOf(detail) })}
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          <Text style={styles.workShelf}>
            {slotState(detail.id) === 'own'
              ? t('collection.ownedHere')
              : wishIds.has(detail.id)
              ? t('collection.wishHere')
              : ''}
          </Text>
        </View>
      )}

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
  slotNum: { fontSize: 11, letterSpacing: 2.2, color: C.slotNum, fontFamily: NUM_FONT }, // 通し番号＝数字表記
  // 未発表席の Coming Soon。番号と同じ字面・同じ色で、文字数ぶんだけ小さく組む
  // （枠は colW＝約100px なので 11px のままでは入らない）
  slotSoon: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.8,
    textAlign: 'center',
    paddingHorizontal: 4,
    color: C.slotNum,
    fontFamily: NUM_FONT,
    opacity: 0.85,
  },
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
    fontFamily: NUM_FONT, // 通し番号＝数字表記
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
  // .wl-name: 12px / 字間.05em / #ECEEF7 / 明朝体
  wishName: { fontSize: 12, letterSpacing: 0.6, color: C.text, fontFamily: JP_SERIF_FONT },
  // 通し番号。マイコレの filledNum（上6px・11px・字間2.2・opacity.65）に揃える
  wishSerial: {
    position: 'absolute',
    left: 10,
    top: 7,
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.filledNum,
    fontFamily: NUM_FONT,
    opacity: 0.65,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  // ★（ウィッシュリストから外す）。タップ域は 32×32、アイコンは 15px
  wishStar: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 購入ボタンはタイルの外・全幅（v98 はアート上に重ねていた）
  wishBtn: {
    marginTop: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: C.wishBtnBorder,
    borderRadius: 11,
    alignItems: 'center',
  },
  wishBtnLabel: { fontSize: 9.5, letterSpacing: 0.95, color: C.cyan, fontFamily: NUM_FONT }, // 価格＝数字表記
  // 試聴／購入の横並び。ボタン2つで幅を割るので gap は列間より詰める
  wishActs: { flexDirection: 'row', gap: 6 },
  wishActBtn: { flex: 1, paddingHorizontal: 4 },
  // 試聴中は枠を強めて「いま鳴っている」を示す（色は変えない＝シアン一本のまま）
  wishBtnOn: { borderColor: C.cyan, backgroundColor: 'rgba(96,206,224,0.12)' },
  // 購入だけ地を敷いて主従をつける（参照 .wbtn.solid 相当の軽い版）
  wishBuyBtn: { backgroundColor: 'rgba(96,206,224,0.14)' },
  wishBuyLabel: { color: C.text },

  // 「すべて」の板・ウィッシュ状態の枠（参照 .slot.wish）
  boardWish: {
    borderRadius: TILE_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#05040c', // アートを opacity .52 で沈めるための黒地
  },
  // inset 0 0 0 1px rgba(96,206,224,.5)
  boardWishEdge: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: TILE_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.5)',
  },
  boardWishNum: { color: C.cyan, opacity: 0.85 },
  boardWishStar: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 作品が立ち上がる（参照 .work）。盤・ウィッシュのどちらの枠からも開く
  work: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 14,
    backgroundColor: 'rgba(6,5,16,0.93)',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  // zIndex はカードより手前に置くため。RN は後ろの兄弟が上に描かれるので、
  // これが無いとフリップした裏面が「戻る」の上に被って押せなくなる。
  workBack: { alignSelf: 'flex-start', zIndex: 2 },
  workBackLabel: { color: C.back, fontSize: 12, letterSpacing: 0.6 },
  // 参照 .wcard 164x246（枠幅380基準 = 43%）。実寸は workCardW/H で渡す。
  // borderRadius / overflow は付けない — 角丸はカード自身（CardGL）が持っており、
  // ここでクリップすると裏面の拡大分と落影が切れる。
  // marginTop は cardHeadroom（裏面のせり出しぶん）を実寸で当てる
  workCardBox: {},
  // 未所有は沈める（参照 .wcard.dim = brightness(.62)）
  workCardDim: { opacity: 0.62 },
  workNo: { marginTop: 22, fontSize: 9.5, letterSpacing: 2.66, color: C.sub, fontFamily: NUM_FONT },
  workTitle: { marginTop: 7, fontSize: 21, letterSpacing: 1.26, color: C.text, fontFamily: JP_SERIF_FONT },
  workSub: {
    marginTop: 9,
    fontSize: 11,
    letterSpacing: 0.55,
    color: C.sub,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 18,
  },
  workActs: { flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 26 },
  workBtn: {
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.4)',
  },
  workBtnLabel: { fontSize: 10.5, letterSpacing: 1.26, color: C.cyan },
  workBtnSolid: { backgroundColor: C.cyan, borderColor: C.cyan },
  workBtnSolidLabel: { color: '#06121a' },
  workStar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workShelf: { marginTop: 14, fontSize: 9.5, letterSpacing: 0.95, color: '#5a6088' },

  // ウィッシュリストの見出し（集める行 ＋ 移動の一行）
  wishHeader: { marginBottom: 14, gap: 8 },
  wishProgress: { fontSize: 10.5, letterSpacing: 0.63, color: C.sub, fontFamily: NUM_FONT },
  wishMoved: { fontSize: 10.5, letterSpacing: 0.84, color: C.cyan, fontFamily: JP_SERIF_FONT },

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
