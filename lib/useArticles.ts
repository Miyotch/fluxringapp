/**
 * useArticles.ts — Firestore の article コレクションを新着順で購読
 * ------------------------------------------------------------------
 * メディア画面（screens/MediaScreen.tsx）の Article 型（id/title/date/
 * body/thumbnailUrl/linkUrl）へ、Firestore 側のフィールド名
 * （title/description/published/thumbnail/sns_link）を変換して渡す。
 * 型はここで再定義せず MediaScreen.tsx の Article と構造的に一致させている
 * （screens → lib の逆依存を避けるため import はしない）。
 */

import { useEffect, useState } from 'react';
import { subscribeArticles } from './firebaseFirestore';

export type ArticleDoc = {
  id: string;
  title: string;
  date: string;
  body?: string;
  thumbnailUrl?: string;
  linkUrl?: string;
};

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

export function useArticles(count = 20): ArticleDoc[] {
  const [articles, setArticles] = useState<ArticleDoc[]>([]);

  useEffect(() => {
    const unsub = subscribeArticles(
      count,
      (docs) => {
        setArticles(
          docs.map((d) => ({
            id: d.id,
            title: str(d.title) ?? '',
            date: formatDate(d.published),
            body: str(d.description),
            thumbnailUrl: str(d.thumbnail),
            linkUrl: str(d.sns_link),
          })),
        );
      },
      () => setArticles([]),
    );
    return unsub;
  }, [count]);

  return articles;
}
