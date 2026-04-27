import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GradientBackground } from '../components/ui/GradientBackground';
import { TrackList } from '../components/track/TrackList';
import { FluxRingDial } from '../components/ring/FluxRingDial';
import { NowPlaying } from '../components/player/NowPlaying';
import { SearchModal } from '../components/search/SearchModal';
import { PlaylistPickerModal } from '../components/playlist/PlaylistPickerModal';
import { SubscriptionModal } from '../components/subscription/SubscriptionModal';
import { useAudioPlayer } from '../components/player/useAudioPlayer';
import { useTracks } from '../hooks/useTracks';
import { usePlaylists } from '../hooks/usePlaylists';
import { useUserPlan } from '../hooks/useUserPlan';
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
  const { playlists, toggleFavorite, addTrack } = usePlaylists();
  const { planId } = useUserPlan();
  const [amplitude, setAmplitude] = useState(1.0);
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null);
  const navigate = useNavigate();

  // Favorite IDs derived from the "favorites" playlist (live updates)
  const favoriteIds = playlists.find((p) => p.id === 'favorites')?.trackIds ?? [];

  // Lock paid tracks for free users
  const lockedTrackIds = useMemo(() => {
    if (planId !== 'free') return undefined;
    return new Set(tracks.filter((t) => t.paidMusic).map((t) => t.id));
  }, [tracks, planId]);

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

  // Heart button: toggle track in favorites playlist
  const handleToggleFavorite = useCallback(
    (track: Track) => {
      toggleFavorite(track.id);
    },
    [toggleFavorite],
  );

  // + button: open playlist picker modal
  const handleAddTrack = useCallback((track: Track) => {
    setPickerTrack(track);
  }, []);

  // When user picks a playlist in the modal
  const handlePickPlaylist = useCallback(
    (playlistId: string) => {
      if (pickerTrack) {
        addTrack(playlistId, pickerTrack.id);
      }
      setPickerTrack(null);
    },
    [pickerTrack, addTrack],
  );

  const [winSize, setWinSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setWinSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const dialSize = Math.min(600, winSize.w * 0.45, winSize.h - 80);

  return (
    <GradientBackground>
      {/* Aurora sweep bands — two staggered diagonal light streams */}
      <div className="aurora-sweep">
        <div className="aurora-band" />
        <div className="aurora-band aurora-band-b" />
      </div>

      {/* Soft blurred color orbs drifting in background */}
      <div
        className="aurora-orb"
        style={{
          width: 220, height: 140, top: '6%', left: '54%',
          background: 'rgba(200, 170, 255, 0.32)',
          ['--od' as any]: '22s', ['--odel' as any]: '0s',
        }}
      />
      <div
        className="aurora-orb"
        style={{
          width: 170, height: 110, top: '52%', left: '60%',
          background: 'rgba(160, 200, 255, 0.26)',
          ['--od' as any]: '18s', ['--odel' as any]: '-6s',
        }}
      />
      <div
        className="aurora-orb"
        style={{
          width: 130, height: 90, top: '72%', left: '46%',
          background: 'rgba(220, 180, 255, 0.28)',
          ['--od' as any]: '25s', ['--odel' as any]: '-12s',
        }}
      />
      <div
        className="aurora-orb"
        style={{
          width: 100, height: 70, top: '16%', left: '80%',
          background: 'rgba(180, 220, 200, 0.22)',
          ['--od' as any]: '20s', ['--odel' as any]: '-4s',
        }}
      />

      <div className="home-container" style={containerStyle}>
        <div className="home-tracklist" style={trackListStyle}>
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
            favorites={favoriteIds}
            lockedTrackIds={lockedTrackIds}
            onPlayTrack={handlePlayTrack}
            onPreviewTrack={handlePreviewTrack}
            onAddTrack={handleAddTrack}
            onToggleFavorite={handleToggleFavorite}
            onLockTap={() => setShowSubscription(true)}
          />
        </div>
        <div className="home-dial" style={dialContainerStyle}>
          <FluxRingDial
            size={dialSize}
            amplitude={amplitude}
            onAmplitudeChange={setAmplitude}
          />
        </div>
      </div>

      {/* Search modal overlay */}
      <SearchModal visible={searchOpen} onClose={() => navigate('/')} />

      {/* Playlist picker modal (opens from + button) */}
      {pickerTrack && (
        <PlaylistPickerModal
          track={pickerTrack}
          playlists={playlists}
          onPick={handlePickPlaylist}
          onClose={() => setPickerTrack(null)}
        />
      )}

      {/* Subscription upsell modal (opens from locked track tap) */}
      {showSubscription && (
        <SubscriptionModal onClose={() => setShowSubscription(false)} />
      )}

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
  position: 'relative',
  zIndex: 1,
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
