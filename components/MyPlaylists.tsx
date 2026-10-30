/**
 * MyPlaylists.tsx — プレイリスト画面の曲の縦リスト（所有カード／各プレイリスト）
 * ------------------------------------------------------------------
 * 2026-10-13 カードの横スワイプから、Spotify と同じ縦のリストへ改めた。
 *   ・行を押す → その曲からこの並びで流す（画面は移らない。下の再生バナーが替わる）
 *     流れている曲の行をもう一度押すと一時停止／再開
 *   ・右端のアイコン → 追加・削除メニュー。プレイリスト内は長押しで曲順変更。
 *   ・見出しの右の丸い再生ボタン → 先頭から流す。流しているリストなら一時停止／再開
 *
 * どのリストを出すか・プルダウン・編集シートは CollectionScreen が持つ。ここは並べるだけ。
 */

import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ScrollView } from 'react-native-gesture-handler';
import { PlaylistTrackRow } from './PlaylistTrackRow';
import { CARD_ASPECT } from './CardGL';
import { AddToListIcon, PauseMark, PlayMark } from './icons';
import { EqBars } from './EqBars';
import { DownloadButton } from './DownloadButton';
import { JP_SERIF_FONT, NUM_FONT } from '../constants/fonts';
import Svg, { Circle, Path } from 'react-native-svg';
import { useT } from '../lib/i18n';
import { usePlaybackOptional } from '../lib/playback';
import { formatBytes, useDownloads } from '../lib/downloads';
import { formatDuration, sumDurations, useDurations } from '../lib/durations';
import { showToast } from '../lib/toast';
import { MarqueeText } from './MarqueeText';

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
  /** 右端のアイコン → プレイリストに追加のシート */
  onAddToPlaylist?: (item: PlaylistItem) => void;
  onRowAction?: (item: PlaylistItem) => void;
  onReorder?: (from: number, to: number) => void;
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
  onEdit,
  onDiscover,
  onAddToPlaylist,
  onRowAction,
  onReorder,
  variant = 'list',
  onTitlePress,
}) => {
  const t = useT();
  const dragIndex = useSharedValue(-1), dragDy = useSharedValue(0);
  const rowOrder = useSharedValue(tracks.map(track => track.id));
  const orderKey = JSON.stringify(tracks.map(track => track.id));
  useEffect(() => { rowOrder.value = JSON.parse(orderKey); }, [orderKey, rowOrder]);
  const [dragging, setDragging] = useState(false);
  const cancelDrag = () => { dragIndex.value = -1; dragDy.value = 0; setDragging(false); };
  const drop = (from: number, to: number) => {
    if (from !== to && from >= 0 && to >= 0 && from < tracks.length && to < tracks.length) onReorder?.(from, to);
    cancelDrag();
  };
  const pb = usePlaybackOptional();
  const dl = useDownloads();
  const ids = tracks.map((x) => x.id);
  const keyOf = (x: PlaylistItem) => x.audioKey || x.id;
  // 曲の長さ（行の右に出す・見出しに合計を出す）。分かりしだい描き直す
  const durs = useDurations(tracks.map(keyOf));
  const durOf = new Map(tracks.map((x, i) => [x.id, durs[i]]));
  const total = sumDurations(durs);
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

  const renderRow = (item: PlaylistItem, index: number) => {
        const on = live && pb?.current?.id === item.id;
        const Row = onReorder ? View : Pressable;
        const Action = onReorder ? View : Pressable;
        const content = (
          <Row
            onPress={() => (on ? pb?.toggle() : onPlayFrom(ids, item.id, source))}
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityHint={on ? (playing ? t('playback.pause') : t('playback.play')) : t('playback.playThis')}
          >
            <View>
              <Image source={{ uri: item.artworkUrl }} style={styles.art} />
            </View>
            {/* 2026-10-15 岡さんデザイン（行レイアウト）: 左に No. ／ 曲名、右に ↓・時間。
                2026-10-18: 作家名を右から No. の行へ移し（「No. 018 · TSUBASA」）、曲名の幅を広げた。
                曲名は「火の粉 -SPARKS-」のまま 1 行（副題も作品名の一部なので分けない）。
                収まらない曲名は、再生中の行だけ横に流す。ほかの行は止めて右端を薄く消す
                （一覧がいっせいに動くと落ち着かないため。components/MarqueeText.tsx）。
                ↓ は端末に保存済みの曲だけ（無い曲も幅は取って時間の位置をそろえる） */}
            {/* 2026-10-20 岡さん指定: 新規・編集のプレイリスト画面と同じく 上＝曲名／下＝No. · 作家名 */}
            <View style={styles.meta}>
              <MarqueeText text={item.title} style={[styles.title, on && styles.titleOn]} running={on} />
              {(!!item.serialNo || !!item.artist) && (
                <Text style={styles.serial} numberOfLines={1}>
                  {[item.serialNo, item.artist].filter(Boolean).join(' · ')}
                </Text>
              )}
            </View>
            {on && <EqBars active={playing} keepIdle />}
            <View style={styles.side}>
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
            <Action
              onPress={() => (onRowAction ?? onAddToPlaylist)?.(item)}
              hitSlop={6}
              style={styles.cardBtn}
              accessibilityRole="button"
              accessibilityLabel={t('playlist.trackMenu') + ' ' + item.title}
            >
              {onRowAction ? <Svg width={20} height={20} viewBox="0 0 20 20">
                {[4, 10, 16].map(cx => <Circle key={cx} cx={cx} cy={10} r={1.5} fill={on ? C.cyan : C.sub} />)}
              </Svg> : <AddToListIcon size={20} color={on ? C.cyan : C.sub} />}
            </Action>
          </Row>
        );
        return onReorder ? <PlaylistTrackRow key={item.id} trackId={item.id} rowOrder={rowOrder} index={index} count={tracks.length} height={ART_H + 20}
          dragIndex={dragIndex} dragDy={dragDy} onLift={() => setDragging(true)} onDrop={drop} onCancel={cancelDrag}
          onPlay={() => (on ? pb?.toggle() : onPlayFrom(ids, item.id, source))}
          onMenu={() => (onRowAction ?? onAddToPlaylist)?.(item)} label={item.title}
          up={t('playlist.moveUp')} down={t('playlist.moveDown')}>{content}</PlaylistTrackRow> : content;
  };
  if (onReorder) return <ScrollView style={styles.root} contentContainerStyle={styles.list} scrollEnabled={!dragging}>
    {header}<Text style={{ color: C.sub, fontSize: 11, paddingHorizontal: 22, paddingBottom: 10 }}>{t('playlist.dragHint')}</Text>
    <View style={{ height: tracks.length * (ART_H + 20) }}>{tracks.map(renderRow)}</View>
  </ScrollView>;
  return <FlatList style={styles.root} data={tracks} keyExtractor={item => item.id} ListHeaderComponent={header}
    contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} renderItem={({ item, index }) => renderRow(item, index)} />;
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
    // 曲と曲の境目を分かりやすくするため 7 → 10（2026-10-18）
    paddingVertical: 10,
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.05)', transform: [{ scale: 0.985 }] },
  art: { width: ART_W, height: ART_H, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.05)' },
  meta: { flex: 1, minWidth: 0 },
  serial: { color: 'rgba(236,238,247,0.56)', fontSize: 11, letterSpacing: 1.4, marginTop: 4, fontFamily: NUM_FONT },
  title: { color: C.text, fontSize: 17, letterSpacing: 0.3, fontFamily: JP_SERIF_FONT },
  titleOn: { color: C.cyan },
  side: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '46%' },
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
