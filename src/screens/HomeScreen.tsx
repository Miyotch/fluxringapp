import React, { useState, useCallback } from 'react';
import { GradientBackground } from '../components/ui/GradientBackground';
import { TrackList } from '../components/track/TrackList';
import { FluxRingDial } from '../components/ring/FluxRingDial';
import { useAudioPlayer } from '../components/player/useAudioPlayer';
import { useTracks } from '../hooks/useTracks';
import type { Track } from '../types/track';

export function HomeScreen() {
  const { tracks } = useTracks();
  const { currentTrack, playTrack, togglePlayPause } = useAudioPlayer();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [amplitude, setAmplitude] = useState(1.0);

  const handlePlayTrack = useCallback(
    (track: Track) => {
      if (currentTrack?.id === track.id) {
        togglePlayPause();
      } else {
        playTrack(track);
      }
    },
    [currentTrack, playTrack, togglePlayPause],
  );

  const handleToggleFavorite = useCallback((track: Track) => {
    setFavorites((prev) =>
      prev.includes(track.id)
        ? prev.filter((id) => id !== track.id)
        : [...prev, track.id],
    );
  }, []);

  return (
    <GradientBackground>
      <div style={containerStyle}>
        <div style={trackListStyle}>
          <TrackList
            tracks={tracks}
            currentTrackId={currentTrack?.id ?? null}
            favorites={favorites}
            onPlayTrack={handlePlayTrack}
            onPreviewTrack={handlePlayTrack}
            onAddTrack={() => {}}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>
        <div style={dialContainerStyle}>
          <FluxRingDial
            size={Math.min(500, window.innerHeight - 120)}
            amplitude={amplitude}
            onAmplitudeChange={setAmplitude}
          />
        </div>
      </div>
    </GradientBackground>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  height: '100vh',
};

const trackListStyle: React.CSSProperties = {
  flex: '0 0 40%',
  borderRight: '1px solid rgba(200, 190, 220, 0.2)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const dialContainerStyle: React.CSSProperties = {
  flex: '0 0 60%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
