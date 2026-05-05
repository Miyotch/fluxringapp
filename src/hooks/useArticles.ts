import { useEffect, useState } from 'react';
import { onArticlesSnapshot } from '../services/firestore';
import type { Article } from '../types/track';

/**
 * Subscribes to the `article` Firestore collection and exposes the published
 * articles, ordered with `stable` (pinned) items first, then by `date desc`.
 *
 * Mirrors the behaviour of the legacy web `ArticlesScreen` — see
 * `.reference/web/src/screens/ArticlesScreen.tsx`.
 */
export function useArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onArticlesSnapshot(
      (data) => {
        const sorted = [...data].sort((a, b) => {
          if (a.stable !== b.stable) return a.stable ? -1 : 1;
          return b.date.getTime() - a.date.getTime();
        });
        setArticles(sorted);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn('useArticles: snapshot error:', err.message);
        setArticles([]);
        setLoading(false);
        setError(err.message);
      },
    );

    return unsubscribe;
  }, []);

  return { articles, loading, error };
}
