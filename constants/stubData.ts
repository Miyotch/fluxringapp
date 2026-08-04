// FLUX RING — スタブデータ（実装時に Firebase / API フェッチへ差し替え）
// 画面確認用。CLAUDE.md / DESIGN.md の世界観に合わせた仮データ。

import type { Track } from '../screens/DiscoverScreen';
import type { CollectionItem } from '../screens/CollectionScreen';
import type { Notice } from '../screens/NotificationsScreen';
import type { Artist, ArtistTrack } from '../screens/ArtistScreen';
import type { StoryData } from '../screens/StoryScreen';
import type { VipCard } from '../screens/VipScreen';
import { artUri } from './artwork';
import { buyLabel } from './pricing';

// 同梱アート（v98_FIX ハンドオフ実ファイル）。picsum のダミーは廃止。
// 作家一覧など未FIX画面のプレースホルダにのみ img() を残す。
const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/900`;

// 作品カード（v98_FIX ハンドオフ data/cards.json の実データ・全5作品）。
// タイトル/情景/story/原材料/調律/周波数/オーラ色は原本の値をそのまま使用。
// アートは assets/art/ の実ファイル（683×1024・2:3）。
export const STUB_TRACKS: Track[] = [
  {
    id: 'blue', title: '冬明け', subtitle: '夜明け前の青',
    artistName: '岡ナオキ', artworkUrl: artUri('blue'), audioKey: 'blue',
    previewUrl: null, priceLabel: buyLabel(),
    glowColor: 'rgba(96,206,224,.42)', glowColor2: 'rgba(70,132,224,.16)',
    back: {
      serial: 'No. 001',
      story: '夜明け前、まだ青い部屋に最初の光がにじむ。音は何も足さず、ただ部屋の温度をわずかに上げていく。',
      materials: ['朝の空気', '低い持続音', '遠い反響', '青の残光', '静けさ'],
      tuning: '純正律',
      frequencies: ['432 Hz', '7.83 Hz'],
      artist: 'NAOKI OKA',
    },
  },
  {
    id: 'white', title: '薄明', subtitle: '色の決まらない時間',
    artistName: '岡ナオキ', artworkUrl: artUri('white'), audioKey: 'white',
    previewUrl: null, priceLabel: buyLabel(),
    glowColor: 'rgba(180,200,230,.4)', glowColor2: 'rgba(150,170,210,.16)',
    back: {
      serial: 'No. 002',
      story: '夜と朝のあいだ、まだ色が決まらない時間。輪郭がほどけ、呼吸がゆっくりと深くなる。',
      materials: ['薄明', '白の階調', '緩やかな上昇', '余白', '無音の間'],
      tuning: '平均律',
      frequencies: ['440 Hz', '7.83 Hz'],
      artist: 'NAOKI OKA',
    },
  },
  {
    id: 'mesh', title: '白鉛筆 I（仮）', subtitle: '骨子のねじれ',
    artistName: '岡ナオキ', artworkUrl: artUri('mesh'), audioKey: 'mesh',
    previewUrl: null, priceLabel: buyLabel(),
    glowColor: 'rgba(232,226,210,.40)', glowColor2: 'rgba(180,174,158,.16)',
    back: {
      serial: 'No. 003',
      story: '鉛筆の輪郭だけが、白い格子でねじれながら立っている。芯はなく、かたちの記憶だけが残っている。',
      materials: ['白い格子', 'ねじれ', '六角の名残', '無地の余白', '逆さの尖端'],
      tuning: '純正律',
      frequencies: ['432 Hz', '7.83 Hz'],
      artist: 'NAOKI OKA',
    },
  },
  {
    id: 'kite', title: '白鉛筆 II（仮）', subtitle: '細密な網',
    artistName: '岡ナオキ', artworkUrl: artUri('kite'), audioKey: 'kite',
    previewUrl: null, priceLabel: buyLabel(),
    glowColor: 'rgba(214,218,226,.40)', glowColor2: 'rgba(160,164,176,.16)',
    back: {
      serial: 'No. 004',
      story: '先端で立つ菱形の網。細い線が重なるほど、内側の空洞は静かになっていく。',
      materials: ['細線の網', '菱形', '点で立つ', '白', '空洞'],
      tuning: '平均律',
      frequencies: ['440 Hz', '7.83 Hz'],
      artist: 'NAOKI OKA',
    },
  },
  {
    id: 'bloom', title: '白鉛筆 III（仮）', subtitle: '花の格子',
    artistName: '岡ナオキ', artworkUrl: artUri('bloom'), audioKey: 'bloom',
    previewUrl: null, priceLabel: buyLabel(),
    glowColor: 'rgba(196,210,228,.40)', glowColor2: 'rgba(146,160,186,.16)',
    back: {
      serial: 'No. 005',
      story: '円が重なって花になり、花が連なって鉛筆のかたちを覆う。規則だけで編まれた、白い静けさ。',
      materials: ['重なる円', '花の格子', '白い骨組', '淡い青の余白', '細い影'],
      tuning: '純正律',
      frequencies: ['528 Hz', '7.83 Hz'],
      artist: 'NAOKI OKA',
    },
  },
];

// audioKey は R2 の音源キー（preview/{key}.mp3 / full/{key}.mp3）。
// モックの音源は blue/white/red の3つ想定なので所有曲もこれに揃える。
export const STUB_OWNED: CollectionItem[] = [
  { id: 'blue', title: '冬明け', artworkUrl: artUri('blue'), owned: true, audioKey: 'blue', glowColor: 'rgba(96,206,224,.42)', glowColor2: 'rgba(70,132,224,.16)' },
  { id: 'white', title: '薄明', artworkUrl: artUri('white'), owned: true, audioKey: 'white', glowColor: 'rgba(180,200,230,.4)', glowColor2: 'rgba(150,170,210,.16)' },
  { id: 'mesh', title: '白鉛筆 I（仮）', artworkUrl: artUri('mesh'), owned: true, audioKey: 'mesh', glowColor: 'rgba(232,226,210,.40)', glowColor2: 'rgba(180,174,158,.16)' },
];

export const STUB_WISHLIST: CollectionItem[] = [
  { id: 'kite', title: '白鉛筆 II（仮）', artworkUrl: artUri('kite'), owned: false, priceLabel: buyLabel(), glowColor: 'rgba(214,218,226,.40)', glowColor2: 'rgba(160,164,176,.16)' },
  { id: 'bloom', title: '白鉛筆 III（仮）', artworkUrl: artUri('bloom'), owned: false, priceLabel: buyLabel(), glowColor: 'rgba(196,210,228,.40)', glowColor2: 'rgba(146,160,186,.16)' },
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
