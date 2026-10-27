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

import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDocs } from 'firebase/firestore';
import type { Track } from '../screens/DiscoverScreen';
import { artistsCol, subscribeTracks } from './firebaseFirestore';
import { buyLabel } from '../constants/pricing';
import { registerTrackAudio } from './durations';
import { registerPaidTracks } from '../constants/iapProducts';

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
// 端末に覚えた写し（JSON）では Timestamp が {seconds, nanoseconds} の素のオブジェクトになっている
const toMillis = (v: unknown): number | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as { toMillis?: unknown; seconds?: unknown; nanoseconds?: unknown };
  if (typeof o.toMillis === 'function') return (o.toMillis as () => number)();
  if (typeof o.seconds === 'number') {
    return o.seconds * 1000 + (typeof o.nanoseconds === 'number' ? Math.floor(o.nanoseconds / 1e6) : 0);
  }
  return null;
};

function parseSale(v: unknown): Track['sale'] {
  if (!v || typeof v !== 'object') return undefined;
  const obj = v as Record<string, unknown>;
  return {
    type: obj.type === 'limited' ? 'limited' : 'always',
    startAt: toMillis(obj.startAt),
    endAt: toMillis(obj.endAt),
  };
}

type RawTrackDoc = { id: string } & Record<string, unknown>;

/**
 * オフライン起動のための写し（2026-10-18）。
 * Firestore JS SDK は React Native では端末に何も残さない（メモリだけ）ので、電波なしで
 * 起動すると曲の一覧が空になり、所有曲も再生画面も出なかった。最後に通信で届いた
 * tracks と作家名を AsyncStorage に覚えておき、届くまではそれで画面を組む。
 * 所有権・音源の配信可否には使わない（表示専用。所有は lib/ownership.ts、音源は Worker）。
 */
const TRACKS_CACHE_KEY = 'fr.tracks.v1';
const ARTISTS_CACHE_KEY = 'fr.artists.v1';

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
const writeCache = (key: string, value: unknown) => {
  try {
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  } catch {
    /* 写しが残らなくても、通信できる限り動作は変わらない */
  }
};

function toTrack(d: RawTrackDoc, artists: Map<string, ArtistInfo>): Track {
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
  return {
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
      // 作家名は artists.name を表記どおりに出す（欧文の大文字表記 nameRoman は使わない）
      artist: artist?.name,
      useCases: parseUseCases(data.useCases),
    },
  };
}

export function useTracks(count = 50): Track[] {
  const [artists, setArtists] = useState<Map<string, ArtistInfo>>(new Map());
  const [docs, setDocs] = useState<RawTrackDoc[]>([]);

  // 作家名はほぼ変わらないので、購読ではなく起動時に1回だけ取得する。
  // 通信できなければ前回の写しのまま
  useEffect(() => {
    let fresh = false;
    readCache<Record<string, ArtistInfo>>(ARTISTS_CACHE_KEY).then((cached) => {
      if (!fresh && cached) setArtists(new Map(Object.entries(cached)));
    });
    getDocs(artistsCol())
      .then((snap) => {
        if (snap.metadata.fromCache) return;
        const map = new Map<string, ArtistInfo>();
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          map.set(d.id, { name: str(data.name), nameRoman: str(data.nameRoman) });
        });
        fresh = true;
        setArtists(map);
        writeCache(ARTISTS_CACHE_KEY, Object.fromEntries(map));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let fresh = false;
    readCache<RawTrackDoc[]>(TRACKS_CACHE_KEY).then((cached) => {
      if (!fresh && Array.isArray(cached)) setDocs(cached);
    });
    const unsub = subscribeTracks(
      count,
      (next, fromCache) => {
        // 通信できずに手元から返ってきたもの（オフライン起動では空）は、写しより信用しない
        if (fromCache) {
          if (!fresh && next.length === 0) return;
        } else {
          fresh = true;
          writeCache(TRACKS_CACHE_KEY, next);
        }
        setDocs(next);
      },
      // 権限エラー・通信エラーでも、写しで出しているものは消さない
      () => {},
    );
    return unsub;
  }, [count]);

  // ストアで売る曲 = 価格が 0 より大きい曲（商品IDは com.fluxring.app.track.<id>）。
  // 曲の長さ（プレイリストの行・合計時間）も、ここで音源ごとに登録する
  useEffect(() => {
    registerPaidTracks(
      docs.filter((d) => typeof d.price === 'number' && (d.price as number) > 0).map((d) => d.id),
    );
    // 管理画面の値があればそれ、無ければ音源のヘッダから割り出す（lib/durations.ts）
    for (const d of docs) {
      registerTrackAudio(
        d.id,
        str(d.r2_url),
        typeof d.durationSec === 'number' ? d.durationSec : undefined,
      );
    }
  }, [docs]);

  // artists が後から届いても、次の tracks 更新まで待たず反映される
  return useMemo(() => docs.map((d) => toTrack(d, artists)), [docs, artists]);
}
