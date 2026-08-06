/**
 * useSoundPreviews.ts — 楽曲IDの配列から Firestore sound/{id}.r2_preview を購読
 * ------------------------------------------------------------------
 * ホーム（ディスカバー）のカードごとの試聴URLを、R2の固定ファイル名規則
 * ではなく Firestore の sound コレクション（artworks と同一IDの1対1）から
 * 取得する。r2_preview が空文字・未設定・ドキュメント無しの曲は null（試聴なし）。
 */

import { useEffect, useState } from 'react';
import { subscribeSoundPreview } from './firebaseFirestore';

export function useSoundPreviews(ids: string[]): Map<string, string | null> {
  const [previews, setPreviews] = useState<Map<string, string | null>>(new Map());
  // ids の中身が変わらない限り再購読しない（配列は毎レンダー新しい参照になりうるため）
  const key = ids.join(',');

  useEffect(() => {
    if (!key) {
      setPreviews(new Map());
      return;
    }
    const list = key.split(',');
    const unsubs = list.map((id) =>
      subscribeSoundPreview(
        id,
        (url) => {
          setPreviews((prev) => {
            const next = new Map(prev);
            next.set(id, url);
            return next;
          });
        },
        () => {
          // 読み取り失敗時は「試聴なし」扱いにするだけで、他の動作は壊さない
          setPreviews((prev) => {
            const next = new Map(prev);
            next.set(id, null);
            return next;
          });
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [key]);

  return previews;
}
