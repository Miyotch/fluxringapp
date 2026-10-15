/**
 * DownloadButton.tsx — 端末に保存するボタン（1 曲・並びまとめての 2 形）（2026-10-13）
 * ------------------------------------------------------------------
 *   ・未保存 … 丸に↓。押すと保存を始める
 *   ・保存中 … 進み具合の輪（大きさが分からないときは回る輪の代わりに 1/4 の弧）。
 *              押すと一時停止（2026-10-15）
 *   ・一時停止 … 止まった輪＋中央に一時停止の印。押すと続きから。長押しで保存をやめる
 *   ・保存済 … シアンの塗りの丸に↓。押すと「端末から消しますか？」と確かめてから消す
 *   ・失敗   … 赤い縁。押すともう一度
 * 並びまとめて（keys を複数）のときは、全部済んでいれば保存済、どれか保存中なら輪。
 */

import React from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { DownloadIcon, PauseMark } from './icons';
import { useDownloads } from '../lib/downloads';
import { useT } from '../lib/i18n';
import { showToast } from '../lib/toast';

type Props = {
  /** 保存する曲の audioKey（1 曲なら 1 つ） */
  keys: string[];
  size?: number;
  /** 知らせに出す名前（曲名・リスト名） */
  label: string;
};

const CYAN = '#60CEE0';

export const DownloadButton: React.FC<Props> = ({ keys, size = 22, label }) => {
  const t = useT();
  const dl = useDownloads();
  const states = keys.map((k) => dl.stateOf(k));
  const done = keys.length > 0 && states.every((s) => s.status === 'done');
  const runningStates = states.filter((s) => s.status === 'downloading');
  const pausedStates = states.filter((s) => s.status === 'paused');
  // 並びのうち、どれかが止まっていて保存中のものが無ければ「一時停止」
  const paused = runningStates.length === 0 && pausedStates.length > 0;
  const batchId = keys.join('|');
  const failed = states.some((s) => s.status === 'error');
  // 進み具合: 済んだ曲は 1、保存中はその割合、未保存は 0 の平均
  const progress =
    keys.length === 0
      ? 0
      : states.reduce(
          (a, s) =>
            a +
            (s.status === 'done'
              ? 1
              : s.status === 'downloading' || s.status === 'paused'
              ? Math.max(0, s.progress)
              : 0),
          0,
        ) / keys.length;

  const startAll = async () => {
    // 1 曲ずつ順に（同時に何本も取りに行くと、モバイル回線で全部が遅くなる）。
    // 一時停止した曲があれば、その続きから
    const result = await dl.downloadMany(batchId, keys);
    if (result === 'done') showToast(t('download.done', { name: label }));
    else if (result === 'failed') showToast(t('download.failed'));
  };

  // 一時停止中に長押し → 保存をやめる（途中まで落とした分も消す）
  const onLongPress = () => {
    if (!paused) return;
    Alert.alert(t('download.cancelTitle'), t('download.cancelBody', { name: label }), [
      { text: t('playlist.cancel'), style: 'cancel' },
      {
        text: t('download.cancelDo'),
        style: 'destructive',
        onPress: () => keys.forEach((k) => dl.stateOf(k).status !== 'done' && dl.remove(k)),
      },
    ]);
  };

  const onPress = () => {
    if (runningStates.length > 0) {
      dl.pauseMany(batchId, keys);
      showToast(t('download.paused'));
      return;
    }
    if (paused) {
      startAll();
      return;
    }
    if (done) {
      Alert.alert(t('download.removeTitle'), t('download.removeBody', { name: label }), [
        { text: t('playlist.cancel'), style: 'cancel' },
        {
          text: t('download.remove'),
          style: 'destructive',
          onPress: () => {
            keys.forEach((k) => dl.remove(k));
            showToast(t('download.removed', { name: label }));
          },
        },
      ]);
      return;
    }
    startAll();
  };

  const r = size / 2 - 1.5;
  const circ = 2 * Math.PI * r;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, { width: size + 18, height: size + 18 }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={
        done
          ? t('download.savedA11y')
          : runningStates.length > 0
          ? t('download.pauseA11y')
          : paused
          ? t('download.resumeA11y')
          : t('download.saveA11y')
      }
      accessibilityValue={
        runningStates.length || paused ? { min: 0, max: 100, now: Math.round(progress * 100) } : undefined
      }
    >
      {runningStates.length > 0 || paused ? (
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(96,206,224,0.2)" strokeWidth={2} fill="none" />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={CYAN}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circ} ${circ}`}
              strokeDashoffset={circ * (1 - Math.max(0.06, progress))}
              opacity={paused ? 0.55 : 1}
            />
          </Svg>
          {paused && (
            <View style={styles.center} pointerEvents="none">
              <PauseMark size={size * 0.42} color={CYAN} />
            </View>
          )}
        </View>
      ) : (
        <View style={failed && styles.failed}>
          <DownloadIcon size={size} done={done} />
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  pressed: { backgroundColor: 'rgba(96,206,224,0.12)' },
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  failed: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,120,120,0.7)' },
});

export default DownloadButton;
