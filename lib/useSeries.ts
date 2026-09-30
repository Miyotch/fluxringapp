/**
 * useSeries.ts — Firestore の series コレクション（シリーズ＝アルバム）を購読
 * ------------------------------------------------------------------
 * 管理画面「シリーズを登録／編集」で作る。フィールドは
 *   name（名称）/ trackIds（収録曲の並び）/ description（説明）/
 *   jacketUrl（ジャケット画像）/ jacketThumbUrl（その縮小版）
 * description・jacket* は 2026-09-30 に管理画面へ足した項目で、古いシリーズには無い。
 *
 * 曲がどのシリーズに入るかは、series.trackIds と tracks.seriesId の両方を見る
 * （管理画面ではシリーズ側の「収録曲」と、曲側の「シリーズ」の2か所で選べて、
 *   どちらか片方だけ設定されていることがある）。並びは trackIds の順が先。
 */

import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { seriesCol } from './firebaseFirestore';

export type Series = {
  id: string;
  name: string;
  trackIds: string[];
  description?: string;
  /** 画面に出すジャケット。縮小版があればそちら */
  jacketUrl?: string;
};

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined;

export function useSeries(): Series[] {
  const [series, setSeries] = useState<Series[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(
      seriesCol(),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            name: str(data.name) ?? '',
            trackIds: Array.isArray(data.trackIds)
              ? data.trackIds.filter((x): x is string => typeof x === 'string')
              : [],
            description: str(data.description),
            jacketUrl: str(data.jacketThumbUrl) ?? str(data.jacketUrl),
          };
        });
        // 名称の無いもの（作りかけ）は出さない。並びは名称順で安定させる
        setSeries(list.filter((s) => s.name).sort((a, b) => a.name.localeCompare(b.name, 'ja')));
      },
      () => setSeries([]),
    );
    return unsub;
  }, []);
  return series;
}

/**
 * 曲の並びをシリーズごとに分ける。どのシリーズにも入らない曲は rest へ。
 * 1 曲が複数シリーズに入っていれば、それぞれに出す。
 */
export function groupBySeries<T extends { id: string; seriesId?: string }>(
  tracks: T[],
  series: Series[],
): { groups: { series: Series; tracks: T[] }[]; rest: T[] } {
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const placed = new Set<string>();
  const groups: { series: Series; tracks: T[] }[] = [];
  for (const s of series) {
    const out: T[] = [];
    const seen = new Set<string>();
    for (const id of s.trackIds) {
      const t = byId.get(id);
      if (t && !seen.has(id)) { out.push(t); seen.add(id); }
    }
    for (const t of tracks) {
      if (t.seriesId === s.id && !seen.has(t.id)) { out.push(t); seen.add(t.id); }
    }
    if (out.length > 0) {
      groups.push({ series: s, tracks: out });
      out.forEach((t) => placed.add(t.id));
    }
  }
  return { groups, rest: tracks.filter((t) => !placed.has(t.id)) };
}
