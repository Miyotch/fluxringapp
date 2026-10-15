/**
 * PlaylistMenu.tsx — プレイリストを選ぶ・作るシート（2026-10-13 → 10-15 下からのシートへ）
 * ------------------------------------------------------------------
 * 2026-10-15 岡さんのデザイン（C 選択シート）に合わせて、タブの下のプルダウンから
 * 画面の下から出るシートへ改めた。開くのは見出しのプレイリスト名（▾）から。
 *   ・自分のプレイリスト … 名前と「4 TRACKS · 18:42」（合計時間）。選択中は左にシアンの点
 *   ・区切り線の下に ウィッシュリスト／端末に保存した曲（アプリが管理する一覧。編集なし）
 *   ・右上の「編集」 → 自分のプレイリストの行に「⋯」が出て、編集／削除ができる
 *   ・＋ 新しいプレイリスト → 編集シートを新規で開く
 *   ・流しているリストには EQ を出す（どのリストが鳴っているか分かるように）
 * 文字はゴシック（OS 既定）。曲名の明朝はリストの行だけに残す。
 *
 * 外側（暗幕）を押すと閉じる。開閉と選択の状態は CollectionScreen が持つ。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { EqBars } from './EqBars';
import { useT } from '../lib/i18n';
import { usePlaybackOptional } from '../lib/playback';
import { useBottomInset } from '../lib/safeArea';
import { formatDuration, sumDurations, useDurations } from '../lib/durations';
import type { Playlist } from '../lib/usePlaylists';

/** シートでウィッシュリストを表す目印 */
export const WISHLIST_KEY = '__wish__';
/** シートで「端末に保存した曲」を表す目印（2026-10-14） */
export const DOWNLOADS_KEY = '__dl__';

