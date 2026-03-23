import { useState } from 'react';
import type { Track } from '../types/track';

const SAMPLE_TRACKS: Track[] = [
  {
    id: '1',
    title: '静かな子守唄',
    artist: 'Flux Ring',
    duration: 323,
    artworkUrl: '',
    audioUrl: '',
    description:
      '穏やかなメロディが低周波ノイズ（交通音など）を包み込み、集中状態へ導きます。',
    createdAt: new Date(),
    order: 1,
  },
  {
    id: '2',
    title: '春の庭園',
    artist: 'Flux Ring',
    duration: 203,
    artworkUrl: '',
    audioUrl: '',
    description:
      '優しいピアノと自然音が、近くの会話ノイズを穏やかな音色に置き換えます。',
    createdAt: new Date(),
    order: 2,
  },
  {
    id: '3',
    title: '山の風',
    artist: 'Flux Ring',
    duration: 262,
    artworkUrl: '',
    audioUrl: '',
    description:
      '爽やかな透明感が耳障りな高音ノイズ（キーボード音）をかき消し、思考をクリアにします。',
    createdAt: new Date(),
    order: 3,
  },
  {
    id: '4',
    title: '木漏れ日',
    artist: 'Flux Ring',
    duration: 383,
    artworkUrl: '',
    audioUrl: '',
    description:
      '暖かな音の層が突発的な騒音（ドアの開閉など）を和らげ、安心感のある空間を作ります。',
    createdAt: new Date(),
    order: 4,
  },
  {
    id: '5',
    title: '夜明けの星',
    artist: 'Flux Ring',
    duration: 220,
    artworkUrl: '',
    audioUrl: '',
    description:
      'ミニマルな静謐さが、静かな場所での小さな物音の意識を遠ざけ、集中を維持します。',
    createdAt: new Date(),
    order: 5,
  },
];

export function useTracks() {
  const [tracks] = useState<Track[]>(SAMPLE_TRACKS);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  return { tracks, loading, error };
}
