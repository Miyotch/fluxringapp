// FLUX RING — スタブデータ（実装時に Firebase / API フェッチへ差し替え）
// 画面確認用。CLAUDE.md / DESIGN.md の世界観に合わせた仮データ。

import type { Track } from '../screens/DiscoverScreen';
import type { CollectionItem } from '../screens/CollectionScreen';
import type { Notice } from '../screens/NotificationsScreen';
import type { Artist, ArtistTrack } from '../screens/ArtistScreen';
import type { StoryData } from '../screens/StoryScreen';
import type { VipCard } from '../screens/VipScreen';

const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/900`;

// 作品カードに差し込む3作品（ASSETS.md / component_catalog v50 準拠）。
// artworkSource に実 jpg（require('../assets/art_blue.jpg') 等）を差し替える。
// 現状はモック確認用のリモート画像で代替。
// オーラ色は component_catalog の「曲別オーラ」確定値:
//   冬明け blue  rgb(96,206,224) / 薄明 white rgb(179,199,235) / 遠い灯 red rgb(219,120,150)
export const STUB_TRACKS: Track[] = [
  {
    id: 't1', title: '冬明け', subtitle: '夜明け前、まだ青い部屋に最初の光がにじむ',
    artistName: '岡ナオキ', artworkUrl: img('fuyuake'), audioKey: 'blue', previewUrl: null, priceLabel: '¥2,500',
    glowColor: 'rgba(96,206,224,0.42)', glowColor2: 'rgba(70,132,224,0.16)',
    back: {
      serial: 'No. 001',
      story: '夜明け前、まだ青い部屋に最初の光がにじむ。音は何も足さず、ただ部屋の温度をわずかに上げていく。',
      materials: ['純正律'],
      frequencies: ['432 Hz', '7.83 Hz'],
      artist: 'NAOKI OKA',
    },
  },
  {
    id: 't2', title: '薄明', subtitle: '眠りと覚醒のあわい、輪郭の生まれる時間',
    artistName: '岡ナオキ', artworkUrl: img('hakumei'), audioKey: 'white', previewUrl: null, priceLabel: '¥2,500',
    glowColor: 'rgba(179,199,235,0.42)', glowColor2: 'rgba(120,150,220,0.16)',
    back: {
      serial: 'No. 002',
      story: '眠りと覚醒のあわい。輪郭がまだやわらかいうちに、音は静かに世界の縁をなぞる。',
      materials: ['平均律'],
      frequencies: ['440 Hz', '8.0 Hz'],
      artist: 'NAOKI OKA',
    },
  },
  {
    id: 't3', title: '遠い灯', subtitle: '暗がりの向こう、ひとつだけ灯る温度',
    artistName: '岡ナオキ', artworkUrl: img('toihi'), audioKey: 'red', previewUrl: null, priceLabel: '¥2,500',
    glowColor: 'rgba(219,120,150,0.42)', glowColor2: 'rgba(180,90,140,0.16)',
    back: {
      serial: 'No. 003',
      story: '暗がりの向こうに、ひとつだけ灯る温度。近づきすぎず、消えもせず、ただそこに在る。',
      materials: ['純正律'],
      frequencies: ['432 Hz', '6.0 Hz'],
      artist: 'NAOKI OKA',
    },
  },
];

// audioKey は R2 の音源キー（preview/{key}.mp3 / full/{key}.mp3）。
// モックの音源は blue/white/red の3つ想定なので所有曲もこれに揃える。
export const STUB_OWNED: CollectionItem[] = [
  { id: 't1', title: '冬明け', artworkUrl: img('fuyuake'), owned: true, audioKey: 'blue', glowColor: 'rgba(96,206,224,0.40)' },
  { id: 't2', title: '薄明', artworkUrl: img('hakumei'), owned: true, audioKey: 'white', glowColor: 'rgba(70,132,224,0.40)' },
  { id: 't3', title: '遠い灯', artworkUrl: img('toihi'), owned: true, audioKey: 'red', glowColor: 'rgba(219,120,150,0.40)' },
];

export const STUB_WISHLIST: CollectionItem[] = [
  { id: 'w1', title: '海鳴り', artworkUrl: img('uminari'), owned: false, priceLabel: '¥2,500', glowColor: 'rgba(70,132,224,0.40)' },
  { id: 'w2', title: '霧の朝', artworkUrl: img('kiri'), owned: false, priceLabel: '¥2,500', glowColor: 'rgba(96,206,224,0.40)' },
  { id: 'w3', title: '遠雷', artworkUrl: img('enrai'), owned: false, priceLabel: '¥2,500', glowColor: 'rgba(124,98,214,0.40)' },
];

export const STUB_NOTICES: Notice[] = [
  { id: 'n1', title: '今月の一曲を更新しました', date: '2026.06.20', unread: true, body: '新しい一曲が届きました。' },
  { id: 'n2', title: '夜明けのための新しい作品が加わりました', date: '2026.06.14', unread: true },
  { id: 'n3', title: 'メンテナンスのお知らせ', date: '2026.06.07', unread: false },
  { id: 'n4', title: 'はじめまして。FLUX RING です', date: '2026.06.01', unread: false },
];

export const STUB_ARTISTS: Artist[] = [
  {
    id: 'a1',
    name: '岡 ナオキ',
    nameEn: 'Naoki Oka',
    role: '作曲・音響',
    bio: '音そのものが持つ力を呼び起こすことを志す作曲家。\n\nその場にふさわしい音だけがある状態——静けさ——を、周波数の関係として彫刻する。倍音と1/fゆらぎに支えられた、生きた静けさのための作品を手がける。',
  },
];

export const STUB_ARTIST_TRACKS: Record<string, ArtistTrack[]> = {
  a1: [
    { id: 't1', title: '冬明け', artworkUrl: img('fuyuake'), owned: true, glowColor: 'rgba(96,206,224,0.40)' },
    { id: 't2', title: '星の生まれる夜', artworkUrl: img('hoshi'), owned: true, glowColor: 'rgba(124,98,214,0.40)' },
    { id: 't5', title: '（未所有の作品）', artworkUrl: img('silhouette'), owned: false },
  ],
};

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
