/**
 * MyPlaylists.tsx — プレイリスト画面の「マイプレイリスト」ページ
 * ------------------------------------------------------------------
 * 2026-09-24 の打ち合わせで、コレクションを「プレイリスト」に改め、カードゲームの
 * デッキのようなスロット形式にした。
 *
 *   スロット 1 … すべての所有曲（自動・シリアル番号順）
 *   スロット 2 以降 … ユーザーが作る（lib/usePlaylists.ts）。最後に「＋ 新しいプレイリスト」
 *
 * 選んだスロットの曲をカードの横スワイプで並べる。
 *   ・カードを押す → その曲からこの並びで流し始め、そのまま再生画面へ
 *     （再生画面ではカードを左右に払って曲送り。2026-09-24 代表指示）
 *   ・「このプレイリストを再生」→ 先頭から流す。画面は移らず、下に再生バナー
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { CardFace } from './CardFace';
import { PlaylistEditor, type EditorTrack } from './PlaylistEditor';
import { useT } from '../lib/i18n';
import type { PlaylistsController } from '../lib/usePlaylists';

type Item = { id: string; title: string; artworkUrl: string; serialNo?: string };

type Props = {
  /** 所有曲（シリアル番号順）。スロット 1 そのもの */
  owned: Item[];
  playlists: PlaylistsController;
  /**
   * 曲順どおりの trackId で流す。startId があれば（カードを押したとき）その曲から
   * 流して再生画面を開く。無ければ（再生ボタン）先頭から流し、画面は移らない
   */
  onPlayList: (trackIds: string[], startId?: string) => void;
  onDiscover: () => void;
};

const ALL = '__all__';
const CARD_GAP = 18;

const C = {
  text: '#ECEEF7',
  sub: '#9498BE',
  cyan: '#60CEE0',
  line: 'rgba(96,206,224,0.15)',
  chipOn: 'rgba(96,206,224,0.12)',
};

