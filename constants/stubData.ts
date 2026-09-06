// FLUX RING — スタブデータ（実装時に Firebase / API フェッチへ差し替え）
// 画面確認用。CLAUDE.md / DESIGN.md の世界観に合わせた仮データ。
//
// 楽曲一覧（旧 STUB_TRACKS）・所有スタブ（旧 STUB_OWNED）・作家紹介
// （旧 STUB_ARTISTS / STUB_ARTIST_TRACKS）は、画面に表示する楽曲・カード・
// 作家情報をすべて Firestore（tracks / artists コレクション）から取得する
// ようにしたため廃止した（lib/useTracks.ts / lib/useArtists.ts 参照）。

import type { Notice } from '../screens/NotificationsScreen';
import type { StoryData } from '../screens/StoryScreen';
import type { VipCard } from '../screens/VipScreen';

// 同梱アート（v98_FIX ハンドオフ実ファイル）。picsum のダミーは廃止。
// 未FIX画面のプレースホルダにのみ img() を残す。
const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/900`;

export const STUB_NOTICES: Notice[] = [
  { id: 'n1', title: '今月の一曲を更新しました', date: '2026.06.20', unread: true, body: '新しい一曲が届きました。' },
  { id: 'n2', title: '夜明けのための新しい作品が加わりました', date: '2026.06.14', unread: true },
  { id: 'n3', title: 'メンテナンスのお知らせ', date: '2026.06.07', unread: false },
  { id: 'n4', title: 'はじめまして。FLUX RING です', date: '2026.06.01', unread: false },
];

export const STUB_STORY: StoryData = {
  trackId: 't1',
  artworkUrl: img('fuyuake'),
  title: '冬明け',
  story: '夜明け前、まだ青い部屋に最初の光がにじむ。眠りと覚醒のあわいで、音はまだ言葉になる前の輪郭を持っている。',
  materials: ['432Hz', '純正律', '1/f'],
  artistId: 'a1',
  artistName: '岡 ナオキ',
  glowColor: 'rgba(96,206,224,0.40)',
};

export const STUB_VIP_CARDS: VipCard[] = [
  {
    id: 'v1',
    title: '冬明け',
    artworkUrl: img('fuyuake'),
    hasPhysical: true,
    serial: 'FR-0001',
    edition: '1 OF 1',
    acquiredAt: '2026.06.21',
    signature: 'Naoki Oka',
    glowColor: 'rgba(96,206,224,0.40)',
  },
];
