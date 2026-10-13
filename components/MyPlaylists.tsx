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

import React, { useEffect } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { NUM_FONT, JP_SERIF_FONT } from '../constants/fonts';
import { useT } from '../lib/i18n';
import { usePlaybackOptional } from '../lib/playback';

export type PlaylistItem = {
  id: string;
  title: string;
  artworkUrl: string;
  serialNo?: string;
  artist?: string;
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
  /** カードを眺める画面を開く（再生は変えない） */
  onViewCard: (trackIds: string[], id: string, source: string) => void;
  /** 空のリストで「曲を入れる」を押した（自分のプレイリストのときだけ渡す） */
  onEdit?: () => void;
  /** 所有曲が 0 のとき「作品と出会う」 */
  onDiscover?: () => void;
};

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
}) => {
  const t = useT();
  const pb = usePlaybackOptional();
  const ids = tracks.map((x) => x.id);
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

  const header = (
    <View style={styles.head}>
      <View style={styles.headTexts}>
        <Text style={styles.headTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.headCount}>{t('playlist.count', { n: tracks.length })}</Text>
      </View>
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
          <Text style={styles.emptyTitle}>{t('playlist.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('playlist.emptyBodyMenu')}</Text>
          {onEdit && (
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
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityHint={on ? (playing ? t('playback.pause') : t('playback.play')) : t('playback.playThis')}
          >
            <Image source={{ uri: item.artworkUrl }} style={styles.art} />
            <View style={styles.meta}>
              <Text style={[styles.title, on && styles.titleOn]} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {[item.serialNo, item.artist].filter(Boolean).join('  ·  ')}
              </Text>
            </View>
            {on && <EqBars active={playing} keepIdle />}
            <Pressable
              onPress={() => onViewCard(ids, item.id, source)}
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
  headTexts: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  headTitle: { color: C.text, fontSize: 18, letterSpacing: 0.9, flexShrink: 1, fontFamily: JP_SERIF_FONT },
  headCount: { color: C.sub, fontSize: 12, letterSpacing: 0.6 },
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
  title: { color: C.text, fontSize: 15, letterSpacing: 0.6, fontFamily: JP_SERIF_FONT },
  titleOn: { color: C.cyan },
  sub: { color: C.sub, fontSize: 11.5, marginTop: 4, letterSpacing: 1, fontFamily: NUM_FONT },
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
