/**
 * durations.ts — 曲の長さ（秒）を知る・覚える
 * ------------------------------------------------------------------
 * プレイリストの曲の行と、選択シートの合計時間（2026-10-15）に使う。
 * Firestore の tracks には長さの項目がまだ無いので、次の順で埋める。
 *   1) tracks/{id}.durationSec（管理画面が入れれば最優先。useTracks が register で渡す）
 *   2) 端末に覚えた値（AsyncStorage。一度わかった曲は通信しない）
 *   3) 音源の先頭だけを Range で読んで WAV のヘッダから計算する
 *   4) 再生中に音源から分かった長さ（playback から remember）
 * 3) はヘッダの 4KB だけを取る。サーバーが Range を受けず全体を返してきたら
 * その場で通信を切る（数十MB の WAV を丸ごと落とさない）。
 */

import { useEffect, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fr.durations.v1';
const HEADER_BYTES = 4096;

const known = new Map<string, number>();
const audioUrls = new Map<string, string>();
const probing = new Set<string>();
const failed = new Set<string>();
const listeners = new Set<() => void>();
let loaded: Promise<void> | null = null;

const emit = () => listeners.forEach((l) => l());

function load(): Promise<void> {
  if (!loaded) {
    loaded = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const obj = JSON.parse(raw) as Record<string, number>;
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === 'number' && v > 0 && !known.has(k)) known.set(k, v);
        }
        emit();
      })
      .catch(() => {});
  }
  return loaded;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
const persist = () => {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(known))).catch(() => {});
  }, 500);
};

/** 長さが分かったら覚える（再生中の音源・管理画面の値など） */
export function rememberDuration(key: string, sec: number | undefined | null) {
  if (!key || typeof sec !== 'number' || !Number.isFinite(sec) || sec <= 0) return;
  const v = Math.round(sec);
  if (known.get(key) === v) return;
  known.set(key, v);
  persist();
  emit();
}

/** useTracks から: 音源の URL と、管理画面が入れた長さ（あれば） */
export function registerTrackAudio(key: string, url: string | undefined, durationSec?: number) {
  if (url) audioUrls.set(key, url);
  if (durationSec) rememberDuration(key, durationSec);
}

export function durationOf(key: string): number | undefined {
  return known.get(key);
}

/** WAV（RIFF）のヘッダから秒数を出す。読めなければ null */
export function parseWavDuration(buf: ArrayBuffer, totalBytes?: number): number | null {
  const v = new DataView(buf);
  if (v.byteLength < 12) return null;
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  let byteRate = 0;
  let off = 12;
  while (off + 8 <= v.byteLength) {
    const id = tag(off);
    const size = v.getUint32(off + 4, true);
    if (id === 'fmt ' && off + 16 <= v.byteLength) {
      byteRate = v.getUint32(off + 8 + 8, true);
    } else if (id === 'data') {
      if (!byteRate) return null;
      // ストリーム書き出しの WAV は data の大きさが 0 や 0xFFFFFFFF のことがある
      // → ファイル全体の大きさから引き直す
      let dataBytes = size;
      if ((size === 0 || size === 0xffffffff) && totalBytes) dataBytes = totalBytes - (off + 8);
      return dataBytes > 0 ? dataBytes / byteRate : null;
    }
    off += 8 + size + (size % 2);
  }
  return null;
}

async function probe(key: string): Promise<void> {
  const url = audioUrls.get(key);
  if (!url || probing.has(key) || failed.has(key)) return;
  probing.add(key);
  const abort = new AbortController();
  try {
    const res = await fetch(url, { headers: { Range: `bytes=0-${HEADER_BYTES - 1}` }, signal: abort.signal });
    if (res.status !== 206) {
      abort.abort(); // 全体が返ってきた。落とし続けない
      failed.add(key);
      return;
    }
    const total = Number(res.headers.get('content-range')?.split('/')[1]) || undefined;
    const sec = parseWavDuration(await res.arrayBuffer(), total);
    if (sec) rememberDuration(key, sec);
    else failed.add(key);
  } catch {
    failed.add(key);
  } finally {
    probing.delete(key);
  }
}

/** いくつかの曲の長さ。分からない曲は undefined のまま、分かりしだい描き直す */
export function useDurations(keys: string[]): (number | undefined)[] {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const sig = keys.join('|');
  useEffect(() => {
    listeners.add(bump);
    let alive = true;
    load().then(async () => {
      // 同時に叩きすぎない（1本ずつ・ヘッダだけなので速い）
      for (const k of sig ? sig.split('|') : []) {
        if (!alive) return;
        if (!known.has(k)) await probe(k);
      }
    });
    return () => {
      alive = false;
      listeners.delete(bump);
    };
  }, [sig]);
  return keys.map((k) => known.get(k));
}

/** 秒 → 「4:12」／1時間以上は「1:02:05」 */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** 合計の秒数。1曲でも分からなければ null（中途半端な合計は出さない） */
export function sumDurations(list: (number | undefined)[]): number | null {
  if (list.length === 0) return 0;
  let total = 0;
  for (const d of list) {
    if (d == null) return null;
    total += d;
  }
  return total;
}
