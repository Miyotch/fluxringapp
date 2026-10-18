/**
 * MyPlaylists.tsx — プレイリスト画面の曲の縦リスト（所有カード／各プレイリスト）
 * ------------------------------------------------------------------
 * 2026-10-13 カードの横スワイプから、Spotify と同じ縦のリストへ改めた。
 *   ・行を押す → その曲からこの並びで流す（画面は移らない。下の再生バナーが替わる）
 *     流れている曲の行をもう一度押すと一時停止／再開
 *   ・行の右端のカードのアイコン → その曲のカードを眺める画面（再生は変えない）
 *   ・見出しの右の丸い再生ボタン → 先頭から流す。流しているリストなら一時停止／再開
 *
 * どのリストを出すか・プルダウン・編集シートは CollectionScreen が持つ。ここは並べるだけ。
 */

import React, { useEffect, useRef } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { CARD_ASPECT } from './CardGL';
import { CardDetailIcon, PauseMark, PlayMark } from './icons';
import { EqBars } from './EqBars';
import { DownloadButton } from './DownloadButton';
import type { CardOrigin } from './CardAfterimage';
import { JP_SERIF_FONT } from '../constants/fonts';
import Svg, { Path } from 'react-native-svg';
import { useT } from '../lib/i18n';
import { usePlaybackOptional } from '../lib/playback';
import { formatBytes, useDownloads } from '../lib/downloads';
import { formatDuration, sumDurations, useDurations } from '../lib/durations';
import { showToast } from '../lib/toast';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PlaylistItem = {
  id: string;
  title: string;
  artworkUrl: string;
  serialNo?: string;
  artist?: string;
  /** 音源のキー（端末に保存するときに使う）。無ければ id */
  audioKey?: string;
};

type Props = {
  tracks: PlaylistItem[];
  /** 見出し（所有カード／プレイリスト名） */
  title: string;
  /** 再生の中枢に渡す「どこから流したか」の目印（所有カードは ALL_OWNED、リストは id） */
  source: string;
  /** その曲から、この並びで流す（画面は移らない） */
  onPlayFrom: (trackIds: string[], startId: string, source: string) => void;
  /** 先頭から流す（画面は移らない） */
  onPlayAll: (trackIds: string[], source: string) => void;
  /** カードを眺める画面を開く（再生は変えない）。origin は押した行の札の画面上の位置（開く動きの起点） */
  onViewCard: (trackIds: string[], id: string, source: string, origin?: CardOrigin) => void;
  /** 行を長押し → プレイリストに追加のシート */
  onAddToPlaylist?: (item: PlaylistItem) => void;
  /**
   * 行を長押ししたときの動きを差し替える（2026-10-18）。自分のプレイリストを見ているときは
   * 「追加」ではなく「このリストから外す／ほかのリストに追加／並べ替え」の曲のメニューを出す。
   * 指定があれば onAddToPlaylist より優先する。label は読み上げ用の説明
   */
  onRowLongPress?: (item: PlaylistItem) => void;
  rowLongPressLabel?: string;
  /** 空のリストで「曲を入れる」を押した（自分のプレイリストのときだけ渡す） */
  onEdit?: () => void;
  /** 所有曲が 0 のとき「作品と出会う」 */
  onDiscover?: () => void;
  /**
   * 'downloads' … 端末に保存した曲の一覧（2026-10-14）。見出しに曲数と大きさ・「すべて消す」、
   * 行の右端は保存の印（押すとその曲だけ消す）
   */
  variant?: 'list' | 'downloads';
  /** 見出しの名前（▾）を押した → プレイリストを選ぶシートを開く（2026-10-15） */
  onTitlePress?: () => void;
};

/** 見出しの名前の右の ▾（シアンの細い山形） */
const ChevronDown: React.FC = () => (
  <Svg width={10} height={6} viewBox="0 0 10 6" fill="none">
    <Path d="M1 1 L5 5 L9 1" stroke="#60CEE0" strokeWidth={1.2} strokeLinecap="round" />
  </Svg>
);

