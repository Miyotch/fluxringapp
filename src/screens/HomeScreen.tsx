import React, { useState, useCallback } from 'react';
import { GradientBackground } from '../components/ui/GradientBackground';
import { TrackList } from '../components/track/TrackList';
import { FluxRingDial } from '../components/ring/FluxRingDial';
import { useAudioPlayer } from '../components/player/useAudioPlayer';
import { useTracks } from '../hooks/useTracks';
import type { Track } from '../types/track';

export function HomeScreen() {
  const { tracks, loading, error } = useTracks();
  const { currentTrack, isPlaying, analyserNode, playTrack, togglePlayPause } = useAudioPlayer();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [amplitude, setAmplitude] = useState(1.0);

  // Row click / play button: play the full track (sound field)
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

  // Preview button: play the preview audio (preview field)
  const handlePreviewTrack = useCallback(
    (track: Track) => {
      const url = track.previewUrl || track.audioUrl;
      playTrack(track, url);
    },
    [playTrack],
  );

  const handleToggleFavorite = useCallback((track: Track) => {
    setFavorites((prev) =>
      prev.includes(track.id)
        ? prev.filter((id) => id !== track.id)
        : [...prev, track.id],
    );
  }, []);

  const dialSize = Math.min(500, window.innerHeight - 120);

  return (
    <GradientBackground>
      <div style={containerStyle}>
        <div style={trackListStyle}>
          {loading && (
            <div style={{ padding: 24, color: 'rgba(160, 145, 195, 0.6)', textAlign: 'center' }}>
              読み込み中...
            </div>
          )}
          {error && (
            <div style={{ padding: 24, color: 'rgba(220, 120, 120, 0.8)', textAlign: 'center' }}>
              {error}
            </div>
          )}
          <TrackList
            tracks={tracks}
            currentTrackId={currentTrack?.id ?? null}
            isPlaying={isPlaying}
            analyserNode={analyserNode}
            favorites={favorites}
            onPlayTrack={handlePlayTrack}
            onPreviewTrack={handlePreviewTrack}
            onAddTrack={() => {}}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>
        <div style={dialContainerStyle}>
          <FluxRingDial
            size={dialSize}
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
  height: '100%',
};

const trackListStyle: React.CSSProperties = {
  flex: '0 0 40%',
  borderRight: 'none',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const dialContainerStyle: React.CSSProperties = {
  flex: '0 0 60%',
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
