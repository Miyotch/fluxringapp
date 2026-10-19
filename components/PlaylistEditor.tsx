/**
 * PlaylistEditor.tsx — マイプレイリスト（スロット 2 以降）を作る・直す画面
 * ------------------------------------------------------------------
 * 2026-10-19 岡さん案（FR 新規プレイリスト シミュレーション）で組み直した。
 *   ・シートではなく一枚の画面（下のプレイリスト画面の見出しが透けて見えないように）。
 *     上は「キャンセル」「完了」だけ（真ん中の「新しいプレイリスト」は撤去）
 *   ・名前は下線だけの大きな入力欄。空のときは「新規プレイリスト名」と薄く出す
 *   ・その下に「合計：n曲　m分s秒」
 *   ・行は「入れる／外す」の文字ボタンではなく、右端の丸い「＋」。入れると丸の中がシアンの点に
 *     変わる。行のどこを押しても入れる・外すが切り替わる
 *   ・カードのサムネに再生ボタン（入れていない曲にも）。入れるのとは別の操作で、
 *     聴きながら選べる。流れている曲は ⏸ に変わり、曲名がシアン
 *   ・曲名の書き方は 上＝曲名／下＝シリアル · 作家名（新規・編集とも同じ）
 *
 * 新規: 所有している曲を通し番号順に一列で並べ、押した順にリストへ入る（並びは動かさない）。
 * 編集: 入っている曲を上（長押しで並べ替え）、ほかの所有曲を下に分けて出す。
 *
 * 手元の下書きを直して、「完了」で一度に保存する（途中で閉じれば何も変わらない）。
 * 並べ替えは、行を長押しして上下に動かす（2026-09-25 岡さん指示）。読み上げ（VoiceOver /
 * TalkBack）では長押しのドラッグができないので、行に「上へ」「下へ」の操作だけ残す。
 * 行の押し分けは RNGH の Tap にしている。RN の Pressable は長押しの間タッチを握って
 * しまい、並べ替えの Pan が始まらなくなるため（2026-09-26 に踏んだ）。
 * Modal の中は Android で手の動きが届かないことがあるので、中身を GestureHandlerRootView で包む。
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  ScrollView,
} from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useI18n, useT } from '../lib/i18n';
import { useBottomInset, useTopInset } from '../lib/safeArea';
import { JP_SERIF_FONT, NUM_FONT } from '../constants/fonts';
import { usePlaybackOptional } from '../lib/playback';
import { formatDuration, sumDurations, useDurations } from '../lib/durations';
import { CreditsBackdrop } from './CreditsBackdrop';
import { PauseMark, PlayMark } from './icons';

/** 1 行の高さ（サムネ 66 ＋ 上下 8） */
const ROW_H = 82;
/** 持ち上げるまでの長押し(ms) */
const LIFT_MS = 260;

export type EditorTrack = {
  id: string;
  title: string;
  artworkUrl: string;
  serialNo?: string;
  artist?: string;
  /** 長さを引くキー（無ければ id） */
  audioKey?: string;
};

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
  /** サムネの再生ボタン → その並びのまま、その曲から流す */
  onPlayTrack?: (trackIds: string[], startId: string) => void;
};

const C = {
  text: '#ECEEF7',
  sub: 'rgba(236,238,247,0.62)',
  faint: 'rgba(236,238,247,0.36)',
  line: 'rgba(160,176,230,0.16)',
  cyan: '#60CEE0',
  cyanSoft: '#9FE3EE',
  danger: '#E5484D',
};

/** 合計時間。日本語は「1時間2分5秒」、英語は「1:02:05」 */
const totalLabel = (sec: number, lang: string) => {
  if (lang !== 'ja') return formatDuration(sec);
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}時間` : ''}${m}分${s % 60}秒`;
};

/** 右端の丸。入っていなければ「＋」、入っていればシアンの点 */
const PickMark: React.FC<{ on: boolean }> = ({ on }) => (
  <View style={[styles.mark, on && styles.markOn]}>
    {on ? (
      <View style={styles.markDot} />
    ) : (
      <>
        <View style={styles.plusH} />
        <View style={styles.plusV} />
      </>
    )}
  </View>
);

