import React, { useState, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { GradientBackground } from '../components/ui/GradientBackground';
import { TrackList } from '../components/track/TrackList';
import { FluxRingDial } from '../components/ring/FluxRingDial';
import { useAudioPlayer } from '../components/player/useAudioPlayer';
import { useTracks } from '../hooks/useTracks';
import type { Track } from '../types/track';

export function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const { tracks } = useTracks();
  const { currentTrack, playTrack, togglePlayPause } = useAudioPlayer();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [amplitude, setAmplitude] = useState(1.0);

  const ringSize = Math.min(height - 120, width * 0.5);

  const handlePlayTrack = useCallback(
    (track: Track) => {
      if (currentTrack?.id === track.id) {
        togglePlayPause();
      } else {
        playTrack(track);
      }
    },
    [currentTrack, playTrack, togglePlayPause]
  );

  const handleToggleFavorite = useCallback((track: Track) => {
    setFavorites((prev) =>
      prev.includes(track.id)
        ? prev.filter((id) => id !== track.id)
        : [...prev, track.id]
    );
  }, []);

  return (
    <GradientBackground>
      <View style={styles.container}>
        {/* Left: Track list */}
        <View style={styles.trackListContainer}>
          <TrackList
            tracks={tracks}
            currentTrackId={currentTrack?.id ?? null}
            favorites={favorites}
            onPlayTrack={handlePlayTrack}
            onPreviewTrack={handlePlayTrack}
            onAddTrack={() => {}}
            onToggleFavorite={handleToggleFavorite}
          />
        </View>

        {/* Right: Flux Ring Dial */}
        <View style={styles.dialContainer}>
          <FluxRingDial
            size={ringSize}
            amplitude={amplitude}
            onAmplitudeChange={setAmplitude}
          />
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  trackListContainer: {
    flex: 0.4,
    borderRightWidth: 1,
    borderRightColor: 'rgba(200, 190, 220, 0.2)',
  },
  dialContainer: {
    flex: 0.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