/** 保存済みの印（細いシアンの ↓・矢印だけ） */
const SavedArrow: React.FC = () => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
    <Path d="M12 4v13M6 11l6 6 6-6" stroke="#60CEE0" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** 長押しで追加できることを、最初に一度だけ知らせたか */
const HINT_KEY = 'fr.playlist.longPressHint.v1';
let hintChecked = false;

/** スロット 1（所有曲すべて）の目印。再生の中枢の source にもこの値を渡す */
export const ALL_OWNED = '__all__';

const C = {
  text: '#ECEEF7',
  sub: '#9498BE',
  cyan: '#60CEE0',
  line: 'rgba(96,206,224,0.15)',
};

/** 行のアートの札。カードと同じ縦横比（1:1.56）で、作品の縦の構図を切らない */
const ART_W = 40;
const ART_H = Math.round(ART_W * CARD_ASPECT);

/** 流しているリストの再生ボタンの外側の輪。流れている間だけゆっくり明滅する */
const LiveRing: React.FC<{ playing: boolean }> = ({ playing }) => {
  const v = useSharedValue(1);
  useEffect(() => {
    if (playing) {
      v.value = 1;
      v.value = withRepeat(withTiming(0.3, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      cancelAnimation(v);
      v.value = withTiming(1, { duration: 200 });
    }
    return () => cancelAnimation(v);
  }, [playing, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View pointerEvents="none" style={[styles.liveRing, style]} />;
};

export const MyPlaylists: React.FC<Props> = ({
  tracks,
  title,
  source,
  onPlayFrom,
  onPlayAll,
  onViewCard,
  onEdit,
  onDiscover,
  onAddToPlaylist,
  onRowLongPress,
  rowLongPressLabel,
  variant = 'list',
  onTitlePress,
}) => {
  const t = useT();
  const pb = usePlaybackOptional();
  const dl = useDownloads();
  // 長押しの動き。曲のメニュー（自分のプレイリスト）があればそちら、無ければ「追加」
  const longPress = onRowLongPress ?? onAddToPlaylist;
  const longPressLabel = onRowLongPress ? rowLongPressLabel ?? t('playlist.trackMenu') : t('playlist.addTo');
  const ids = tracks.map((x) => x.id);
  const keyOf = (x: PlaylistItem) => x.audioKey || x.id;
  // 曲の長さ（行の右に出す・見出しに合計を出す）。分かりしだい描き直す
  const durs = useDurations(tracks.map(keyOf));
  const durOf = new Map(tracks.map((x, i) => [x.id, durs[i]]));
  const total = sumDurations(durs);
  // 長押しで「プレイリストに追加」は目に見えないので、曲が並んだ最初の一度だけ一言で知らせる
  const hasRows = tracks.length > 0 && !!onAddToPlaylist && !onRowLongPress;
  useEffect(() => {
    if (!hasRows || hintChecked) return;
    hintChecked = true;
    AsyncStorage.getItem(HINT_KEY)
      .then((v) => {
        if (v) return;
        showToast(t('playlist.longPress'));
        AsyncStorage.setItem(HINT_KEY, '1').catch(() => {});
      })
      .catch(() => {});
  }, [hasRows, t]);
  // 行の札。カードを開くとき、押した札の位置から大きくなるように測る
  const artRefs = useRef(new Map<string, View>());
  const openCard = (id: string) => {
    const node = artRefs.current.get(id);
    if (!node) {
      onViewCard(ids, id, source);
      return;
    }
    node.measureInWindow((x, y, width, height) =>
      onViewCard(ids, id, source, width > 0 ? { x, y, width, height } : undefined),
    );
  };
  // このリストを流しているか（流している曲が、このリストから流したものか）
  const live = !!pb?.current && pb.source === source;
  const playing = live && !!pb?.playing;

  // 所有曲がまだ無い
  if (source === ALL_OWNED && tracks.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>{t('collection.emptyTitle')}</Text>
        <Text style={styles.emptyBody}>{t('playlist.noOwned')}</Text>
        {onDiscover && (
          <Pressable style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]} onPress={onDiscover}>
            <Text style={styles.emptyBtnLabel}>{t('collection.discover')}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const isDl = variant === 'downloads';
  const allKeys = tracks.map(keyOf);
  // 端末に保存した曲を、確かめてからまとめて消す
  const removeAll = () =>
    Alert.alert(
      t('download.removeTitle'),
      t('download.removeAllBody', { n: tracks.length, size: formatBytes(dl.bytesOf(allKeys)) }),
      [
        { text: t('playlist.cancel'), style: 'cancel' },
        {
          text: t('download.remove'),
          style: 'destructive',
          onPress: () => {
            dl.removeAll(allKeys);
            showToast(t('download.removedAll'));
          },
        },
      ],
    );

  // 見出しの2行目: 「5曲 · 24:10」（保存した曲の一覧は大きさも）。合計は全曲の長さが分かってから
  const countText = isDl
    ? t('download.size', { n: tracks.length, size: formatBytes(dl.bytesOf(allKeys)) })
    : t('playlist.count', { n: tracks.length });
  const headSub = total != null && total > 0 ? `${countText}  ·  ${formatDuration(total)}` : countText;
  const header = (
    <View style={styles.head}>
      <View style={styles.headTexts}>
        {onTitlePress ? (
          <Pressable
            onPress={onTitlePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.headTitleBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={t('playlist.switch')}
            accessibilityHint={title}
          >
            <Text style={styles.headTitle} numberOfLines={1}>{title}</Text>
            <ChevronDown />
          </Pressable>
        ) : (
          <Text style={styles.headTitle} numberOfLines={1}>{title}</Text>
        )}
        <Text style={styles.headCount}>{headSub}</Text>
      </View>
      {isDl ? (
        tracks.length > 0 && (
          <Pressable
            onPress={removeAll}
            hitSlop={8}
            style={({ pressed }) => [styles.removeAll, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <Text style={styles.removeAllText}>{t('download.removeAll')}</Text>
          </Pressable>
        )
      ) : (
        // このリストを丸ごと端末に保存
        tracks.length > 0 && <DownloadButton keys={allKeys} label={title} size={24} />
      )}
      <Pressable
        disabled={tracks.length === 0}
        onPress={() => (live ? pb?.toggle() : onPlayAll(ids, source))}
        style={({ pressed }) => [
          styles.playAll,
          tracks.length === 0 && { opacity: 0.35 },
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={playing ? t('playback.pause') : t('playlist.play')}
      >
        {live && <LiveRing playing={playing} />}
        {playing ? <PauseMark size={20} color="#06222A" /> : <PlayMark size={22} color="#06222A" />}
      </Pressable>
    </View>
  );

  if (tracks.length === 0) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{isDl ? t('download.emptyTitle') : t('playlist.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{isDl ? t('download.emptyBody') : t('playlist.emptyBodyMenu')}</Text>
          {onEdit && !isDl && (
            <Pressable style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]} onPress={onEdit}>
              <Text style={styles.emptyBtnLabel}>{t('playlist.addTracks')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.root}
      data={tracks}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={header}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const on = live && pb?.current?.id === item.id;
        return (
          <Pressable
            onPress={() => (on ? pb?.toggle() : onPlayFrom(ids, item.id, source))}
            onLongPress={longPress ? () => longPress(item) : undefined}
            delayLongPress={380}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityHint={on ? (playing ? t('playback.pause') : t('playback.play')) : t('playback.playThis')}
            accessibilityActions={longPress ? [{ name: 'longpress', label: longPressLabel }] : undefined}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'longpress') longPress?.(item);
            }}
          >
            <View
              ref={(el) => {
                if (el) artRefs.current.set(item.id, el);
                else artRefs.current.delete(item.id);
              }}
              collapsable={false}
            >
              <Image source={{ uri: item.artworkUrl }} style={styles.art} />
            </View>
            {/* 2026-10-15 岡さんデザイン（行レイアウト）: 左に No. ／ 曲名、右に 作家名・↓・時間を
                横一列で。↓ は端末に保存済みの曲だけ（無い曲も幅は取って時間の位置をそろえる） */}
            <View style={styles.meta}>
              {!!item.serialNo && <Text style={styles.serial} numberOfLines={1}>{item.serialNo}</Text>}
              <Text style={[styles.title, on && styles.titleOn]} numberOfLines={1}>{item.title}</Text>
            </View>
            {on && <EqBars active={playing} keepIdle />}
            <View style={styles.side}>
              {!!item.artist && <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>}
              {dl.stateOf(keyOf(item)).status === 'done' ? (
                <View accessibilityLabel={t('download.badge')} style={styles.savedMark}>
                  <SavedArrow />
                </View>
              ) : (
                <View style={styles.savedMark} />
              )}
              <Text style={styles.time}>{durOf.get(item.id) != null ? formatDuration(durOf.get(item.id)!) : ''}</Text>
            </View>
            {/* 保存した曲の一覧では、右端は保存の印（押すとその曲だけ消す） */}
            {isDl && <DownloadButton keys={[keyOf(item)]} label={item.title} size={20} />}
            <Pressable
              onPress={() => openCard(item.id)}
              hitSlop={6}
              style={({ pressed }) => [styles.cardBtn, pressed && styles.cardBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('playlist.cardDetail', { title: item.title })}
            >
              <CardDetailIcon size={20} color={on ? C.cyan : C.sub} />
            </Pressable>
          </Pressable>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingBottom: 24 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 22,
    paddingRight: 18,
    paddingTop: 18,
    paddingBottom: 10,
  },
  // 見出し: 1行目に名前（▾ で切り替え）、2行目に「5曲 · 24:10」（2026-10-15 デザイン D）。
  // 右に「丸ごと保存」と「先頭から再生」が並ぶ
  headTexts: { flex: 1, minWidth: 0 },
  headTitleBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%' },
  headTitle: { color: C.text, fontSize: 20, fontWeight: '500', letterSpacing: 0.8, flexShrink: 1 },
  headCount: { color: '#8D93B5', fontSize: 11, letterSpacing: 0.7, marginTop: 4, fontVariant: ['tabular-nums'] },
  // 先頭から流す丸いボタン（Spotify の緑の丸にあたる。FLUX RING はシアン）
  playAll: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveRing: {
    position: 'absolute',
    left: -5,
    right: -5,
    top: -5,
    bottom: -5,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.7)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingLeft: 22,
    paddingRight: 10,
    paddingVertical: 7,
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.05)', transform: [{ scale: 0.985 }] },
  art: { width: ART_W, height: ART_H, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.05)' },
  meta: { flex: 1, minWidth: 0 },
  serial: { color: '#6E759A', fontSize: 10, letterSpacing: 1.4, fontVariant: ['tabular-nums'] },
  title: { color: C.text, fontSize: 17, letterSpacing: 0.3, marginTop: 2, fontFamily: JP_SERIF_FONT },
  titleOn: { color: C.cyan },
  side: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '46%' },
  artist: { flexShrink: 1, color: '#8D93B5', fontSize: 11, fontWeight: '300', letterSpacing: 0.7 },
  savedMark: { width: 10, alignItems: 'center', justifyContent: 'center' },
  time: { color: '#6E759A', fontSize: 12, fontWeight: '300', fontVariant: ['tabular-nums'], minWidth: 32, textAlign: 'right' },
  removeAll: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,120,120,0.35)',
  },
  removeAllText: { color: '#FF8A8A', fontSize: 12.5, letterSpacing: 0.8 },
  cardBtn: { width: 40, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardBtnPressed: { backgroundColor: 'rgba(96,206,224,0.12)' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  emptyTitle: { color: C.text, fontSize: 17, letterSpacing: 0.5 },
  emptyBody: { color: C.sub, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.45)',
  },
  emptyBtnLabel: { color: C.text, fontSize: 14, letterSpacing: 0.5 },
});

export default MyPlaylists;
