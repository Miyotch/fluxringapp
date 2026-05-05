import { useState, useEffect } from 'react';
import { onTracksSnapshot } from '../services/firestore';
import type { Track } from '../types/track';
import type { SearchFilters } from '../types/searchFilters';

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
    paidMusic: false, frequencyMode: false, melodyMode: false,
    earphoneOptimized: true, speakerOptimized: true,
    noiseLevel: 50, toneCharacter: 50, rhythmIntensity: 50,
    justIntonation: false, equalTemperament: true,
    rootFrequency: '440', brainwaveEntrainment: 'OFF', pinkNoiseFluctuation: false,
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
    paidMusic: false, frequencyMode: false, melodyMode: false,
    earphoneOptimized: true, speakerOptimized: true,
    noiseLevel: 50, toneCharacter: 50, rhythmIntensity: 50,
    justIntonation: false, equalTemperament: true,
    rootFrequency: '440', brainwaveEntrainment: 'OFF', pinkNoiseFluctuation: false,
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
    paidMusic: false, frequencyMode: false, melodyMode: false,
    earphoneOptimized: true, speakerOptimized: true,
    noiseLevel: 50, toneCharacter: 50, rhythmIntensity: 50,
    justIntonation: false, equalTemperament: true,
    rootFrequency: '440', brainwaveEntrainment: 'OFF', pinkNoiseFluctuation: false,
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
    paidMusic: false, frequencyMode: false, melodyMode: false,
    earphoneOptimized: true, speakerOptimized: true,
    noiseLevel: 50, toneCharacter: 50, rhythmIntensity: 50,
    justIntonation: false, equalTemperament: true,
    rootFrequency: '440', brainwaveEntrainment: 'OFF', pinkNoiseFluctuation: false,
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
    paidMusic: false, frequencyMode: false, melodyMode: false,
    earphoneOptimized: true, speakerOptimized: true,
    noiseLevel: 50, toneCharacter: 50, rhythmIntensity: 50,
    justIntonation: false, equalTemperament: true,
    rootFrequency: '440', brainwaveEntrainment: 'OFF', pinkNoiseFluctuation: false,
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

/**
 * Pure helper: filter a list of tracks by an arbitrary `SearchFilters` object.
 *
 * Mirrors the legacy filter logic in
 * `.reference/web/src/screens/HomeScreen.tsx` (the `displayTracks` memo) but
 * adapted to the new `SearchFilters` shape, where slider values are `[min,max]`
 * ranges and tri-state booleans (`null`) mean "any".
 */
export function filterTracks(tracks: Track[], filters: SearchFilters): Track[] {
  const keyword = filters.keyword.trim().toLowerCase();
  // Quick-tags become substring matches on title / description
  // (the legacy app stored them inline in `query`; we keep them separate).
  const tagNeedles = filters.tags.map((t) => t.replace(/^#/, '').toLowerCase());

  const inRange = (value: number, range: [number, number]): boolean => {
    const [min, max] = range;
    // Full-span = effectively no filter — accept everything.
    if (min <= 0 && max >= 100) return true;
    return value >= min && value <= max;
  };

  return tracks.filter((t) => {
    // Mode toggles — if the filter is true, require the track to have it.
    if (filters.frequencyMode && !t.frequencyMode) return false;
    if (filters.melodyMode && !t.melodyMode) return false;

    // Environment — if the filter is true, require the track to be optimised for it.
    if (filters.earphoneOptimized && !t.earphoneOptimized) return false;
    if (filters.speakerOptimized && !t.speakerOptimized) return false;

    // Paid music tri-state.
    if (filters.paidMusic !== null && t.paidMusic !== filters.paidMusic) {
      return false;
    }

    // Keyword search across the human-readable text fields.
    if (keyword) {
      const haystack = [
        t.title,
        t.artist,
        t.description,
        t.rootFrequency,
        t.brainwaveEntrainment,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }

    // Tag search — every requested tag must appear somewhere in title/description.
    if (tagNeedles.length > 0) {
      const haystack = `${t.title} ${t.description}`.toLowerCase();
      const allMatch = tagNeedles.every((needle) => haystack.includes(needle));
      if (!allMatch) return false;
    }

    // Slider ranges.
    if (!inRange(t.noiseLevel, filters.noiseLevel)) return false;
    if (!inRange(t.toneCharacter, filters.toneCharacter)) return false;
    if (!inRange(t.rhythmIntensity, filters.rhythmIntensity)) return false;

    // Advanced protocol tri-states.
    if (
      filters.justIntonation !== null &&
      t.justIntonation !== filters.justIntonation
    ) {
      return false;
    }
    if (
      filters.equalTemperament !== null &&
      t.equalTemperament !== filters.equalTemperament
    ) {
      return false;
    }
    if (
      filters.rootFrequency !== null &&
      t.rootFrequency !== filters.rootFrequency
    ) {
      return false;
    }
    if (
      filters.brainwaveEntrainment !== null &&
      t.brainwaveEntrainment !== filters.brainwaveEntrainment
    ) {
      return false;
    }
    if (
      filters.pinkNoiseFluctuation !== null &&
      t.pinkNoiseFluctuation !== filters.pinkNoiseFluctuation
    ) {
      return false;
    }

    return true;
  });
}
