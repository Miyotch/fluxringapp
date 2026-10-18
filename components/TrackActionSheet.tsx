/**
 * TrackActionSheet.tsx — 自分のプレイリストの曲を長押ししたときのメニュー（2026-10-18）
 * ------------------------------------------------------------------
 * 2026-10-18 の指摘: プレイリストを見ているときに曲を長押しすると「プレイリストに追加」が
 * 出ていたが、いま見ているリストの中の曲なので、ここは別の動きのほうがよい。
 * 所有カード・保存した曲では従来どおり長押し＝追加。自分のプレイリストでだけこのメニューを出す。
 *
 *   ・このプレイリストから外す
 *   ・ほかのプレイリストにも追加（従来の追加シートへ）
 *   ・曲順を並べ替える（編集シートへ）
 *
 * 見た目は AddToPlaylistSheet と同じ下からのシート。
 * 書体: 曲名（《》）だけ明朝、メニューなどの UI の文字はゴシック（OS 既定）。2026-10-18 岡さん指定。
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useT } from '../lib/i18n';
import { useBottomInset } from '../lib/safeArea';
import { JP_SERIF_FONT } from '../constants/fonts';
import { AddToListIcon } from './icons';

export type TrackActionTarget = { id: string; title: string; listName: string };

type Props = {
  target: TrackActionTarget | null;
  onRemove: () => void;
  onAddToOther: () => void;
  onReorder: () => void;
  onClose: () => void;
};

const C = {
  text: '#ECEEF7',
  sub: '#9498BE',
  cyan: '#60CEE0',
  line: 'rgba(96,206,224,0.16)',
};

/** 外す（丸の中の −） */
const RemoveIcon: React.FC = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" stroke={C.sub} strokeWidth={1.5} />
    <Path d="M8 12h8" stroke={C.sub} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

/** 並べ替え（上下の矢印） */
const ReorderIcon: React.FC = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3" stroke={C.sub} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const TrackActionSheet: React.FC<Props> = ({ target, onRemove, onAddToOther, onReorder, onClose }) => {
  const t = useT();
  const bottom = useBottomInset(16);
  const rows: { key: string; label: string; icon: React.ReactNode; onPress: () => void; danger?: boolean }[] = [
    { key: 'remove', label: t('playlist.removeFromThis'), icon: <RemoveIcon />, onPress: onRemove, danger: true },
    { key: 'other', label: t('playlist.addToOther'), icon: <AddToListIcon />, onPress: onAddToOther },
    { key: 'reorder', label: t('playlist.reorder'), icon: <ReorderIcon />, onPress: onReorder },
  ];
  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t('playlist.close')} />
        <View style={[styles.sheet, { paddingBottom: bottom }]}>
          <View style={styles.grab} />
          {!!target && (
            <>
              <Text style={styles.heading} numberOfLines={1}>{`《${target.title}》`}</Text>
              <Text style={styles.sub} numberOfLines={1}>{t('playlist.inThisList', { name: target.listName })}</Text>
            </>
          )}
          {rows.map((r) => (
            <Pressable
              key={r.key}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={r.onPress}
              accessibilityRole="button"
            >
              <View style={styles.icon}>{r.icon}</View>
              <Text style={[styles.label, r.danger && styles.labelDanger]} numberOfLines={1}>{r.label}</Text>
            </Pressable>
          ))}
          <Pressable
            style={({ pressed }) => [styles.done, pressed && { opacity: 0.85 }]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.doneText}>{t('playlist.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(5,4,12,0.55)' },
  sheet: {
    backgroundColor: '#16173A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  grab: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(236,238,247,0.25)', marginBottom: 14 },
  heading: { color: C.text, fontSize: 16, letterSpacing: 1, fontFamily: JP_SERIF_FONT, textAlign: 'center' },
  sub: { color: C.sub, fontSize: 12.5, marginTop: 4, marginBottom: 10, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 10 },
  pressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  icon: { width: 24, alignItems: 'center' },
  label: { flex: 1, color: C.text, fontSize: 15, letterSpacing: 0.6 },
  labelDanger: { color: '#F2A7B4' },
  done: { marginTop: 8, alignSelf: 'stretch', paddingVertical: 13, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(96,206,224,0.45)', alignItems: 'center' },
  doneText: { color: C.text, fontSize: 14, letterSpacing: 2 },
});

export default TrackActionSheet;
