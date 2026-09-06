/**
 * useArticles.ts — Firestore の article コレクションをページング取得
 * ------------------------------------------------------------------
 * メディア画面（screens/MediaScreen.tsx）の Article 型（id/title/date/
 * body/thumbnailUrl/linkUrl）へ、Firestore 側のフィールド名
 * （title/description/date/thumbnail/sns_link）を変換して渡す。
 * 型はここで再定義せず MediaScreen.tsx の Article と構造的に一致させている
 * （screens → lib の逆依存を避けるため import はしない）。
 *
 * 表示条件・並び順は lib/firebaseFirestore.ts の fetchArticlesPage を参照
 * （published===true かつ date<=現在時刻、date の降順）。1ページ10件で、
 * loadMore() を呼ぶたびに次の10件を末尾へ追加する。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { fetchArticlesPage } from './firebaseFirestore';

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

export function useArticles(): ArticlesFeed {
  const [articles, setArticles] = useState<ArticleDoc[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | undefined>(undefined);
  // state だけだと loadMore の中身がクロージャで古い値を掴むため、
  // ガード判定は ref で持つ（loadMore の参照自体は毎回同じに保つ）
  const inFlightRef = useRef(false);
  const hasMoreRef = useRef(true);

  const loadMore = useCallback(() => {
    if (inFlightRef.current || !hasMoreRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    fetchArticlesPage(PAGE_SIZE, cursorRef.current)
      .then((snap) => {
        cursorRef.current = snap.docs[snap.docs.length - 1] ?? cursorRef.current;
        setArticles((prev) => [...prev, ...snap.docs.map((d) => toArticle(d.id, d.data()))]);
        const more = snap.docs.length === PAGE_SIZE;
        hasMoreRef.current = more;
        setHasMore(more);
      })
      .catch(() => {
        hasMoreRef.current = false;
        setHasMore(false);
      })
      .finally(() => {
        inFlightRef.current = false;
        setLoading(false);
      });
  }, []);

  // 初回マウントで1ページ目を読む
  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { articles, loadMore, hasMore, loading };
}
