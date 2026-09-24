/**
 * PlaylistEditor.tsx — マイプレイリスト（スロット 2 以降）を作る・直すシート
 * ------------------------------------------------------------------
 *   ・名前
 *   ・入っている曲（上へ・下へで並べ替え、外す）
 *   ・所有している曲から入れる
 *   ・削除（2 度押しで確定。確認ダイアログは出さない）
 *
 * 手元の下書きを直して、「完了」で一度に保存する（途中で閉じれば何も変わらない）。
 * 並べ替えは 1 段目は ↑↓ ボタン。ドラッグ用のライブラリは入れていないため
 * （2026-09-24 設計）。
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useT } from '../lib/i18n';
import { useBottomInset } from '../lib/safeArea';

export type EditorTrack = { id: string; title: string; artworkUrl: string; serialNo?: string };

type Props = {
  visible: boolean;
  /** 新しく作るときは null */
  initial: { name: string; trackIds: string[] } | null;
  /** 名前が空のまま完了したときに使う名前（「プレイリスト 2」など） */
  defaultName: string;
  /** 入れられる曲（所有曲・シリアル番号順） */
  owned: EditorTrack[];
  onDone: (name: string, trackIds: string[]) => void;
  onCancel: () => void;
  /** 既存のプレイリストだけ。未指定なら削除ボタンを出さない */
  onDelete?: () => void;
};

const C = {
  text: '#ECEEF7',
  sub: '#9498BE',
  cyan: '#60CEE0',
  line: 'rgba(96,206,224,0.15)',
  sheet: '#0E0D26',
  danger: '#E5484D',
};

const Row: React.FC<{ item: EditorTrack; children: React.ReactNode }> = ({ item, children }) => (
  <View style={styles.row}>
    <Image source={{ uri: item.artworkUrl }} style={styles.thumb} />
    <View style={styles.rowText}>
      <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
      {!!item.serialNo && <Text style={styles.rowSerial}>{item.serialNo}</Text>}
    </View>
    <View style={styles.rowActs}>{children}</View>
  </View>
);

const Act: React.FC<{ label: string; a11y: string; onPress: () => void; disabled?: boolean }> = ({
  label,
  a11y,
  onPress,
  disabled,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    hitSlop={6}
    accessibilityRole="button"
    accessibilityLabel={a11y}
    style={({ pressed }) => [styles.act, disabled && { opacity: 0.25 }, pressed && { opacity: 0.6 }]}
  >
    <Text style={styles.actText}>{label}</Text>
  </Pressable>
);

export const PlaylistEditor: React.FC<Props> = ({
  visible,
  initial,
  defaultName,
  owned,
  onDone,
  onCancel,
  onDelete,
}) => {
  const t = useT();
  const padBottom = useBottomInset(16);
  const [name, setName] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [deleteArmed, setDeleteArmed] = useState(false);

  // 開くたびに下書きを作り直す
  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setIds(initial?.trackIds ?? []);
    setDeleteArmed(false);
  }, [visible, initial]);

  const byId = useMemo(() => new Map(owned.map((o) => [o.id, o])), [owned]);
  // 所有でなくなった曲は下書きの時点で外して見せる
  const inList = ids.map((id) => byId.get(id)).filter((x): x is EditorTrack => !!x);
  const addable = owned.filter((o) => !ids.includes(o.id));

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= inList.length) return;
    const next = inList.map((x) => x.id);
    [next[i], next[j]] = [next[j], next[i]];
    setIds(next);
  };

  const done = () => {
    onDone(name.trim() || defaultName, inList.map((x) => x.id));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: padBottom }]}>
          <View style={styles.head}>
            <Pressable onPress={onCancel} hitSlop={10} accessibilityRole="button">
              <Text style={styles.headBtn}>{t('playlist.cancel')}</Text>
            </Pressable>
            <Pressable onPress={done} hitSlop={10} accessibilityRole="button">
              <Text style={[styles.headBtn, styles.headDone]}>{t('playlist.done')}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{t('playlist.name')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('playlist.namePlaceholder')}
              placeholderTextColor="rgba(148,152,190,0.5)"
              style={styles.input}
              maxLength={30}
              returnKeyType="done"
            />

            <Text style={styles.label}>
              {t('playlist.inList')}　{t('playlist.count', { n: inList.length })}
            </Text>
            {inList.length === 0 && <Text style={styles.hint}>{t('playlist.emptyBody')}</Text>}
            {inList.map((item, i) => (
              <Row key={item.id} item={item}>
                <Act label="↑" a11y={t('playlist.moveUp')} onPress={() => move(i, -1)} disabled={i === 0} />
                <Act
                  label="↓"
                  a11y={t('playlist.moveDown')}
                  onPress={() => move(i, 1)}
                  disabled={i === inList.length - 1}
                />
                <Act
                  label={t('playlist.remove')}
                  a11y={t('playlist.remove')}
                  onPress={() => setIds(inList.filter((x) => x.id !== item.id).map((x) => x.id))}
                />
              </Row>
            ))}

            {addable.length > 0 && <Text style={styles.label}>{t('playlist.addable')}</Text>}
            {addable.map((item) => (
              <Row key={item.id} item={item}>
                <Act
                  label={`＋ ${t('playlist.add')}`}
                  a11y={t('playlist.add')}
                  onPress={() => setIds([...inList.map((x) => x.id), item.id])}
                />
              </Row>
            ))}

            {onDelete && (
              <Pressable
                style={({ pressed }) => [styles.delete, pressed && { opacity: 0.7 }]}
                onPress={() => (deleteArmed ? onDelete() : setDeleteArmed(true))}
                accessibilityRole="button"
              >
                <Text style={styles.deleteText}>
                  {deleteArmed ? t('playlist.deleteSure') : t('playlist.delete')}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,3,12,0.6)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: C.sheet,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: C.line,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  headBtn: { color: C.sub, fontSize: 14, letterSpacing: 0.5 },
  headDone: { color: C.cyan },
  body: { paddingHorizontal: 22, paddingBottom: 24 },
  label: { color: C.sub, fontSize: 11, letterSpacing: 1.6, marginTop: 20, marginBottom: 8 },
  hint: { color: C.sub, fontSize: 12, lineHeight: 18 },
  input: {
    color: C.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
  thumb: { width: 36, height: 54, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.05)' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: C.text, fontSize: 14 },
  rowSerial: { color: C.sub, fontSize: 11, marginTop: 2 },
  rowActs: { flexDirection: 'row', gap: 6 },
  act: {
    minWidth: 36,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actText: { color: C.cyan, fontSize: 12 },
  delete: { marginTop: 28, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 18 },
  deleteText: { color: C.danger, fontSize: 13, letterSpacing: 0.5 },
});

export default PlaylistEditor;