const Row: React.FC<{
  item: EditorTrack;
  picked: boolean;
  duration?: number;
  /** この行の曲が流れている（一時停止中を含む） */
  current: boolean;
  playing: boolean;
  onToggle: () => void;
  onPlay?: () => void;
}> = ({ item, picked, duration, current, playing, onToggle, onPlay }) => {
  const t = useT();
  const [pressed, setPressed] = useState(false);
  // 長押しの時間より前に離したときだけ成立する（それ以降は並べ替えの Pan が先に取る）
  const pickTap = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .maxDuration(LIFT_MS - 20)
        .onBegin(() => setPressed(true))
        .onFinalize(() => setPressed(false))
        .onEnd((_e, ok) => {
          if (ok) onToggle();
        }),
    [onToggle],
  );
  const playTap = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .maxDuration(LIFT_MS - 20)
        .onEnd((_e, ok) => {
          if (ok) onPlay?.();
        }),
    [onPlay],
  );
  const sub = [item.serialNo, item.artist].filter(Boolean).join(' · ');
  return (
    <View style={styles.row}>
      <GestureDetector gesture={playTap}>
        <View
          style={[styles.thumbWrap, current && styles.thumbOn]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t(playing ? 'playlist.pauseThis' : 'playlist.playThis', { title: item.title })}
        >
          <Image source={{ uri: item.artworkUrl }} style={styles.thumb} />
          {onPlay && (
            <View style={styles.thumbPlay} pointerEvents="none">
              {playing ? <PauseMark size={10} color={C.text} /> : <PlayMark size={10} color={C.text} />}
            </View>
          )}
        </View>
      </GestureDetector>
      <GestureDetector gesture={pickTap}>
        <View
          style={[styles.pick, pressed && { opacity: 0.7 }]}
          accessible
          accessibilityRole="button"
          accessibilityState={{ selected: picked }}
          accessibilityLabel={t(picked ? 'playlist.unpick' : 'playlist.pick', { title: item.title })}
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, current && styles.rowTitleOn]} numberOfLines={1}>
              {item.title}
            </Text>
            {!!sub && (
              <Text style={styles.rowSub} numberOfLines={1}>
                {sub}
              </Text>
            )}
          </View>
          {duration != null && <Text style={styles.dur}>{formatDuration(duration)}</Text>}
          <PickMark on={picked} />
        </View>
      </GestureDetector>
    </View>
  );
};

/**
 * 並べ替えられる 1 行。長押しで持ち上げ、上下に動かして離すと onDrop(from, to)。
 * 持ち上げている行は指について動き、間の行は 1 行ぶんよける。
 */
const DragRow: React.FC<{
  index: number;
  count: number;
  dragIndex: SharedValue<number>;
  dragDy: SharedValue<number>;
  onLift: () => void;
  onDrop: (from: number, to: number) => void;
  /** 読み上げ用の「上へ」「下へ」。見た目のボタンは出さない */
  onMove: (d: -1 | 1) => void;
  moveLabels: { up: string; down: string };
  children: React.ReactNode;
}> = ({ index, count, dragIndex, dragDy, onLift, onDrop, onMove, moveLabels, children }) => {
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(LIFT_MS)
        .onStart(() => {
          'worklet';
          dragIndex.value = index;
          dragDy.value = 0;
          runOnJS(onLift)();
        })
        .onUpdate((e) => {
          'worklet';
          // 一覧の外へは出さない
          const min = -index * ROW_H;
          const max = (count - 1 - index) * ROW_H;
          dragDy.value = Math.max(min, Math.min(max, e.translationY));
        })
        .onEnd(() => {
          'worklet';
          const to = Math.max(0, Math.min(count - 1, Math.round(index + dragDy.value / ROW_H)));
          runOnJS(onDrop)(index, to);
        }),
    [index, count, dragIndex, dragDy, onLift, onDrop],
  );

  const style = useAnimatedStyle(() => {
    const d = dragIndex.value;
    if (d === index) {
      return {
        transform: [{ translateY: dragDy.value }, { scale: 1.02 }],
        zIndex: 10,
        backgroundColor: 'rgba(96,206,224,0.08)',
      };
    }
    if (d < 0) {
      return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0, backgroundColor: 'transparent' };
    }
    const hover = Math.max(0, Math.min(count - 1, Math.round(d + dragDy.value / ROW_H)));
    let shift = 0;
    if (d < index && index <= hover) shift = -ROW_H;
    else if (hover <= index && index < d) shift = ROW_H;
    return {
      transform: [{ translateY: withTiming(shift, { duration: 140 }) }, { scale: 1 }],
      zIndex: 0,
      backgroundColor: 'transparent',
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.dragRow, style]}
        accessibilityActions={[
          ...(index > 0 ? [{ name: 'moveUp', label: moveLabels.up }] : []),
          ...(index < count - 1 ? [{ name: 'moveDown', label: moveLabels.down }] : []),
        ]}
        onAccessibilityAction={(e) => onMove(e.nativeEvent.actionName === 'moveUp' ? -1 : 1)}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