export const MyPlaylists: React.FC<Props> = ({
  owned,
  playlists,
  onPlayList,
  onDiscover,
}) => {
  const t = useT();
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.round(Math.min(220, screenW * 0.56));
  const cardH = Math.round(cardW * 1.5);

  const [selected, setSelected] = useState<string>(ALL);
  const [editorFor, setEditorFor] = useState<string | null>(null); // 'new' | playlist id

  const byId = useMemo(() => new Map(owned.map((o) => [o.id, o])), [owned]);
  const current = playlists.lists.find((p) => p.id === selected) ?? null;
  // 選んでいたプレイリストが消えたらスロット 1 に戻す
  const slot = current ? selected : ALL;
  const tracks: Item[] = useMemo(
    () =>
      current
        ? current.trackIds.map((id) => byId.get(id)).filter((x): x is Item => !!x)
        : owned,
    [current, byId, owned],
  );

  const editing = editorFor === 'new' ? null : playlists.lists.find((p) => p.id === editorFor) ?? null;
  const editorInitial = useMemo(
    () => (editing ? { name: editing.name, trackIds: editing.trackIds } : null),
    [editing],
  );

  const onEditorDone = useCallback(
    (name: string, trackIds: string[]) => {
      if (editorFor === 'new') {
        const id = playlists.create(name, trackIds);
        setSelected(id);
      } else if (editorFor) {
        playlists.rename(editorFor, name);
        playlists.setTracks(editorFor, trackIds);
      }
      setEditorFor(null);
    },
    [editorFor, playlists],
  );

  const onEditorDelete = useCallback(() => {
    if (editorFor && editorFor !== 'new') {
      playlists.remove(editorFor);
      setSelected(ALL);
    }
    setEditorFor(null);
  }, [editorFor, playlists]);

  if (owned.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>{t('collection.emptyTitle')}</Text>
        <Text style={styles.emptyBody}>{t('playlist.noOwned')}</Text>
        <Pressable
          style={({ pressed }) => [styles.discoverBtn, pressed && { opacity: 0.8 }]}
          onPress={onDiscover}
        >
          <Text style={styles.discoverLabel}>{t('collection.discover')}</Text>
        </Pressable>
      </View>
    );
  }

  const chip = (key: string, label: string, count?: number) => {
    const on = slot === key;
    return (
      <Pressable
        key={key}
        onPress={() => (key === 'new' ? setEditorFor('new') : setSelected(key))}
        style={({ pressed }) => [
          styles.chip,
          on && styles.chipOn,
          key === 'new' && styles.chipNew,
          pressed && { opacity: 0.8 },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
      >
        <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
          {label}
          {count != null ? `  ${count}` : ''}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      {/* スロット（デッキ）の列 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // 横の ScrollView は既定で縦に伸びる（flexGrow: 1）。伸ばすとチップと
        // カードの間に大きな空きができるので、中身の高さに留める
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.chips}
      >
        {chip(ALL, t('playlist.allOwned'), owned.length)}
        {playlists.lists.map((p) =>
          chip(p.id, p.name, p.trackIds.filter((id) => byId.has(id)).length),
        )}
        {chip('new', `＋ ${t('playlist.new')}`)}
      </ScrollView>

      {/* 選んだスロットの見出し */}
      <View style={styles.head}>
        <Text style={styles.headTitle} numberOfLines={1}>
          {current ? current.name : t('playlist.allOwned')}
        </Text>
        <Text style={styles.headCount}>{t('playlist.count', { n: tracks.length })}</Text>
        {current && (
          <Pressable
            onPress={() => setEditorFor(current.id)}
            hitSlop={10}
            accessibilityRole="button"
            style={styles.editBtn}
          >
            <Text style={styles.editText}>{t('playlist.edit')}</Text>
          </Pressable>
        )}
      </View>

      {/* カードの横スワイプ（1 枚ずつ止まる） */}
      {tracks.length === 0 ? (
        <View style={[styles.cardsEmpty, { height: cardH + 44 }]}>
          <Text style={styles.emptyTitle}>{t('playlist.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('playlist.emptyBody')}</Text>
        </View>
      ) : (
        <FlatList
          key={slot}
          data={tracks}
          keyExtractor={(i) => i.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardW + CARD_GAP}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: (screenW - cardW) / 2, gap: CARD_GAP }}
          style={{ flexGrow: 0 }}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => onPlayList(tracks.map((x) => x.id), item.id)}
              style={({ pressed }) => [{ width: cardW }, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <CardFace uri={item.artworkUrl} width={cardW} height={cardH} />
              <View style={styles.cardMeta}>
                <Text style={styles.cardNo}>{String(index + 1).padStart(2, '0')}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* 再生（Spotify のように、この並びで順に流す） */}
      <Pressable
        disabled={tracks.length === 0}
        onPress={() => onPlayList(tracks.map((x) => x.id))}
        style={({ pressed }) => [
          styles.play,
          tracks.length === 0 && { opacity: 0.35 },
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
        accessibilityRole="button"
      >
        <Text style={styles.playText}>▶　{t('playlist.play')}</Text>
      </Pressable>

      <PlaylistEditor
        visible={editorFor != null}
        initial={editorInitial}
        defaultName={t('playlist.defaultName', { n: playlists.lists.length + 2 })}
        owned={owned as EditorTrack[]}
        onDone={onEditorDone}
        onCancel={() => setEditorFor(null)}
        onDelete={editing ? onEditorDelete : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  chips: { paddingHorizontal: 22, paddingTop: 16, gap: 8 },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.line,
    justifyContent: 'center',
  },
  chipOn: { borderColor: C.cyan, backgroundColor: C.chipOn },
  chipNew: { borderStyle: 'dashed' },
  chipText: { color: C.sub, fontSize: 12, letterSpacing: 0.6 },
  chipTextOn: { color: C.cyan },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 16,
  },
  headTitle: { color: C.text, fontSize: 17, letterSpacing: 0.5, flexShrink: 1 },
  headCount: { color: C.sub, fontSize: 12 },
  editBtn: { marginLeft: 'auto' },
  editText: { color: C.cyan, fontSize: 13, letterSpacing: 0.5 },
  cardMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 },
  cardNo: { color: C.sub, fontSize: 11, fontVariant: ['tabular-nums'] },
  cardTitle: { color: C.text, fontSize: 13, flexShrink: 1 },
  cardsEmpty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  play: {
    alignSelf: 'center',
    marginTop: 26,
    width: 236,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.45)',
    backgroundColor: '#141634',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: { color: C.text, fontSize: 13, letterSpacing: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  emptyTitle: { color: C.text, fontSize: 17, letterSpacing: 0.5 },
  emptyBody: { color: C.sub, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  discoverBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.38)',
  },
  discoverLabel: { color: C.text, fontSize: 14, letterSpacing: 0.5 },
});

export default MyPlaylists;
