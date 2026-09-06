/**
 * useArtists.ts — Firestore の artists コレクションを購読
 * ------------------------------------------------------------------
 * 設定 →「Artistのご紹介」（screens/ArtistScreen.tsx）の Artist 型
 * （id/name/nameEn/role/bio）へ、Firestore側のフィールド名
 * （name/nameRoman/role/bio/philosophy）を変換して渡す。
 * bio は「来歴」と「哲学」の2つの文章を \n\n で連結する
 * （STUB_ARTISTS の bio が同じ形で2段落になっていたのに合わせる。
 *   ArtistScreen 側は単一の <Text> で描画するため改行はそのまま活きる）。
 */

import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import type { Artist } from '../screens/ArtistScreen';
import { artistsCol } from './firebaseFirestore';

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined;

export function useArtists(): Artist[] {
  const [artists, setArtists] = useState<Artist[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      artistsCol(),
      (snap) => {
        setArtists(
          snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            const bio = str(data.bio);
            const philosophy = str(data.philosophy);
            return {
              id: d.id,
              name: str(data.name) ?? '',
              nameEn: str(data.nameRoman) ?? '',
              role: str(data.role) ?? '',
              bio: [bio, philosophy].filter(Boolean).join('\n\n'),
            } satisfies Artist;
          }),
        );
      },
      () => setArtists([]),
    );
    return unsub;
  }, []);

  return artists;
}
