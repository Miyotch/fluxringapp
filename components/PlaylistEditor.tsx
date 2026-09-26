/**
 * PlaylistEditor.tsx — マイプレイリスト（スロット 2 以降）を作る・直すシート
 * ------------------------------------------------------------------
 *   ・名前
 *   ・入っている曲（上へ・下へで並べ替え、外す）
 *   ・所有している曲から入れる
 *   ・削除（2 度押しで確定。確認ダイアログは出さない）
 *
 * 手元の下書きを直して、「完了」で一度に保存する（途中で閉じれば何も変わらない）。
 * 並べ替えは、行を長押しして上下に動かす（2026-09-25 岡さん指示）か、↑↓ ボタン。
 * 入っている曲の行を軽く押すと、いまの並び（下書き）のままその曲から流す（2026-09-26）。
 * 流れている曲の行は曲名がシアンになり、番号の代わりに「再生中」と出る。
 *
 * 長押しで持ち上げた行は指について動き、ほかの行はよけるように 1 行ぶん滑る。
 * 指を離した位置で並びを確定する。行の高さは固定（ROW_H）なので、指の移動量を
 * 行の高さで割れば落とす位置が決まる。Modal の中は Android で手の動きが届かない
 * ことがあるので、中身を GestureHandlerRootView で包む。
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
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  ScrollView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useT } from '../lib/i18n';
import { useBottomInset } from '../lib/safeArea';
import { JP_SERIF_FONT, NUM_FONT } from '../constants/fonts';
import { usePlaybackOptional } from '../lib/playback';
import { PlayMark } from './icons';

/** 入っている曲の 1 行の高さ（サムネ 54 ＋ 上下 7） */
const ROW_H = 68;
/** 持ち上げるまでの長押し(ms) */
const LIFT_MS = 260;

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
  /** 入っている曲の行を押した → 下書きの並びのまま、その曲から流す */
  onPlayTrack?: (trackIds: string[], startId: string) => void;
};

const C = {
  text: '#ECEEF7',
  sub: '#9498BE',
  cyan: '#60CEE0',
  line: 'rgba(96,206,224,0.15)',
  sheet: '#0E0D26',
  danger: '#E5484D',
};

const Row: React.FC<{
  item: EditorTrack;
  children: React.ReactNode;
  /** 渡したときだけ、サムネと曲名を押すと流せる（▶ の印も出す） */
  onPlay?: () => void;
  /** この行の曲が流れている */
  playing?: boolean;
  playingLabel?: string;
}> = ({ item, children, onPlay, playing, playingLabel }) => {
  const body = (
    <>
      <View>
        <Image source={{ uri: item.artworkUrl }} style={styles.thumb} />
        {onPlay && !playing && (
          <View style={styles.thumbPlay} pointerEvents="none">
            <PlayMark size={12} color="#ECEEF7" />
          </View>
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, playing && styles.rowTitleOn]} numberOfLines={1}>
          {item.title}
        </Text>
        {playing ? (
          <Text style={styles.rowPlaying}>{playingLabel}</Text>
        ) : (
          !!item.serialNo && <Text style={styles.rowSerial}>{item.serialNo}</Text>
        )}
      </View>
    </>
  );
  return (
    <View style={styles.row}>
      {onPlay ? (
        // 長押しは並べ替え（DragRow）に渡すので、ここでは軽く押したときだけ流す。
        // onLongPress を空で置くのは、長押しのあと指を離したときに onPress が
        // 走らないようにするため
        <Pressable
          onPress={onPlay}
          onLongPress={() => {}}
          delayLongPress={250}
          style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={item.title}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.rowMain}>{body}</View>
      )}
      <View style={styles.rowActs}>{children}</View>
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
  children: React.ReactNode;
}> = ({ index, count, dragIndex, dragDy, onLift, onDrop, children }) => {
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
      <Animated.View style={[styles.dragRow, style]}>{children}</Animated.View>
    </GestureDetector>
  );
};

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
  onPlayTrack,
}) => {
  const t = useT();
  const padBottom = useBottomInset(16);
  const pb = usePlaybackOptional();
  const playingId = pb?.current?.id ?? null;
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

  // ── 長押しでの並べ替え ──
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

  const done = () => {
    onDone(name.trim() || defaultName, inList.map((x) => x.id));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <GestureHandlerRootView style={styles.backdrop}>
        <Animated.View
          entering={SlideInDown.duration(300)}
          style={[styles.sheet, { paddingBottom: padBottom }]}
        >
          <View style={styles.head}>
            {/* 何のシートかを真ん中に（以前は「キャンセル」「完了」だけだった） */}
            <Text style={styles.headTitle} numberOfLines={1} pointerEvents="none">
              {initial ? t('playlist.editTitle') : t('playlist.new')}
            </Text>
            <Pressable onPress={onCancel} hitSlop={10} accessibilityRole="button">
              <Text style={styles.headBtn}>{t('playlist.cancel')}</Text>
            </Pressable>
            <Pressable onPress={done} hitSlop={10} accessibilityRole="button">
              <Text style={[styles.headBtn, styles.headDone]}>{t('playlist.done')}</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!dragging}
          >
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
            {inList.length > 1 && <Text style={styles.hint}>{t('playlist.dragHint')}</Text>}
            {inList.map((item, i) => (
              <DragRow
                key={item.id}
                index={i}
                count={inList.length}
                dragIndex={dragIndex}
                dragDy={dragDy}
                onLift={onLift}
                onDrop={onDrop}
              >
                <Row
                  item={item}
                  onPlay={onPlayTrack ? () => onPlayTrack(inList.map((x) => x.id), item.id) : undefined}
                  playing={item.id === playingId}
                  playingLabel={pb?.playing ? t('playback.playing') : t('playback.paused')}
                >
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
              </DragRow>
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
        </Animated.View>
      </GestureHandlerRootView>
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
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  headTitle: {
    position: 'absolute',
    left: 96,
    right: 96,
    textAlign: 'center',
    color: C.text,
    fontSize: 15,
    letterSpacing: 0.9,
    fontFamily: JP_SERIF_FONT,
  },
  headBtn: { color: C.sub, fontSize: 14, letterSpacing: 0.5 },
  headDone: { color: C.cyan },
  body: { paddingHorizontal: 22, paddingBottom: 24 },
  label: { color: C.sub, fontSize: 11, letterSpacing: 1.6, marginTop: 20, marginBottom: 8 },
  hint: { color: C.sub, fontSize: 12, lineHeight: 18, marginBottom: 6 },
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
  // サムネと曲名（押すと流せる行ではここが押せる）
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  // サムネの上の ▶（押すと流せることの印）
  thumbPlay: {
    position: 'absolute',
    left: 7,
    top: 16,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(5,4,12,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  // 並べ替えられる行。高さを固定して、指の移動量から落とす位置を決める
  dragRow: { height: ROW_H, justifyContent: 'center', borderRadius: 10 },
  thumb: { width: 36, height: 54, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.05)' },
  rowText: { flex: 1, minWidth: 0 },
  // 曲名は明朝・番号は数字の書体（ほかの画面と同じ）
  rowTitle: { color: C.text, fontSize: 14, letterSpacing: 0.6, fontFamily: JP_SERIF_FONT },
  rowSerial: { color: C.sub, fontSize: 11, letterSpacing: 1.6, marginTop: 3, fontFamily: NUM_FONT },
  rowTitleOn: { color: C.cyan },
  rowPlaying: { color: C.cyan, fontSize: 11, letterSpacing: 0.9, marginTop: 3 },
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
