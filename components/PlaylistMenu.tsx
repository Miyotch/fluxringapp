/**
 * PlaylistMenu.tsx — 「プレイリスト ▾」を押すと開くプルダウン（2026-10-13）
 * ------------------------------------------------------------------
 *   ・自分のプレイリスト → 押すとそのリストへ。右の「⋯」で 編集／削除
 *     編集＝既存の編集シート（名前・曲の出し入れ・並べ替え）。削除はその場で一度確かめる
 *   ・ウィッシュリスト → 押すとウィッシュリストへ（アプリが管理するので編集・削除なし）
 *   ・＋ 新しいプレイリスト → 編集シートを新規で開く
 *   ・流しているリストには EQ を出す（どのリストが鳴っているか分かるように）
 *
 * 外側（暗幕）を押すと閉じる。開閉と選択の状態は CollectionScreen が持つ。
 */

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { EqBars } from './EqBars';
import { useT } from '../lib/i18n';
import { usePlaybackOptional } from '../lib/playback';
import { JP_SERIF_FONT } from '../constants/fonts';
import type { Playlist } from '../lib/usePlaylists';

/** プルダウンでウィッシュリストを表す目印 */
export const WISHLIST_KEY = '__wish__';
/** プルダウンで「端末に保存した曲」を表す目印（2026-10-14） */
export const DOWNLOADS_KEY = '__dl__';

type Props = {
  visible: boolean;
  /** プルダウンの上端（タブの下端）。画面の上からの距離 */
  top: number;
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
  sub: '#9498BE',
  cyan: '#60CEE0',
  line: 'rgba(96,206,224,0.16)',
  danger: '#FF8A8A',
};

type Edit = { id: string; mode: 'acts' | 'confirm' } | null;

export const PlaylistMenu: React.FC<Props> = ({
  visible,
  top,
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
  const pb = usePlaybackOptional();
  const liveSource = pb?.current ? pb.source : null;
  const [edit, setEdit] = useState<Edit>(null);
  // 閉じたら行のサブメニューも畳む
  useEffect(() => {
    if (!visible) setEdit(null);
  }, [visible]);
  if (!visible) return null;

  const item = (key: string, name: string, count: number, editable: boolean) => {
    const on = selected === key;
    const live = liveSource === key;
    const open = edit?.id === key;
    return (
      <View key={key} style={[styles.rowWrap, open && styles.rowWrapOpen]}>
        <View style={styles.line}>
          <Pressable
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            onPress={() => onSelect(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={styles.check}>{on ? '✓' : ''}</Text>
            <Text style={[styles.name, (on || live) && styles.nameOn]} numberOfLines={1}>{name}</Text>
            {live && <EqBars active={!!pb?.playing} keepIdle />}
            <Text style={styles.count}>{t('playlist.count', { n: count })}</Text>
          </Pressable>
          {editable ? (
            <Pressable
              style={({ pressed }) => [styles.more, pressed && styles.pressed]}
              onPress={() => setEdit(open ? null : { id: key, mode: 'acts' })}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t('playlist.menuFor', { name })}
            >
              <Text style={[styles.moreText, open && { color: C.text }]}>⋯</Text>
            </Pressable>
          ) : (
            <View style={styles.more} />
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
                <Text style={[styles.subText, { color: C.sub }]}>{t('playlist.cancel')}</Text>
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
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 暗幕。押すと閉じる */}
      <Pressable style={[styles.scrim, { top }]} onPress={onClose} accessibilityLabel={t('playlist.close')} />
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(120)}
        style={[styles.panel, { top: top + 6 }]}
      >
        <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" bounces={false}>
          {lists.map((p) => item(p.id, p.name, p.trackIds.length, true))}
          {item(WISHLIST_KEY, t('collection.wishlist'), wishCount, false)}
          {item(DOWNLOADS_KEY, t('download.listName'), dlCount, false)}
        </ScrollView>
        <View style={styles.addWrap}>
          <Pressable
            style={({ pressed }) => [styles.add, pressed && styles.pressed]}
            onPress={onNew}
            accessibilityRole="button"
          >
            <Text style={styles.addText}>{`＋ ${t('playlist.new')}`}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,4,12,0.45)' },
  panel: {
    position: 'absolute',
    left: 18,
    right: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: 'rgba(22,23,54,0.98)',
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  rowWrap: { borderRadius: 10 },
  rowWrapOpen: { backgroundColor: 'rgba(255,255,255,0.04)' },
  line: { flexDirection: 'row', alignItems: 'center' },
  item: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pressed: { backgroundColor: 'rgba(255,255,255,0.07)' },
  check: { width: 14, color: C.cyan, fontSize: 13 },
  name: { flex: 1, minWidth: 0, color: C.text, fontSize: 14.5, letterSpacing: 0.6, fontFamily: JP_SERIF_FONT },
  nameOn: { color: C.cyan },
  count: { color: C.sub, fontSize: 12 },
  more: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: C.sub, fontSize: 18, letterSpacing: 1 },
  sub: { flexDirection: 'row', gap: 8, paddingLeft: 34, paddingRight: 10, paddingBottom: 10 },
  subBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
  },
  subDanger: { borderColor: 'rgba(255,120,120,0.35)' },
  subText: { color: C.text, fontSize: 13, letterSpacing: 0.6 },
  confirm: { flexDirection: 'column', gap: 6 },
  confirmText: { color: C.text, fontSize: 13, lineHeight: 20 },
  confirmNote: { color: C.sub, fontSize: 11 },
  confirmBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  deleteFill: { backgroundColor: '#E05A5A', borderColor: '#E05A5A' },
  addWrap: { borderTopWidth: 1, borderTopColor: C.line, marginTop: 4, paddingTop: 4 },
  add: { paddingVertical: 12, paddingLeft: 34, borderRadius: 8 },
  addText: { color: C.cyan, fontSize: 14, letterSpacing: 0.6 },
});

export default PlaylistMenu;