export const PlaylistEditor: React.FC<Props> = ({
  visible,
  initial,
  defaultName,
  owned,
  onDone,
  onCancel,
  onDelete,
  onPlayTrack,
}) => {
  const t = useT();
  const { lang } = useI18n();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const padTop = useTopInset(4);
  const padBottom = useBottomInset(16);
  const pb = usePlaybackOptional();
  const currentId = pb?.current?.id ?? null;
  const isPlaying = !!pb?.playing;
  const [name, setName] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [focused, setFocused] = useState(false);
  const isEdit = initial != null;

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
  const pickedSet = new Set(inList.map((x) => x.id));
  const rest = owned.filter((o) => !pickedSet.has(o.id));

  // 曲の長さ（行の右・合計）。分かりしだい描き直す
  const keyOf = (x: EditorTrack) => x.audioKey || x.id;
  const durs = useDurations(owned.map(keyOf));
  const durById = new Map(owned.map((o, i) => [o.id, durs[i]]));
  const total = sumDurations(inList.map((x) => durById.get(x.id)));

  const toggle = (id: string) =>
    setIds((prev) => {
      const cur = prev.filter((x) => byId.has(x));
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });

  // サムネの再生ボタン。流れている曲なら一時停止／再開、ほかの曲ならその並びで流す
  const play = (id: string, order: string[]) => {
    if (id === currentId && pb) {
      if (isPlaying) pb.pause();
      else pb.toggle();
      return;
    }
    onPlayTrack?.(order, id);
  };

  const moveLabels = useMemo(() => ({ up: t('playlist.moveUp'), down: t('playlist.moveDown') }), [t]);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= inList.length) return;
    const next = inList.map((x) => x.id);
    [next[i], next[j]] = [next[j], next[i]];
    setIds(next);
  };

  // ── 長押しでの並べ替え（編集のときだけ） ──
  const dragIndex = useSharedValue(-1);
  const dragDy = useSharedValue(0);
  const [dragging, setDragging] = useState(false);
  const inListIds = inList.map((x) => x.id).join('|');
  // 並びを確定した描き直しと同じ時に、持ち上げの状態を戻す（行がもとの位置へ
  // 一瞬戻って見えないように）
  useLayoutEffect(() => {
    dragIndex.value = -1;
    dragDy.value = 0;
  }, [inListIds, dragIndex, dragDy]);
  const onLift = useCallback(() => setDragging(true), []);
  const onDrop = useCallback(
    (from: number, to: number) => {
      setDragging(false);
      if (from === to) {
        dragDy.value = withTiming(0, { duration: 140 }, () => {
          dragIndex.value = -1;
        });
        return;
      }
      setIds((prev) => {
        const cur = prev.filter((id) => byId.has(id));
        const [moved] = cur.splice(from, 1);
        cur.splice(to, 0, moved);
        return cur;
      });
    },
    [byId, dragDy, dragIndex],
  );

  const canDone = isEdit || !!name.trim() || inList.length > 0;
  const done = () => {
    if (!canDone) return;
    onDone(name.trim() || defaultName, inList.map((x) => x.id));
  };

  const ownedOrder = owned.map((x) => x.id);
  const draftOrder = inList.map((x) => x.id);
  const rowFor = (item: EditorTrack, order: string[]) => (
    <Row
      item={item}
      picked={pickedSet.has(item.id)}
      duration={durById.get(item.id)}
      current={item.id === currentId}
      playing={item.id === currentId && isPlaying}
      onToggle={() => toggle(item.id)}
      onPlay={onPlayTrack ? () => play(item.id, order) : undefined}
    />
  );

  const countText = t('playlist.total', { n: inList.length });
  const metaText =
    inList.length > 0 && total != null && total > 0 ? `${countText}　${totalLabel(total, lang)}` : countText;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <CreditsBackdrop w={screenW} h={screenH} />
        <Animated.View entering={FadeIn.duration(260)} style={[styles.page, { paddingTop: padTop }]}>
          <View style={styles.head}>
            <Pressable onPress={onCancel} hitSlop={10} accessibilityRole="button">
              <Text style={styles.headBtn}>{t('playlist.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={done}
              disabled={!canDone}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canDone }}
            >
              <Text style={[styles.headBtn, styles.headDone, !canDone && styles.headDoneOff]}>
                {t('playlist.done')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.top}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('playlist.newNamePlaceholder')}
              placeholderTextColor="rgba(236,238,247,0.22)"
              style={styles.name}
              maxLength={30}
              returnKeyType="done"
              selectionColor={C.cyan}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              accessibilityLabel={t('playlist.name')}
            />
            <View style={[styles.rule, focused && styles.ruleOn]} />
            <Text style={[styles.meta, inList.length > 0 && styles.metaOn]}>{metaText}</Text>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={{ paddingBottom: padBottom + 24 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEnabled={!dragging}
          >
            {isEdit ? (
              <>
                {inList.length > 0 && (
                  <Text style={styles.label}>
                    {t('playlist.inList')}
                    {inList.length > 1 ? `　${t('playlist.dragHint')}` : ''}
                  </Text>
                )}
                {inList.map((item, i) => (
                  <DragRow
                    key={item.id}
                    index={i}
                    count={inList.length}
                    dragIndex={dragIndex}
                    dragDy={dragDy}
                    onLift={onLift}
                    onDrop={onDrop}
                    onMove={(d) => move(i, d)}
                    moveLabels={moveLabels}
                  >
                    {rowFor(item, draftOrder)}
                  </DragRow>
                ))}
                {rest.length > 0 && <Text style={styles.label}>{t('playlist.addable')}</Text>}
                {rest.map((item) => (
                  <View key={item.id} style={styles.plainRow}>
                    {rowFor(item, ownedOrder)}
                  </View>
                ))}
              </>
            ) : (
              // 新規は一列のまま。押した順にリストへ入り、行は動かない
              owned.map((item) => (
                <View key={item.id} style={styles.plainRow}>
                  {rowFor(item, ownedOrder)}
                </View>
              ))
            )}

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
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E0C20' },
  page: { flex: 1 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  headBtn: { color: C.sub, fontSize: 15, letterSpacing: 0.9, paddingVertical: 8 },
  headDone: { color: C.cyan },
  headDoneOff: { opacity: 0.3 },
  top: { paddingHorizontal: 22, paddingTop: 18 },
  // 名前: 下線だけの大きな入力欄（ゴシック・細字）
  name: {
    color: C.text,
    fontSize: 26,
    fontWeight: '300',
    letterSpacing: 1.5,
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: 0,
  },
  rule: { height: 1, backgroundColor: C.line },
  ruleOn: { backgroundColor: 'rgba(96,206,224,0.7)' },
  meta: { color: C.faint, fontSize: 12, letterSpacing: 0.7, lineHeight: 30, fontVariant: ['tabular-nums'] },
  metaOn: { color: C.sub },
  list: { flex: 1, marginTop: 4 },
  label: { color: C.faint, fontSize: 11, letterSpacing: 1.6, marginTop: 14, marginBottom: 2, paddingHorizontal: 22 },
  plainRow: { height: ROW_H, justifyContent: 'center' },
  // 並べ替えられる行。高さを固定して、指の移動量から落とす位置を決める
  dragRow: { height: ROW_H, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22 },
  thumbWrap: { width: 44, height: 66, borderRadius: 5, overflow: 'hidden' },
  thumbOn: { borderWidth: 1, borderColor: 'rgba(96,206,224,0.85)' },
  thumb: { width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.05)' },
  // サムネの上の再生ボタン（押すと流す）
  thumbPlay: {
    position: 'absolute',
    left: 10,
    top: 21,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(10,10,28,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pick: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'stretch' },
  rowText: { flex: 1, minWidth: 0, justifyContent: 'center' },
  // 上＝曲名（明朝）／下＝シリアル · 作家名（新規・編集とも同じ。2026-10-19 岡さん指定）
  rowTitle: { color: C.text, fontSize: 17, letterSpacing: 0.7, fontFamily: JP_SERIF_FONT },
  rowTitleOn: { color: C.cyanSoft },
  rowSub: { color: C.faint, fontSize: 11, letterSpacing: 1.4, marginTop: 4, fontFamily: NUM_FONT },
  dur: { color: C.faint, fontSize: 12, letterSpacing: 0.5, fontFamily: NUM_FONT },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(236,238,247,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: { borderColor: 'rgba(96,206,224,0.6)' },
  markDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.cyan,
    shadowColor: C.cyan,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  plusH: { position: 'absolute', width: 9, height: 1, backgroundColor: C.sub },
  plusV: { position: 'absolute', width: 1, height: 9, backgroundColor: C.sub },
  delete: { marginTop: 28, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 18 },
  deleteText: { color: C.danger, fontSize: 13, letterSpacing: 0.5 },
});

export default PlaylistEditor;
