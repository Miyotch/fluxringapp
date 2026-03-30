import { useState, useEffect } from 'react';
import { onTracksSnapshot } from '../services/firestore';
import type { Track } from '../types/track';

const SAMPLE_TRACKS: Track[] = [
  {
    id: '1',
    title: '静かな子守唄',
    artist: 'Flux Ring',
    duration: 323,
    artworkUrl: '',
    audioUrl: '',
    previewUrl: '',
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
    previewUrl: '',
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
    previewUrl: '',
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
    previewUrl: '',
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
    previewUrl: '',
    description:
      'ミニマルな静謐さが、静かな場所での小さな物音の意識を遠ざけ、集中を維持します。',
    createdAt: new Date(),
    order: 5,
  },
];

export function useTracks() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onTracksSnapshot(
      (data) => {
        setTracks(data.length > 0 ? data : SAMPLE_TRACKS);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn('Firestore unavailable, using sample tracks:', err.message);
        setTracks(SAMPLE_TRACKS);
        setLoading(false);
        setError(null);
      },
    );

    return unsubscribe;
  }, []);

  return { tracks, loading, error };
}
