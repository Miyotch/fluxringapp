/**
 * useArticles.ts — Firestore の article コレクションをページング取得
 * ------------------------------------------------------------------
 * メディア画面（screens/MediaScreen.tsx）の Article 型（id/title/date/
 * body/thumbnailUrl/linkUrl）へ、Firestore 側のフィールド名
 * （title/description/date/thumbnail/sns_link）を変換して渡す。
 * 型はここで再定義せず MediaScreen.tsx の Article と構造的に一致させている
 * （screens → lib の逆依存を避けるため import はしない）。
 *
 * 表示条件・並び順（published===true かつ date<=現在時刻、date の降順）は
 * 取得後に端末側で適用する（複合インデックスが無くても出るように）。
 * 1ページ10件で、loadMore() を呼ぶたびに次の10件を見せる。
 */

import { useCallback, useEffect, useState } from 'react';
import { fetchArticleDocs } from './firebaseFirestore';

export type ArticleDoc = {
  id: string;
  title: string;
  date: string;
  body?: string;
  thumbnailUrl?: string;
  linkUrl?: string;
};

const PAGE_SIZE = 10;

// Firestore の Timestamp（.toDate() を持つ）/ Date / ISO文字列のいずれでも
// '2026.06.21' 形式（アプリの既存の日付表記）へ揃える。変換できなければ空文字。
function formatDate(v: unknown): string {
  const d =
    v instanceof Date
      ? v
      : v && typeof v === 'object' && typeof (v as { toDate?: unknown }).toDate === 'function'
      ? (v as { toDate: () => Date }).toDate()
      : typeof v === 'string'
      ? new Date(v)
      : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined;

function toArticle(id: string, data: Record<string, unknown>): ArticleDoc {
  return {
    id,
    title: str(data.title) ?? '',
    date: formatDate(data.date),
    body: str(data.description),
    thumbnailUrl: str(data.thumbnail),
    linkUrl: str(data.sns_link),
  };
}

export type ArticlesFeed = {
  articles: ArticleDoc[];
  loadMore: () => void;
  hasMore: boolean;
  loading: boolean;
};

// date を並べ替え用のミリ秒へ（Timestamp / Date / 文字列）。読めなければ null
function dateMs(v: unknown): number | null {
  const d =
    v instanceof Date
      ? v
      : v && typeof v === 'object' && typeof (v as { toDate?: unknown }).toDate === 'function'
      ? (v as { toDate: () => Date }).toDate()
      : typeof v === 'string'
      ? new Date(v)
      : null;
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : null;
}

export function useArticles(): ArticlesFeed {
  const [all, setAll] = useState<ArticleDoc[]>([]);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchArticleDocs()
      .then((snap) => {
        const now = Date.now();
        const rows = snap.docs
          .map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
          // 公開フラグが立っていて、公開日時（date）が未来でないもの。date が読めないものは出す
          .filter(({ data }) => {
            if (data.published !== true) return false;
            const ms = dateMs(data.date);
            return ms === null || ms <= now;
          })
          .sort((a, b) => (dateMs(b.data.date) ?? 0) - (dateMs(a.data.date) ?? 0));
        if (alive) setAll(rows.map(({ id, data }) => toArticle(id, data)));
      })
      .catch((e) => console.warn('[articles] 取得に失敗', e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // 「もっと見る」は取得済みの一覧を10件ずつ見せていく
  const loadMore = useCallback(() => setShown((n) => n + PAGE_SIZE), []);

  return { articles: all.slice(0, shown), loadMore, hasMore: all.length > shown, loading };
}