type Props = {
  visible: boolean;
  /** 旧プルダウンの上端。シートになってからは使わない（呼び出し側の互換のため残す） */
  top?: number;
  lists: Playlist[];
  wishCount: number;
  /** 端末に保存した曲の数 */
  dlCount: number;
  /** いま選んでいるもの（プレイリストの id か WISHLIST_KEY）。所有カード・すべてなら null */
  selected: string | null;
  onSelect: (key: string) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

const C = {
  text: '#ECEEF7',
  sub: '#B9BED8',
  dim: '#8D93B5',
  faint: '#6E759A',
  cyan: '#60CEE0',
  line: 'rgba(236,238,247,0.07)',
  danger: '#FF8A8A',
};

type Edit = { id: string; mode: 'acts' | 'confirm' } | null;

/** 「4 TRACKS」「1 TRACK」 */
export function useTracksLabel() {
  const t = useT();
  return (n: number) => (n === 1 ? t('playlist.track1') : t('playlist.tracks', { n }));
}

export const PlaylistMenu: React.FC<Props> = ({
  visible,
  lists,
  wishCount,
  dlCount,
  selected,
  onSelect,
  onNew,
  onEdit,
  onDelete,
  onClose,
}) => {
  const t = useT();
  const tracksLabel = useTracksLabel();
  const pb = usePlaybackOptional();
  const bottom = useBottomInset(24, 16);
  const liveSource = pb?.current ? pb.source : null;
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<Edit>(null);
  // 閉じたら編集の状態も畳む
  useEffect(() => {
    if (!visible) {
      setEdit(null);
      setEditing(false);
    }
  }, [visible]);

  // 各プレイリストの合計時間（1曲でも分からなければ曲数だけ出す）
  const allIds = useMemo(() => [...new Set(lists.flatMap((p) => p.trackIds))], [lists]);
  const durs = useDurations(visible ? allIds : []);
  const durById = new Map(allIds.map((id, i) => [id, durs[i]]));
  const totalOf = (p: Playlist) => sumDurations(p.trackIds.map((id) => durById.get(id)));

  const metaText = (count: number, total: number | null) =>
    count > 0 && total != null && total > 0 ? `${tracksLabel(count)}  ·  ${formatDuration(total)}` : tracksLabel(count);

  const row = (key: string, name: string, meta: string, kind: 'list' | 'system') => {
    const on = selected === key;
    const live = liveSource === key;
    const open = edit?.id === key;
    const canEdit = kind === 'list' && editing;
    return (
      <View key={key} style={[styles.rowWrap, open && styles.rowWrapOpen]}>
        <View style={styles.line}>
          <Pressable
            style={({ pressed }) => [kind === 'list' ? styles.item : styles.itemSys, pressed && styles.pressed]}
            onPress={() => (canEdit ? setEdit(open ? null : { id: key, mode: 'acts' }) : onSelect(key))}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${name}、${meta}`}
          >
            <View style={styles.dotCol}>{on && <View style={styles.dot} />}</View>
            <Text
              style={[
                kind === 'list' ? styles.name : styles.nameSys,
                on ? styles.nameOn : kind === 'list' && styles.nameOff,
              ]}
              numberOfLines={1}
            >
              {name}
            </Text>
            {live && <EqBars active={!!pb?.playing} keepIdle />}
            <Text style={[styles.meta, !on && styles.metaOff]}>{meta}</Text>
          </Pressable>
          {canEdit && (
            <Pressable
              style={({ pressed }) => [styles.more, pressed && styles.pressed]}
              onPress={() => setEdit(open ? null : { id: key, mode: 'acts' })}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t('playlist.menuFor', { name })}
            >
              <Text style={[styles.moreText, open && { color: C.text }]}>⋯</Text>
            </Pressable>
          )}
        </View>

        {open && edit?.mode === 'acts' && (
          <Animated.View entering={FadeIn.duration(140)} style={styles.sub}>
            <Pressable
              style={({ pressed }) => [styles.subBtn, pressed && styles.pressed]}
              onPress={() => onEdit(key)}
              accessibilityRole="button"
            >
              <Text style={styles.subText}>{t('playlist.edit')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.subBtn, styles.subDanger, pressed && styles.pressed]}
              onPress={() => setEdit({ id: key, mode: 'confirm' })}
              accessibilityRole="button"
            >
              <Text style={[styles.subText, { color: C.danger }]}>{t('playlist.deleteShort')}</Text>
            </Pressable>
          </Animated.View>
        )}

        {open && edit?.mode === 'confirm' && (
          <Animated.View entering={FadeIn.duration(140)} style={[styles.sub, styles.confirm]}>
            <Text style={styles.confirmText}>{t('playlist.deleteConfirm', { name })}</Text>
            <Text style={styles.confirmNote}>{t('playlist.deleteNote')}</Text>
            <View style={styles.confirmBtns}>
              <Pressable
                style={({ pressed }) => [styles.subBtn, pressed && styles.pressed]}
                onPress={() => setEdit(null)}
                accessibilityRole="button"
              >
                <Text style={[styles.subText, { color: C.dim }]}>{t('playlist.cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.subBtn, styles.deleteFill, pressed && styles.pressed]}
                onPress={() => {
                  setEdit(null);
                  onDelete(key);
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.subText, { color: '#fff' }]}>{t('playlist.deleteDo')}</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {visible && (
        <View style={StyleSheet.absoluteFill}>
          {/* 暗幕。押すと閉じる */}
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={StyleSheet.absoluteFill}>
            <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t('playlist.close')} />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.duration(260)}
            exiting={SlideOutDown.duration(180)}
            style={[styles.sheet, { paddingBottom: bottom }]}
          >
            <View style={styles.handle} />
            <View style={styles.head}>
              <Text style={styles.headTitle}>{t('playlist.choose')}</Text>
              {lists.length > 0 && (
                <Pressable
                  onPress={() => {
                    setEdit(null);
                    setEditing((v) => !v);
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                >
                  <Text style={[styles.headEdit, editing && { color: C.cyan }]}>
                    {editing ? t('playlist.done') : t('playlist.edit')}
                  </Text>
                </Pressable>
              )}
            </View>

            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" bounces={false}>
              {lists.map((p) => row(p.id, p.name, metaText(p.trackIds.length, totalOf(p)), 'list'))}
              <View style={styles.divider} />
              {row(WISHLIST_KEY, t('collection.wishlist'), tracksLabel(wishCount), 'system')}
              {row(DOWNLOADS_KEY, t('download.listName'), tracksLabel(dlCount), 'system')}
            </ScrollView>

            <View style={styles.addWrap}>
              <Pressable
                style={({ pressed }) => [styles.add, pressed && { opacity: 0.75 }]}
                onPress={onNew}
                accessibilityRole="button"
              >
                <Text style={styles.addPlus}>＋</Text>
                <Text style={styles.addText}>{t('playlist.new')}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(7,9,26,0.62)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(236,238,247,0.10)',
    backgroundColor: 'rgba(16,20,46,0.985)',
    paddingTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -12 },
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(236,238,247,0.18)',
    marginBottom: 24,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 28,
    paddingBottom: 14,
  },
  headTitle: { color: C.text, fontSize: 17, fontWeight: '500', letterSpacing: 1 },
  headEdit: { color: C.dim, fontSize: 12, letterSpacing: 1 },
  rowWrap: { marginHorizontal: 14, borderRadius: 12 },
  rowWrapOpen: { backgroundColor: 'rgba(255,255,255,0.04)' },
  line: { flexDirection: 'row', alignItems: 'center' },
  item: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  itemSys: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  pressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  dotCol: { width: 14, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.cyan,
    shadowColor: C.cyan,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  name: { flex: 1, minWidth: 0, color: C.text, fontSize: 16, letterSpacing: 0.5 },
  nameOff: { color: C.sub, fontWeight: '300' },
  nameSys: { flex: 1, minWidth: 0, color: C.sub, fontSize: 15, fontWeight: '300', letterSpacing: 0.5 },
  nameOn: { color: C.text, fontWeight: '400' },
  meta: { color: C.dim, fontSize: 11, letterSpacing: 0.7, fontVariant: ['tabular-nums'] },
  metaOff: { color: C.faint },
  more: { width: 40, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: C.dim, fontSize: 18, letterSpacing: 1 },
  divider: { height: 1, marginHorizontal: 28, marginTop: 8, marginBottom: 10, backgroundColor: C.line },
  sub: { flexDirection: 'row', gap: 8, paddingLeft: 42, paddingRight: 10, paddingBottom: 12 },
  subBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.16)',
  },
  subDanger: { borderColor: 'rgba(255,120,120,0.35)' },
  subText: { color: C.text, fontSize: 13, letterSpacing: 0.6 },
  confirm: { flexDirection: 'column', gap: 6 },
  confirmText: { color: C.text, fontSize: 13, lineHeight: 20 },
  confirmNote: { color: C.dim, fontSize: 11 },
  confirmBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  deleteFill: { backgroundColor: '#E05A5A', borderColor: '#E05A5A' },
  addWrap: { paddingTop: 22, paddingHorizontal: 28 },
  add: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.40)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  addPlus: { color: C.cyan, fontSize: 14 },
  addText: { color: C.cyan, fontSize: 14, letterSpacing: 0.8 },
});

export default PlaylistMenu;
