/**
 * useArtists.ts — Firestore の artists コレクションを購読
 * ------------------------------------------------------------------
 * 設定 →「Artistのご紹介」（screens/ArtistScreen.tsx）の Artist 型
 * （id/name/nameEn/role/bio/portraitUrl/sns）へ、Firestore側のフィールド名
 * （name/nameRoman/role/bio/philosophy/portraitUrl/snsLinks）を変換して渡す。
 * bio は「来歴」と「哲学」の2つの文章を \n\n で連結する
 * （STUB_ARTISTS の bio が同じ形で2段落になっていたのに合わせる。
 *   ArtistScreen 側は単一の <Text> で描画するため改行はそのまま活きる）。
 * 一覧の並び順は Firestore 側の order フィールドの昇順。
 *
 * SNS（sns）は artists.snsLinks（{typeId, url}[]）を sns_type コレクション
 * （{name, iconUrl}）で解決した {id, name, iconUrl, url}[]。sns_type は
 * ほぼ変わらないマスタなので、useTracks.ts の作家名取得と同じく購読ではなく
 * 起動時に1回だけ取得する。sns_type 側にまだ無い typeId は（未登録・取得失敗）
 * 出さない。
 */

import { useEffect, useMemo, useState } from 'react';
import { getDocs, onSnapshot, orderBy, query } from 'firebase/firestore';
import type { Artist, ArtistSnsLink } from '../screens/ArtistScreen';
import { artistsCol, snsTypeCol } from './firebaseFirestore';

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined;

type SnsTypeInfo = { name: string; iconUrl: string };
type RawArtist = { id: string } & Record<string, unknown>;

function parseSnsLinks(v: unknown, types: Map<string, SnsTypeInfo>): ArtistSnsLink[] {
  if (!Array.isArray(v)) return [];
  const out: ArtistSnsLink[] = [];
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const typeId = str((item as Record<string, unknown>).typeId);
    const url = str((item as Record<string, unknown>).url);
    if (!typeId || !url) continue;
    const info = types.get(typeId);
    if (!info) continue; // sns_type に無い typeId は解決しようがないので出さない
    out.push({ id: typeId, name: info.name, iconUrl: info.iconUrl, url });
  }
  return out;
}

export function useArtists(): Artist[] {
  const [snsTypes, setSnsTypes] = useState<Map<string, SnsTypeInfo>>(new Map());
  const [rawArtists, setRawArtists] = useState<RawArtist[]>([]);

  // SNSアイコンのマスタ。ほぼ変わらないので購読ではなく起動時に1回だけ取得する
  useEffect(() => {
    getDocs(snsTypeCol())
      .then((snap) => {
        const map = new Map<string, SnsTypeInfo>();
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          const name = str(data.name);
          const iconUrl = str(data.iconUrl);
          if (name && iconUrl) map.set(d.id, { name, iconUrl });
        });
        setSnsTypes(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(artistsCol(), orderBy('order', 'asc')),
      (snap) => {
        setRawArtists(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })));
      },
      () => setRawArtists([]),
    );
    return unsub;
  }, []);

  return useMemo(
    () =>
      rawArtists.map((data) => {
        const bio = str(data.bio);
        const philosophy = str(data.philosophy);
        return {
          id: data.id,
          name: str(data.name) ?? '',
          nameEn: str(data.nameRoman) ?? '',
          role: str(data.role) ?? '',
          bio: [bio, philosophy].filter(Boolean).join('\n\n'),
          portraitUrl: str(data.portraitUrl),
          sns: parseSnsLinks(data.snsLinks, snsTypes),
        } satisfies Artist;
      }),
    [rawArtists, snsTypes],
  );
}
