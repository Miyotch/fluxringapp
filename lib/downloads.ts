/**
 * downloads.ts — 買った曲を端末に保存して、電波がなくても聴けるようにする（2026-10-13）
 * ------------------------------------------------------------------
 *   ・保存先はアプリの中（Paths.document/fr-audio/）。他のアプリやファイル一覧からは見えない
 *   ・どの曲を保存したかは AsyncStorage に覚える（key = audioKey）
 *   ・再生の中枢（playback.tsx）は、保存済みならネットに行かずに端末のファイルを鳴らす
 *   ・試聴（まだ持っていない曲）は保存しない
 *
 * 画面からは useDownloads() で状態を読む。再生の中枢からは localAudioUri() を同期で読む
 * （起動直後に AsyncStorage から読み込み終わるまでは「保存なし」として扱う＝ネットで鳴る）。
 */

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, DownloadTask, File, Paths } from 'expo-file-system';
import { fullAudioUrl } from './r2';

const STORAGE_KEY = 'fr.downloads.v1';

/** 1 曲の保存状態。progress は 0〜1（大きさが分からないときは -1） */
export type DownloadState =
  | { status: 'none' }
  | { status: 'downloading'; progress: number }
  | { status: 'done'; uri: string; bytes: number }
  | { status: 'error' };

type Saved = Record<string, { uri: string; bytes: number }>;

let saved: Saved = {};
const running = new Map<string, { progress: number; abort: AbortController }>();
const failed = new Set<string>();
const listeners = new Set<() => void>();
let loaded = false;

const emit = () => listeners.forEach((l) => l());

const dir = () => new Directory(Paths.document, 'fr-audio');

/** audioKey をファイル名に使える形へ（/ などを避ける） */
const fileNameOf = (audioKey: string) => `${audioKey.replace(/[^A-Za-z0-9._-]/g, '_')}.audio`;

const persist = () => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => {});

/** 起動時に一度だけ。消えていたファイルは覚えからも外す */
async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Saved) : {};
    const alive: Saved = {};
    for (const [key, v] of Object.entries(parsed)) {
      try {
        if (new File(v.uri).exists) alive[key] = v;
      } catch {}
    }
    saved = alive;
    if (Object.keys(alive).length !== Object.keys(parsed).length) persist();
  } catch {
    saved = {};
  }
  emit();
}
load();

/** 再生の中枢から同期で読む。保存済みなら file:// の URI */
export function localAudioUri(audioKey: string): string | null {
  return saved[audioKey]?.uri ?? null;
}

export function downloadState(audioKey: string): DownloadState {
  const s = saved[audioKey];
  if (s) return { status: 'done', uri: s.uri, bytes: s.bytes };
  const r = running.get(audioKey);
  if (r) return { status: 'downloading', progress: r.progress };
  if (failed.has(audioKey)) return { status: 'error' };
  return { status: 'none' };
}

/** 保存する。すでに保存済み・保存中なら何もしない */
export async function downloadTrack(audioKey: string): Promise<boolean> {
  if (!audioKey || saved[audioKey] || running.has(audioKey)) return !!saved[audioKey];
  const abort = new AbortController();
  running.set(audioKey, { progress: 0, abort });
  failed.delete(audioKey);
  emit();
  try {
    const url = await fullAudioUrl(audioKey);
    const d = dir();
    d.create({ idempotent: true, intermediates: true });
    const target = new File(d, fileNameOf(audioKey));
    // 途中で止まった前回の残りがあれば消してから
    if (target.exists) target.delete();
    const task = new DownloadTask(url, target, {
      signal: abort.signal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        const r = running.get(audioKey);
        if (!r) return;
        r.progress = totalBytes > 0 ? Math.min(1, bytesWritten / totalBytes) : -1;
        emit();
      },
    });
    const file = await task.downloadAsync();
    if (!file || !file.exists) throw new Error('download failed');
    saved = { ...saved, [audioKey]: { uri: file.uri, bytes: file.size ?? 0 } };
    persist();
    return true;
  } catch {
    if (!abort.signal.aborted) failed.add(audioKey);
    return false;
  } finally {
    running.delete(audioKey);
    emit();
  }
}

/** 保存をやめる（保存中なら止める）。端末のファイルも消す */
export function removeDownload(audioKey: string) {
  running.get(audioKey)?.abort.abort();
  running.delete(audioKey);
  failed.delete(audioKey);
  const s = saved[audioKey];
  if (s) {
    try {
      const f = new File(s.uri);
      if (f.exists) f.delete();
    } catch {}
    const { [audioKey]: _gone, ...rest } = saved;
    saved = rest;
    persist();
  }
  emit();
}

/** 画面用。保存の状態が変わるたびに描き直す */
export function useDownloads() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return {
    stateOf: downloadState,
    download: downloadTrack,
    remove: removeDownload,
    /** 並びのうち、保存済みの数 */
    countDone: (keys: string[]) => keys.filter((k) => !!saved[k]).length,
    /** 並びのうち、保存中の数 */
    countRunning: (keys: string[]) => keys.filter((k) => running.has(k)).length,
  };
}
