/**
 * useTracks.ts — Firestore の tracks コレクションを新着順で購読
 * ------------------------------------------------------------------
 * 画面に表示する楽曲・カードはすべてこの tracks コレクションを参照する
 * （同梱の STUB_TRACKS は使わない）。DiscoverScreen の Track 型へ、
 * Firestore 側のフィールド名（title/scene/artworkUrl/artistId/glow/glow2/
 * story/tuning/price/r2_preview_url/sale/homeOrderMode/homeOrder）を
 * 変換して渡す。
 *
 * ・homeOrderMode/homeOrder はホームの表示順（App.tsx の orderHomeTracks
 *   呼び出しで使う）。未設定はそれぞれ 'fixed'/0 扱い。
 * ・audioKey / id は Firestore のドキュメントID をそのまま使う
 *   （所有権 users/{uid}/purchases/{trackId} と lib/r2.ts の
 *   tracks/{audioKey}.r2_url 解決が同じ文字列を前提にしているため、
 *   ドキュメント内の audioKey フィールドは使わない）。
 * ・tuning フィールドは ["432Hz","純正律"] のように周波数と調律名が
 *   混在した配列で保存されているため、"Hz" を含む要素を frequencies、
 *   それ以外を tuning ラベルとして振り分ける。
 * ・back.serial（通し番号）は管理画面のシリアルナンバー（tracks/{id}.serial）を
 *   「No. 017」の形にして渡す。管理画面が登録順の全曲通し番号（3桁）を自動で振る
 *   （2026-10-01〜）。空の曲だけ、App.tsx 側で取得した並び順から連番を振る。
 */

import { useEffect, useState } from 'react';
import { getDocs } from 'firebase/firestore';
import type { Track } from '../screens/DiscoverScreen';
import { artistsCol, subscribeTracks } from './firebaseFirestore';
import { buyLabel } from '../constants/pricing';

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined;

// 用途タグ（tracks/{id}.useCases）。ラベル文字列の配列で保存されている
// （マスタの use_case コレクションと同じ表記）。想定外の型は落とす。
function parseUseCases(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const tags = v.map(str).filter((s): s is string => !!s);
  return tags.length > 0 ? tags : undefined;
}

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

// Firestore Timestamp（.toMillis() を持つ）をエポックミリ秒へ。それ以外は null（無期限扱い）
const toMillis = (v: unknown): number | null =>
  v && typeof v === 'object' && typeof (v as { toMillis?: unknown }).toMillis === 'function'
    ? (v as { toMillis: () => number }).toMillis()
    : null;

function parseSale(v: unknown): Track['sale'] {
  if (!v || typeof v !== 'object') return undefined;
  const obj = v as Record<string, unknown>;
  return {
    type: obj.type === 'limited' ? 'limited' : 'always',
    startAt: toMillis(obj.startAt),
    endAt: toMillis(obj.endAt),
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
            const serial = str(data.serial)?.trim();
            const homeOrderMode: Track['homeOrderMode'] =
              data.homeOrderMode === 'random' ? 'random' : 'fixed';
            const homeOrder =
              typeof data.homeOrder === 'number' && Number.isFinite(data.homeOrder)
                ? data.homeOrder
                : 0;
            const track: Track = {
              id: d.id,
              title: str(data.title) ?? '',
              subtitle: str(data.scene),
              artistName: artist?.name ?? '',
              artistId,
              // 縮小版（管理画面がアップロード時に作る長辺 1536px の JPEG）を優先する。
              // 元の絵は 1 枚 3MB 級の PNG で、4G ではカードの絵が大きく遅れていた（2026-09-30）
              artworkUrl: str(data.artworkThumbUrl) ?? str(data.artworkUrl) ?? '',
              artworkFullUrl: str(data.artworkUrl),
              seriesId: str(data.seriesId),
              audioKey: d.id,
              previewUrl: str(data.r2_preview_url) ?? null,
              priceLabel: buyLabel(price),
              priceJpy: price,
              glowColor: str(data.glow),
              glowColor2: str(data.glow2),
              sale: parseSale(data.sale),
              homeOrderMode,
              homeOrder,
              // 管理画面の「アプリのホームに出す」。false のときだけ出さない（未設定の既存曲は出す）
              homeVisible: data.homeVisible !== false,
              back: {
                serial: serial ? `No. ${serial}` : undefined,
                story: str(data.story),
                tuning: tuningLabel,
                frequencies,
                artist: artist?.nameRoman?.toUpperCase(),
                useCases: parseUseCases(data.useCases),
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
