import React, { useState } from 'react';
import {
  IoChevronBack,
  IoPlayCircle,
  IoPauseCircle,
  IoPlaySkipBack,
  IoPlaySkipForward,
  IoVolumeHigh,
  IoVolumeMute,
  IoAdd,
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
      {/* Background: blurred artwork */}
      <div style={bgStyle}>
        {track.artworkUrl && (
          <img src={track.artworkUrl} alt="" style={bgImgStyle} />
        )}
        <div style={bgOverlayStyle} />
      </div>

      {/* Top bar */}
      <div style={topBarStyle}>
        <button onClick={onClose} style={iconBtnStyle} type="button">
          <IoChevronBack size={24} color="#fff" />
        </button>
        <button onClick={() => setShowOrderModal(true)} style={addBtnStyle} type="button">
          <IoAdd size={22} color="#fff" />
        </button>
      </div>

      {/* Center artwork */}
      <div style={centerStyle}>
        <div style={artworkContainerStyle}>
          {track.artworkUrl ? (
            <img src={track.artworkUrl} alt={track.title} style={artworkStyle} />
          ) : (
            <div style={{ ...artworkStyle, background: 'linear-gradient(135deg, #444, #222)' }} />
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div style={bottomStyle}>
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
            <IoVolumeMute size={22} color="rgba(255,255,255,0.6)" />
          </button>
          <button style={iconBtnStyle} type="button">
            <IoPlaySkipBack size={26} color="#fff" />
          </button>
          <button onClick={onTogglePlay} style={iconBtnStyle} type="button">
            {isPlaying ? (
              <IoPauseCircle size={56} color="#fff" />
            ) : (
              <IoPlayCircle size={56} color="#fff" />
            )}
          </button>
          <button style={iconBtnStyle} type="button">
            <IoPlaySkipForward size={26} color="#fff" />
          </button>
          <button style={iconBtnStyle} type="button">
            <IoVolumeHigh size={22} color="rgba(255,255,255,0.6)" />
          </button>
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
};
const bgStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, overflow: 'hidden',
};
const bgImgStyle: React.CSSProperties = {
  width: '100%', height: '100%', objectFit: 'cover',
  filter: 'blur(40px) brightness(0.4)',
  transform: 'scale(1.2)',
};
const bgOverlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%)',
};
const topBarStyle: React.CSSProperties = {
  position: 'relative', zIndex: 1,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 20px',
};
const centerStyle: React.CSSProperties = {
  flex: 1, position: 'relative', zIndex: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const artworkContainerStyle: React.CSSProperties = {
  width: 280, height: 280, borderRadius: 20, overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
};
const artworkStyle: React.CSSProperties = {
  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
};
const bottomStyle: React.CSSProperties = {
  position: 'relative', zIndex: 1,
  padding: '0 32px 40px',
};
const infoStyle: React.CSSProperties = {
  textAlign: 'center', marginBottom: 20,
};
const titleStyle: React.CSSProperties = {
  fontSize: 20, fontWeight: 700, marginBottom: 4,
};
const artistStyle: React.CSSProperties = {
  fontSize: 14, opacity: 0.7,
};
const progressContainerStyle: React.CSSProperties = {
  marginBottom: 24,
};
const progressBarBgStyle: React.CSSProperties = {
  position: 'relative', height: 4, borderRadius: 2, cursor: 'pointer',
  background: 'rgba(255,255,255,0.2)',
};
const progressBarFillStyle: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 2,
  background: '#fff',
};
const progressKnobStyle: React.CSSProperties = {
  position: 'absolute', top: '50%', width: 12, height: 12, borderRadius: '50%',
  background: '#fff', transform: 'translate(-50%, -50%)',
  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
};
const timeRowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', marginTop: 6,
};
const timeStyle: React.CSSProperties = {
  fontSize: 11, opacity: 0.6,
};
const controlsStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
};
const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const addBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: '50%', width: 36, height: 36, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
