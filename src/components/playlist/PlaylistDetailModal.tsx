import React from 'react';
import {
  IoClose,
  IoPlay,
  IoPause,
  IoTrashOutline,
  IoSettingsOutline,
  IoMusicalNote,
} from 'react-icons/io5';
import { OrbSphere } from '../ui/OrbSphere';
import { colors } from '../../theme/colors';
import type { Playlist } from '../../hooks/usePlaylists';
import type { Track } from '../../types/track';
import { formatDuration } from '../../types/track';

interface PlaylistDetailModalProps {
  playlist: Playlist;
  allTracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onRemoveTrack: (trackId: string) => void;
  onOpenEdit: () => void;
  onClose: () => void;
}

export function PlaylistDetailModal({
  playlist,
  allTracks,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onRemoveTrack,
  onOpenEdit,
  onClose,
}: PlaylistDetailModalProps) {
  // Resolve track IDs to Track objects (preserving playlist order)
  const playlistTracks = playlist.trackIds
    .map((id) => allTracks.find((t) => t.id === id))
    .filter((t): t is Track => Boolean(t));

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={orbWrapStyle}>
            <OrbSphere size={72} hue={playlist.hue} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={kindLabelStyle}>プレイリスト</div>
            <h2 style={titleStyle}>{playlist.name}</h2>
            <div style={countStyle}>{playlistTracks.length} 曲</div>
          </div>
          <button
            onClick={onOpenEdit}
            style={editBtnStyle}
            type="button"
            aria-label="プレイリスト設定を編集"
          >
            <IoSettingsOutline size={18} color={colors.textSecondary} />
          </button>
          <button
            onClick={onClose}
            style={closeBtnStyle}
            type="button"
            aria-label="閉じる"
          >
            <IoClose size={20} color={colors.textSecondary} />
          </button>
        </div>

        {/* Track list */}
        <div style={listWrapStyle}>
          {playlistTracks.length === 0 ? (
            <div style={emptyWrapStyle}>
              <div style={emptyIconStyle}>
                <IoMusicalNote size={32} color={colors.textMuted} />
              </div>
              <div style={emptyTitleStyle}>まだ曲がありません</div>
              <div style={emptyDescStyle}>
                曲リストの「+」ボタンからこのプレイリストへ追加できます
              </div>
            </div>
          ) : (
            <div style={listStyle}>
              {playlistTracks.map((track) => {
                const active = track.id === currentTrackId;
                return (
                  <div
                    key={track.id}
                    style={{
                      ...rowStyle,
                      ...(active ? rowActiveStyle : null),
                    }}
                  >
                    <div style={artStyle}>
                      {track.artworkUrl ? (
                        <img src={track.artworkUrl} alt="" style={imgStyle} />
                      ) : (
                        <div
                          style={{
                            ...imgStyle,
                            background:
                              'linear-gradient(135deg, #e0d8f0, #c8bde5)',
                          }}
                        />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={trackNameStyle}>{track.title}</div>
                      <div style={trackMetaStyle}>
                        {track.artist} · {formatDuration(track.duration)}
                      </div>
                    </div>
                    <button
                      onClick={() => onPlayTrack(track)}
                      style={playBtnStyle}
                      type="button"
                      aria-label={active && isPlaying ? '一時停止' : '再生'}
                    >
                      {active && isPlaying ? (
                        <IoPause size={14} color="#fff" />
                      ) : (
                        <IoPlay
                          size={14}
                          color="#fff"
                          style={{ marginLeft: 1 }}
                        />
                      )}
                    </button>
                    <button
                      onClick={() => onRemoveTrack(track.id)}
                      style={removeBtnStyle}
                      type="button"
                      aria-label="プレイリストから削除"
                    >
                      <IoTrashOutline size={16} color={colors.textSecondary} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
  maxWidth: 520,
  width: '92%',
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  marginBottom: 18,
};
const orbWrapStyle: React.CSSProperties = { flexShrink: 0 };
const kindLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: colors.primary,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 2,
};
const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: colors.textPrimary,
  margin: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const countStyle: React.CSSProperties = {
  fontSize: 11,
  color: colors.textSecondary,
  marginTop: 2,
};
const editBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.6)',
  border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: '50%',
  width: 32,
  height: 32,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxShadow: '2px 2px 6px rgba(174,164,204,0.15), -1px -1px 4px rgba(255,255,255,0.7)',
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
  flexShrink: 0,
  boxShadow: '2px 2px 6px rgba(174,164,204,0.15), -1px -1px 4px rgba(255,255,255,0.7)',
};

const listWrapStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  paddingRight: 2,
};
const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 14px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.55)',
  border: '1px solid rgba(255,255,255,0.65)',
  transition: 'background 0.15s',
};
const rowActiveStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.85)',
  boxShadow: '0 2px 8px rgba(145,120,189,0.15)',
};
const artStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  overflow: 'hidden',
  flexShrink: 0,
};
const imgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};
const trackNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: colors.textPrimary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const trackMetaStyle: React.CSSProperties = {
  fontSize: 11,
  color: colors.textSecondary,
  marginTop: 2,
};
const playBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(145deg, #a388c8 0%, #9178BD 100%)',
  boxShadow: '2px 2px 6px rgba(145,120,189,0.32), -1px -1px 4px rgba(255,255,255,0.6)',
  flexShrink: 0,
};
const removeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const emptyWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 20px',
  textAlign: 'center',
};
const emptyIconStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.6)',
  border: '1px solid rgba(255,255,255,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 14,
  boxShadow: '2px 2px 8px rgba(174,164,204,0.15), -1px -1px 4px rgba(255,255,255,0.8)',
};
const emptyTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: colors.textPrimary,
  marginBottom: 4,
};
const emptyDescStyle: React.CSSProperties = {
  fontSize: 11,
  color: colors.textSecondary,
  lineHeight: 1.6,
  maxWidth: 260,
};
