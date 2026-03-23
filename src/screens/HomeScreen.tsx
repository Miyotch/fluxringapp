import React, { useState, useCallback } from 'react';
import { GradientBackground } from '../components/ui/GradientBackground';
import { TrackList } from '../components/track/TrackList';
import { FluxRingDial } from '../components/ring/FluxRingDial';
import { FluxWaveCanvas } from '../components/ring/FluxWaveCanvas';
import { CenterAuroraCanvas } from '../components/ring/CenterAuroraCanvas';
import { useAudioPlayer } from '../components/player/useAudioPlayer';
import { useTracks } from '../hooks/useTracks';
import type { Track } from '../types/track';

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function amplitudeToLevel(amplitude: number): number {
  const t = clamp((amplitude - 0.2) / 3.8, 0, 1);
  return Math.min(5, Math.floor(t * 5) + 1);
}

export function HomeScreen() {
  const { tracks, loading, error } = useTracks();
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

  const dialSize = Math.min(500, window.innerHeight - 120);
  const orbR = dialSize * 0.30; // Match FluxRingDial center circle size
  const auroraSize = Math.floor(orbR * 2 * 0.92);
  const level = amplitudeToLevel(amplitude);
  const knobRotation =
    ((amplitude - 0.2) / 3.8) * Math.PI * 1.67 - Math.PI * 0.83;

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
            favorites={favorites}
            onPlayTrack={handlePlayTrack}
            onPreviewTrack={handlePlayTrack}
            onAddTrack={() => {}}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>
        <div style={dialContainerStyle}>
          {/* Background wave layers (もやもや) */}
          <FluxWaveCanvas waveAmplitude={amplitude} />
          {/* Ring dial (Lumen Cascade) */}
          <div style={dialOverlayStyle}>
            <FluxRingDial
              size={dialSize}
              amplitude={amplitude}
              onAmplitudeChange={setAmplitude}
            />
          </div>
          {/* Center aurora + labels overlaid on the knob */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: auroraSize,
              height: auroraSize,
              borderRadius: '50%',
              overflow: 'hidden',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <CenterAuroraCanvas size={auroraSize} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  fontSize: orbR * 0.38,
                  fontWeight: 200,
                  fontFamily: "'Inter', sans-serif",
                  color: 'rgba(160, 145, 195, 0.55)',
                  lineHeight: 1,
                }}
              >
                {String(level).padStart(2, '0')}
              </span>
              <span
                style={{
                  fontSize: orbR * 0.12,
                  fontWeight: 300,
                  fontFamily: "'Inter', sans-serif",
                  color: 'rgba(160, 145, 195, 0.45)',
                  marginTop: 4,
                }}
              >
                Flux Ring
              </span>
            </div>
            {/* Dot indicator */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: orbR * 0.1,
                height: orbR * 0.1,
                borderRadius: '50%',
                backgroundColor: 'rgba(210, 195, 230, 0.7)',
                transform: `translate(-50%, -50%) rotate(${knobRotation}rad) translateY(${orbR * 0.65}px)`,
                pointerEvents: 'none',
              }}
            />
          </div>
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
  borderRight: '1px solid rgba(200, 190, 220, 0.2)',
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

const dialOverlayStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
};
