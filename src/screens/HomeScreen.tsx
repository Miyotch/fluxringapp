import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GradientBackground } from '../components/ui/GradientBackground';
import { TrackList } from '../components/track/TrackList';
import { FluxRingDial } from '../components/ring/FluxRingDial';
import { NowPlaying } from '../components/player/NowPlaying';
import { SearchModal } from '../components/search/SearchModal';
import { useAudioPlayer } from '../components/player/useAudioPlayer';
import { useTracks } from '../hooks/useTracks';
import type { Track } from '../types/track';

interface HomeScreenProps {
  searchOpen?: boolean;
}

export function HomeScreen({ searchOpen = false }: HomeScreenProps) {
  const { tracks, loading, error } = useTracks();
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    analyserNode,
    repeat,
    playTrack,
    togglePlayPause,
    seekTo,
    toggleRepeat,
  } = useAudioPlayer();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [amplitude, setAmplitude] = useState(1.0);
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const navigate = useNavigate();

  // Row click / play button: play the full track and open NowPlaying
  const handlePlayTrack = useCallback(
    (track: Track) => {
      if (currentTrack?.id === track.id) {
        setShowNowPlaying(true);
      } else {
        playTrack(track);
        setShowNowPlaying(true);
      }
    },
    [currentTrack, playTrack],
  );

  // Preview button: play the preview audio (no NowPlaying)
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

  const dialSize = Math.min(600, window.innerHeight - 80);

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

      {/* Search modal overlay — right half */}
      <SearchModal visible={searchOpen} onClose={() => navigate('/')} />

      {/* Full-screen NowPlaying overlay */}
      {showNowPlaying && currentTrack && (
        <NowPlaying
          track={currentTrack}
          isPlaying={isPlaying}
          position={position}
          duration={duration}
          repeat={repeat}
          onTogglePlay={togglePlayPause}
          onToggleRepeat={toggleRepeat}
          onSeek={seekTo}
          onClose={() => setShowNowPlaying(false)}
        />
      )}
    </GradientBackground>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  height: '100%',
};

const trackListStyle: React.CSSProperties = {
  flex: '1 1 50%',
  minWidth: 0,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const dialContainerStyle: React.CSSProperties = {
  flex: '1 1 50%',
  minWidth: 0,
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
