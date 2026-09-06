/**
 * useTracks.ts — Firestore の tracks コレクションを新着順で購読
 * ------------------------------------------------------------------
 * CMS（Firebaseコンソール等）から追加された楽曲を、同梱の STUB_TRACKS
 * （v98_FIX ハンドオフの初期5作品）に加えて Discover に出す。
 * DiscoverScreen の Track 型へ、Firestore 側のフィールド名
 * （title/scene/artworkUrl/artistId/glow/glow2/story/tuning/price/
 *  r2_preview_url）を変換して渡す。
 *
 * ・audioKey / id は Firestore のドキュメントID をそのまま使う
 *   （所有権 users/{uid}/purchases/{trackId} と Worker の
 *   tracks/{audioKey}.r2_url 解決が同じ文字列を前提にしているため、
 *   ドキュメント内の audioKey フィールドは使わない）。
 * ・tuning フィールドは ["432Hz","純正律"] のように周波数と調律名が
 *   混在した配列で保存されているため、"Hz" を含む要素を frequencies、
 *   それ以外を tuning ラベルとして振り分ける。
 * ・back.serial（通し番号）はここでは付けない。STUB_TRACKS との結合後、
 *   その並び順から連番を振る（App.tsx 側）。
 */

import { useEffect, useState } from 'react';
import { getDocs } from 'firebase/firestore';
import type { Track } from '../screens/DiscoverScreen';
import { artistsCol, subscribeTracks } from './firebaseFirestore';
import { buyLabel } from '../constants/pricing';

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined;

type ArtistInfo = { name?: string; nameRoman?: string };

function splitTuning(tuning: unknown): { tuningLabel?: string; frequencies?: string[] } {
  if (!Array.isArray(tuning)) return {};
  const freqs: string[] = [];
  const labels: string[] = [];
  for (const v of tuning) {
    if (typeof v !== 'string' || !v.trim()) continue;
    if (/hz/i.test(v)) freqs.push(v);
    else labels.push(v);
  }
  return {
    tuningLabel: labels.length > 0 ? labels.join('・') : undefined,
    frequencies: freqs.length > 0 ? freqs : undefined,
  };
}

export function useTracks(count = 50): Track[] {
  const [artists, setArtists] = useState<Map<string, ArtistInfo>>(new Map());
  const [tracks, setTracks] = useState<Track[]>([]);

  // 作家名はほぼ変わらないので、購読ではなく起動時に1回だけ取得する
  useEffect(() => {
    getDocs(artistsCol())
      .then((snap) => {
        const map = new Map<string, ArtistInfo>();
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          map.set(d.id, { name: str(data.name), nameRoman: str(data.nameRoman) });
        });
        setArtists(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = subscribeTracks(
      count,
      (docs) => {
        setTracks(
          docs.map((d) => {
            const data = d as Record<string, unknown>;
            const { tuningLabel, frequencies } = splitTuning(data.tuning);
            const artistId = str(data.artistId);
            const artist = artistId ? artists.get(artistId) : undefined;
            const price = typeof data.price === 'number' ? data.price : undefined;
            const track: Track = {
              id: d.id,
              title: str(data.title) ?? '',
              subtitle: str(data.scene),
              artistName: artist?.name ?? '',
              artistId,
              artworkUrl: str(data.artworkUrl) ?? '',
              audioKey: d.id,
              previewUrl: str(data.r2_preview_url) ?? null,
              priceLabel: buyLabel(price),
              glowColor: str(data.glow),
              glowColor2: str(data.glow2),
              back: {
                story: str(data.story),
                tuning: tuningLabel,
                frequencies,
                artist: artist?.nameRoman?.toUpperCase(),
              },
            };
            return track;
          }),
        );
      },
      () => setTracks([]),
    );
    return unsub;
    // artists が後から届いても、次の tracks 更新まで待たず反映されるよう依存に含める
  }, [count, artists]);

  return tracks;
}
