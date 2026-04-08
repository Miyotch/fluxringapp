import React, { useState } from 'react';
import {
  IoChevronBack,
  IoPlay,
  IoPause,
  IoPlaySkipBack,
  IoPlaySkipForward,
  IoRepeat,
  IoShuffle,
  IoSwapHorizontal,
} from 'react-icons/io5';
import type { Track } from '../../types/track';
import { formatDuration } from '../../types/track';
import { CustomOrderModal } from './CustomOrderModal';

interface NowPlayingProps {
  track: Track;
  isPlaying: boolean;
  position: number;
  duration: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onClose: () => void;
}

export function NowPlaying({
  track,
  isPlaying,
  position,
  duration,
  onTogglePlay,
  onSeek,
  onClose,
}: NowPlayingProps) {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const progress = duration > 0 ? position / duration : 0;

  return (
    <div style={containerStyle}>
      {/* Background: full artwork image, no blur */}
      <div style={bgStyle}>
        {track.artworkUrl ? (
          <img src={track.artworkUrl} alt="" style={bgImgStyle} />
        ) : (
          <div style={{ ...bgImgStyle, background: 'linear-gradient(135deg, #2a2a3e, #1a1a2e)' }} />
        )}
        {/* Light gradient overlay for readability at bottom */}
        <div style={bgOverlayStyle} />
      </div>

      {/* Top bar */}
      <div style={topBarStyle}>
        <button onClick={onClose} style={iconBtnStyle} type="button">
          <IoChevronBack size={24} color="#fff" />
        </button>
        <button onClick={() => setShowOrderModal(true)} style={swapBtnStyle} type="button">
          <IoSwapHorizontal size={20} color="#fff" />
        </button>
      </div>

      {/* Spacer: pushes controls to bottom */}
      <div style={{ flex: 1 }} />

      {/* Bottom controls — centered, constrained width */}
      <div style={bottomStyle}>
        <div style={bottomInnerStyle}>
          {/* Track info */}
          <div style={infoStyle}>
            <div style={titleStyle}>{track.title}</div>
            <div style={artistStyle}>{track.artist}</div>
          </div>

          {/* Progress bar */}
          <div style={progressContainerStyle}>
            <div
              style={progressBarBgStyle}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                onSeek(ratio * duration);
              }}
            >
              <div style={{ ...progressBarFillStyle, width: `${progress * 100}%` }} />
              <div style={{ ...progressKnobStyle, left: `${progress * 100}%` }} />
            </div>
            <div style={timeRowStyle}>
              <span style={timeStyle}>{formatDuration(Math.floor(position))}</span>
              <span style={timeStyle}>{formatDuration(Math.floor(duration))}</span>
            </div>
          </div>

          {/* Playback controls */}
          <div style={controlsStyle}>
            <button style={iconBtnStyle} type="button">
              <IoRepeat size={20} color="rgba(255,255,255,0.5)" />
            </button>
            <button style={iconBtnStyle} type="button">
              <IoPlaySkipBack size={24} color="#fff" />
            </button>
            <button onClick={onTogglePlay} style={playBtnStyle} type="button">
              {isPlaying ? (
                <IoPause size={28} color="#fff" />
              ) : (
                <IoPlay size={28} color="#fff" style={{ marginLeft: 3 }} />
              )}
            </button>
            <button style={iconBtnStyle} type="button">
              <IoPlaySkipForward size={24} color="#fff" />
            </button>
            <button style={iconBtnStyle} type="button">
              <IoShuffle size={20} color="rgba(255,255,255,0.5)" />
            </button>
          </div>
        </div>
      </div>

      {/* Custom order modal */}
      {showOrderModal && (
        <CustomOrderModal
          track={track}
          onClose={() => setShowOrderModal(false)}
        />
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  display: 'flex', flexDirection: 'column',
  color: '#fff',
  animation: 'nowPlayingFadeIn 0.6s ease-out',
};
const bgStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, overflow: 'hidden',
};
const bgImgStyle: React.CSSProperties = {
  width: '100%', height: '100%', objectFit: 'cover',
  animation: 'nowPlayingBgFadeIn 0.9s ease-out',
};
const bgOverlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.55) 100%)',
};
const topBarStyle: React.CSSProperties = {
  position: 'relative', zIndex: 1,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 24px',
  animation: 'nowPlayingContentFadeIn 0.7s ease-out 0.1s backwards',
};
const bottomStyle: React.CSSProperties = {
  position: 'relative', zIndex: 1,
  display: 'flex', justifyContent: 'center',
  padding: '0 24px 48px',
  animation: 'nowPlayingContentFadeIn 0.8s ease-out 0.15s backwards',
};
const bottomInnerStyle: React.CSSProperties = {
  width: '100%', maxWidth: 420,
};
const infoStyle: React.CSSProperties = {
  textAlign: 'center', marginBottom: 20,
};
const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, marginBottom: 4,
  textShadow: '0 1px 4px rgba(0,0,0,0.4)',
};
const artistStyle: React.CSSProperties = {
  fontSize: 13, opacity: 0.7,
  textShadow: '0 1px 3px rgba(0,0,0,0.3)',
};
const progressContainerStyle: React.CSSProperties = {
  marginBottom: 20,
};
const progressBarBgStyle: React.CSSProperties = {
  position: 'relative', height: 3, borderRadius: 2, cursor: 'pointer',
  background: 'rgba(255,255,255,0.25)',
};
const progressBarFillStyle: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 2,
  background: '#fff',
};
const progressKnobStyle: React.CSSProperties = {
  position: 'absolute', top: '50%', width: 10, height: 10, borderRadius: '50%',
  background: '#fff', transform: 'translate(-50%, -50%)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
};
const timeRowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', marginTop: 6,
};
const timeStyle: React.CSSProperties = {
  fontSize: 11, opacity: 0.6,
};
const controlsStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28,
};
const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const playBtnStyle: React.CSSProperties = {
  width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
};
const swapBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '50%', width: 36, height: 36, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
