import React from 'react';
import { IoClose, IoCheckmarkCircle } from 'react-icons/io5';
import { OrbSphere } from '../ui/OrbSphere';
import { colors } from '../../theme/colors';
import type { Playlist } from '../../hooks/usePlaylists';
import type { Track } from '../../types/track';

interface PlaylistPickerModalProps {
  track: Track;
  playlists: Playlist[];
  onPick: (playlistId: string) => void;
  onClose: () => void;
}

export function PlaylistPickerModal({
  track,
  playlists,
  onPick,
  onClose,
}: PlaylistPickerModalProps) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={headerTitleStyle}>プレイリストに追加</h2>
          <button onClick={onClose} style={closeBtnStyle} type="button">
            <IoClose size={20} color={colors.textSecondary} />
          </button>
        </div>

        {/* Track preview */}
        <div style={trackPreviewStyle}>
          <div style={trackArtStyle}>
            {track.artworkUrl ? (
              <img src={track.artworkUrl} alt="" style={trackImgStyle} />
            ) : (
              <div
                style={{
                  ...trackImgStyle,
                  background: 'linear-gradient(135deg, #e0d8f0, #c8bde5)',
                }}
              />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={trackTitleStyle}>{track.title}</div>
            <div style={trackSubStyle}>{track.artist}</div>
          </div>
        </div>

        <p style={helperStyle}>追加先のプレイリストを選んでください</p>

        {/* Playlist list */}
        <div style={listStyle}>
          {playlists.map((pl) => {
            const alreadyIn = pl.trackIds.includes(track.id);
            return (
              <button
                key={pl.id}
                onClick={() => !alreadyIn && onPick(pl.id)}
                disabled={alreadyIn}
                style={{
                  ...itemStyle,
                  opacity: alreadyIn ? 0.55 : 1,
                  cursor: alreadyIn ? 'default' : 'pointer',
                }}
                type="button"
              >
                <OrbSphere size={44} hue={pl.hue} />
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={itemNameStyle}>{pl.name}</div>
                  <div style={itemCountStyle}>{pl.trackIds.length} 曲</div>
                </div>
                {alreadyIn && (
                  <IoCheckmarkCircle size={20} color={colors.primary} />
                )}
              </button>
            );
          })}
        </div>

        {playlists.length === 0 && (
          <div style={emptyStyle}>プレイリストがありません</div>
        )}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 400,
  background: 'rgba(0,0,0,0.35)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: 'searchFadeIn 0.3s ease-out',
};
const modalStyle: React.CSSProperties = {
  background: '#E6EBF1',
  borderRadius: 20,
  padding: '24px 24px 20px',
  maxWidth: 420,
  width: '90%',
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};
const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
};
const headerTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: colors.textPrimary,
  margin: 0,
};
const closeBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.6)',
  border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: '50%',
  width: 32,
  height: 32,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const trackPreviewStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.6)',
  border: '1px solid rgba(255,255,255,0.7)',
  marginBottom: 14,
};
const trackArtStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 8,
  overflow: 'hidden',
  flexShrink: 0,
};
const trackImgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};
const trackTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: colors.textPrimary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const trackSubStyle: React.CSSProperties = {
  fontSize: 11,
  color: colors.textSecondary,
  marginTop: 2,
};
const helperStyle: React.CSSProperties = {
  fontSize: 12,
  color: colors.textSecondary,
  margin: '0 0 10px',
};
const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};
const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 14px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.55)',
  border: '1px solid rgba(255,255,255,0.65)',
  boxShadow: '2px 2px 6px rgba(174,164,204,0.12), -1px -1px 4px rgba(255,255,255,0.7)',
  transition: 'transform 0.1s',
  width: '100%',
  font: 'inherit',
};
const itemNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: colors.textPrimary,
};
const itemCountStyle: React.CSSProperties = {
  fontSize: 11,
  color: colors.textSecondary,
  marginTop: 2,
};
const emptyStyle: React.CSSProperties = {
  fontSize: 13,
  color: colors.textSecondary,
  textAlign: 'center',
  padding: 24,
};
