/**
 * downloads.ts — 買った曲を端末に保存して、電波がなくても聴けるようにする（2026-10-13）
 * ------------------------------------------------------------------
 *   ・保存先はアプリの中（Paths.document/fr-audio/）。他のアプリやファイル一覧からは見えない
 *   ・どの曲を保存したかは AsyncStorage に覚える（key = audioKey）
 *   ・再生の中枢（playback.tsx）は、保存済みならネットに行かずに端末のファイルを鳴らす
 *   ・試聴（まだ持っていない曲）は保存しない
 *   ・保存中にもう一度押すと一時停止、もう一度で続きから（2026-10-15 岡さん指摘）。
 *     まとめて保存（リストの ↓）も、止めたところで次の曲へ進まない
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
  | { status: 'paused'; progress: number }
  | { status: 'done'; uri: string; bytes: number }
  | { status: 'error' };

type Saved = Record<string, { uri: string; bytes: number }>;

let saved: Saved = {};
type Job = { progress: number; abort: AbortController; task?: DownloadTask; paused: boolean };
const running = new Map<string, Job>();
/** まとめて保存（DownloadButton の並び）を一時停止したもの。次の曲へ進ませない */
const pausedBatches = new Set<string>();
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
  if (r) return r.paused ? { status: 'paused', progress: r.progress } : { status: 'downloading', progress: r.progress };
  if (failed.has(audioKey)) return { status: 'error' };
  return { status: 'none' };
}

/** 済んだ・止めた・失敗したを1か所で片付ける。null（一時停止）なら running に残す */
async function settle(audioKey: string, job: Job, run: () => Promise<File | null>): Promise<boolean> {
  try {
    const file = await run();
    if (file === null) {
      // 一時停止。進み具合を残したまま、続きを待つ
      job.paused = true;
      emit();
      return false;
    }
    if (!file || !file.exists) throw new Error('download failed');
    saved = { ...saved, [audioKey]: { uri: file.uri, bytes: file.size ?? 0 } };
    persist();
    running.delete(audioKey);
    emit();
    return true;
  } catch {
    if (!job.abort.signal.aborted) failed.add(audioKey);
    running.delete(audioKey);
    emit();
    return false;
  }
}

/** 保存する。すでに保存済み・保存中なら何もしない（一時停止中なら続きから） */
export async function downloadTrack(audioKey: string): Promise<boolean> {
  if (!audioKey || saved[audioKey]) return !!saved[audioKey];
  const existing = running.get(audioKey);
  if (existing) return existing.paused ? resumeDownload(audioKey) : false;
  const abort = new AbortController();
  const job: Job = { progress: 0, abort, paused: false };
  running.set(audioKey, job);
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
    job.task = task;
    // URL を取りに行っているあいだに一時停止が押されていたら、始めずに止めておく
    if (job.paused) return false;
    return settle(audioKey, job, () => task.downloadAsync());
  } catch {
    if (!abort.signal.aborted) failed.add(audioKey);
    running.delete(audioKey);
    emit();
    return false;
  }
}

/** 保存中の曲を一時停止する（進み具合は残る） */
export function pauseDownload(audioKey: string) {
  const job = running.get(audioKey);
  if (!job || job.paused) return;
  job.paused = true;
  emit();
  try {
    job.task?.pause();
  } catch {}
}

/** 一時停止した曲を続きから保存する */
export async function resumeDownload(audioKey: string): Promise<boolean> {
  const job = running.get(audioKey);
  if (!job || !job.paused) return false;
  job.paused = false;
  emit();
  const task = job.task;
  if (!task) {
    // URL を取る前に止めていた → 最初からやり直す
    running.delete(audioKey);
    return downloadTrack(audioKey);
  }
  return settle(audioKey, job, () =>
    task.state === 'paused' ? task.resumeAsync() : task.downloadAsync(),
  );
}

/**
 * 並びをまとめて保存する（1 曲ずつ順に。同時に何本も取りに行くと、モバイル回線で
 * 全部が遅くなる）。batchId の並びが一時停止されたら、次の曲へは進まない。
 * 戻り値: 'done'（全部済んだ）／'paused'／'failed'
 */
export async function downloadMany(batchId: string, keys: string[]): Promise<'done' | 'paused' | 'failed'> {
  pausedBatches.delete(batchId);
  let allOk = true;
  for (const k of keys) {
    if (saved[k]) continue;
    if (pausedBatches.has(batchId)) return 'paused';
    const ok = await downloadTrack(k);
    if (running.get(k)?.paused || pausedBatches.has(batchId)) return 'paused';
    if (!ok) allOk = false;
  }
  return allOk ? 'done' : 'failed';
}

/** まとめて保存を一時停止する（保存中の曲も止める） */
export function pauseMany(batchId: string, keys: string[]) {
  pausedBatches.add(batchId);
  keys.forEach(pauseDownload);
  emit();
}

export function isBatchPaused(batchId: string) {
  return pausedBatches.has(batchId);
}

/** 保存をやめる（保存中なら止める）。端末のファイルも消す */
export function removeDownload(audioKey: string) {
  const job = running.get(audioKey);
  job?.abort.abort();
  try {
    if (job?.task && job.task.state !== 'completed') job.task.cancel();
  } catch {}
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
    pause: pauseDownload,
    resume: resumeDownload,
    downloadMany,
    pauseMany,
    /** 並びのうち、保存済みの数 */
    countDone: (keys: string[]) => keys.filter((k) => !!saved[k]).length,
    /** 並びのうち、保存中の数 */
    countRunning: (keys: string[]) => keys.filter((k) => running.has(k) && !running.get(k)!.paused).length,
    /** 保存した大きさの合計（バイト） */
    bytesOf: (keys: string[]) => keys.reduce((a, k) => a + (saved[k]?.bytes ?? 0), 0),
    /** まとめて消す */
    removeAll: (keys: string[]) => keys.forEach((k) => removeDownload(k)),
  };
}

/** バイト数を「182.4 MB」のように */
export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(0, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
