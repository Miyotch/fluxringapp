/**
 * AddToPlaylistSheet.tsx — 「プレイリストに追加」の下からのシート（2026-10-13）
 * ------------------------------------------------------------------
 * どの曲からでも 2 タップで足せるようにする（Spotify と同じ）。
 *   ・リストの行を長押し／再生画面の「＋」から開く
 *   ・自分のプレイリストが並び、入っているものには ✓。押すたびに入れる／外す
 *   ・「＋ 新しいプレイリスト」→ 名前を入れて作る（この曲が 1 曲目に入る）
 *   ・入れた／外したら一言（toast）を出す。シートは開いたまま（続けて別のリストにも入れられる）
 */

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useT } from '../lib/i18n';
import { useBottomInset } from '../lib/safeArea';
import { JP_SERIF_FONT } from '../constants/fonts';
import type { Playlist } from '../lib/usePlaylists';
import { AddToListIcon } from './icons';

export type AddTarget = { id: string; title: string };

type Props = {
  target: AddTarget | null;
  lists: Playlist[];
  /** add=true で入れる、false で外す */
  onToggle: (listId: string, add: boolean) => void;
  /** 新しいリストを作って、この曲を入れる */
  onCreate: (name: string) => void;
  defaultName: string;
  onClose: () => void;
};

const C = {
  text: '#ECEEF7',
  sub: '#9498BE',
  cyan: '#60CEE0',
  line: 'rgba(96,206,224,0.16)',
};

export const AddToPlaylistSheet: React.FC<Props> = ({
  target,
  lists,
  onToggle,
  onCreate,
  defaultName,
  onClose,
}) => {
  const t = useT();
  const bottom = useBottomInset(16);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  useEffect(() => {
    setNaming(false);
    setName('');
  }, [target?.id]);

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t('playlist.close')} />
        <View style={[styles.sheet, { paddingBottom: bottom }]}>
          <View style={styles.grab} />
          <Text style={styles.heading}>{t('playlist.addTo')}</Text>
          {!!target && <Text style={styles.track} numberOfLines={1}>{`《${target.title}》`}</Text>}

          <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled" bounces={false}>
            {lists.length === 0 && !naming && (
              <Text style={styles.none}>{t('playlist.noListsTitle')}</Text>
            )}
            {lists.map((p) => {
              const inList = !!target && p.trackIds.includes(target.id);
              return (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  onPress={() => onToggle(p.id, !inList)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: inList }}
                >
                  <View style={styles.rowTexts}>
                    <Text style={[styles.name, inList && styles.nameOn]} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.count}>{t('playlist.count', { n: p.trackIds.length })}</Text>
                  </View>
                  <AddToListIcon on={inList} />
                </Pressable>
              );
            })}
          </ScrollView>

          {naming ? (
            <View style={styles.newRow}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={defaultName}
                placeholderTextColor="rgba(148,152,190,0.6)"
                style={styles.input}
                autoFocus
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={() => onCreate(name.trim() || defaultName)}
              />
              <Pressable
                style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
                onPress={() => onCreate(name.trim() || defaultName)}
                accessibilityRole="button"
              >
                <Text style={styles.createText}>{t('playlist.create')}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
              onPress={() => setNaming(true)}
              accessibilityRole="button"
            >
              <Text style={styles.newText}>{`＋ ${t('playlist.new')}`}</Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [styles.done, pressed && { opacity: 0.85 }]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.doneText}>{t('playlist.done')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  track: { color: C.sub, fontSize: 12.5, marginTop: 4, marginBottom: 12, textAlign: 'center', fontFamily: JP_SERIF_FONT },
  none: { color: C.sub, fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
  pressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  rowTexts: { flex: 1, minWidth: 0 },
  name: { color: C.text, fontSize: 15, letterSpacing: 0.6, fontFamily: JP_SERIF_FONT },
  nameOn: { color: C.cyan },
  count: { color: C.sub, fontSize: 11.5, marginTop: 3 },
  newBtn: { paddingVertical: 14, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: C.line, marginTop: 4 },
  newText: { color: C.cyan, fontSize: 14.5, letterSpacing: 0.6 },
  newRow: { flexDirection: 'row', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, marginTop: 4 },
  input: {
    flex: 1,
    minWidth: 0,
    color: C.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: C.cyan,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontFamily: JP_SERIF_FONT,
  },
  createBtn: { paddingHorizontal: 18, borderRadius: 10, backgroundColor: C.cyan, justifyContent: 'center' },
  createText: { color: '#06222A', fontSize: 14, letterSpacing: 1 },
  done: { marginTop: 8, alignSelf: 'stretch', paddingVertical: 13, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(96,206,224,0.45)', alignItems: 'center' },
  doneText: { color: C.text, fontSize: 14, letterSpacing: 2 },
});

export default AddToPlaylistSheet;
