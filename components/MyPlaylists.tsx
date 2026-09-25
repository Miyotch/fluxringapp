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
import { CARD_ASPECT } from './CardGL';
import { PlayMark } from './icons';
import { PlaylistEditor, type EditorTrack } from './PlaylistEditor';
import { NUM_FONT, JP_SERIF_FONT } from '../constants/fonts';
import { useT } from '../lib/i18n';
import type { PlaylistsController } from '../lib/usePlaylists';

type Item = { id: string; title: string; artworkUrl: string; serialNo?: string };

type Props = {
  /** 所有曲（シリアル番号順）。スロット 1 そのもの */
  owned: Item[];
  playlists: PlaylistsController;
  /**
   * startId なし（「このプレイリストを再生」）＝曲順どおり先頭から流す。画面は移らない。
   * startId あり（カードを押した）＝その曲の再生画面を開く。すぐには流さず、再生画面の
   * 再生ボタンを押したときに、この並びで流し始める（2026-09-25 岡さん指示）
   */
  onPlayList: (trackIds: string[], startId?: string) => void;
  onDiscover: () => void;
};

const ALL = '__all__';
const CARD_GAP = 18;
/**
 * カードのまわりの高さ（見出し・カードの下の番号と曲名・再生ボタン）。
 * styles の head〜play の内訳と揃える。小さな端末では、この残りにカードを縮めて収める
 *   見出し 18＋22＋14 ／ カード下 12＋18 ／ ボタン 24＋44 ／ 下の余白 16
 */
const AROUND_H = 18 + 22 + 14 + 12 + 18 + 24 + 44 + 16;

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
  // チップの下の残りの高さ。見出し・カード・ボタンの塊をここに収めて縦の中央へ置く
  // （以前は上詰めで、小さな端末では再生ボタンが再生バナーの裏に隠れた）
  const [bodyH, setBodyH] = useState(0);
  const fitW = bodyH > 0 ? (bodyH - AROUND_H) / CARD_ASPECT : Infinity;
  const cardW = Math.round(Math.max(110, Math.min(220, screenW * 0.56, fitW)));
  const cardH = Math.round(cardW * CARD_ASPECT);

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

  // 件数は下の見出しに出すので、チップは名前だけ（同じ数を二度読ませない）
  const chip = (key: string, label: string) => {
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
        {chip(ALL, t('playlist.allOwned'))}
        {playlists.lists.map((p) => chip(p.id, p.name))}
        {chip('new', `＋ ${t('playlist.new')}`)}
      </ScrollView>

      <View
        style={styles.body}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setBodyH((prev) => (Math.abs(prev - h) < 0.5 ? prev : h));
        }}
      >
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
        <View style={[styles.cardsEmpty, { height: cardH + 30 }]}>
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
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onPlayList(tracks.map((x) => x.id), item.id)}
              style={({ pressed }) => [{ width: cardW }, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <CardFace uri={item.artworkUrl} width={cardW} height={cardH} />
              {/* 番号は作品の通し番号（ウィッシュリスト・作品詳細と同じ No. 003）。
                  以前はリスト内の並び順（01, 02…）で、同じ作品が場所によって別の番号に見えた */}
              <View style={styles.cardMeta}>
                {!!item.serialNo && <Text style={styles.cardNo}>{item.serialNo}</Text>}
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* 所有カードは自動で流さない。カードを押して再生画面を開き、そこで
          再生ボタンを押して流す（2026-09-25 岡さん指示）。自分で作ったリストは
          「このプレイリストを再生」で、この並びのまま順に流せる */}
      {current ? (
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
          <PlayMark size={15} color={C.cyan} />
          <Text style={styles.playText}>{t('playlist.play')}</Text>
        </Pressable>
      ) : (
        <Text style={styles.tapHint}>{tracks.length > 0 ? t('playlist.tapHint') : ' '}</Text>
      )}
      </View>

      <PlaylistEditor
        visible={editorFor != null}
        initial={editorInitial}
        defaultName={t('playlist.defaultName', { n: playlists.lists.length + 1 })}
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
  // チップの上は 24。上端のフェード（22px）にチップの縁がかからないように
  chips: { paddingHorizontal: 22, paddingTop: 24, gap: 8 },
  // 見出し・カード・ボタンの塊。残りの高さの縦の中央に置く
  body: { flex: 1, justifyContent: 'center', paddingBottom: 16 },
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
    paddingTop: 18,
    paddingBottom: 14,
  },
  headTitle: {
    color: C.text,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 0.9,
    flexShrink: 1,
    fontFamily: JP_SERIF_FONT,
  },
  headCount: { color: C.sub, fontSize: 12, letterSpacing: 0.6 },
  editBtn: { marginLeft: 'auto' },
  editText: { color: C.cyan, fontSize: 13, letterSpacing: 0.5 },
  cardMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12, height: 18 },
  cardNo: { color: C.sub, fontSize: 11, letterSpacing: 1.6, fontFamily: NUM_FONT },
  cardTitle: { color: C.text, fontSize: 13, letterSpacing: 0.6, flexShrink: 1, fontFamily: JP_SERIF_FONT },
  cardsEmpty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  // 再生ボタン。HOME・作品詳細の購入ボタン（OrbitBuyButton）と同じ高さ・角丸・地の色
  play: {
    alignSelf: 'center',
    marginTop: 24,
    height: 44,
    paddingHorizontal: 26,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.45)',
    backgroundColor: 'rgba(14,14,40,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  playText: { color: C.text, fontSize: 13, letterSpacing: 2 },
  // 所有カードの案内文。再生ボタンと同じ位置・高さに置き、切り替えても下が動かない
  tapHint: {
    alignSelf: 'center',
    marginTop: 24,
    height: 44,
    lineHeight: 44,
    color: C.sub,
    fontSize: 12,
    letterSpacing: 2,
  },
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
