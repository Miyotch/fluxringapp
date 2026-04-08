import React, { useState } from 'react';
import { IoAdd, IoLockClosed, IoPlayCircle } from 'react-icons/io5';
import { GradientBackground } from '../components/ui/GradientBackground';
import { OrbSphere } from '../components/ui/OrbSphere';
import { colors } from '../theme/colors';
import { useTracks } from '../hooks/useTracks';
import { PlaylistEditModal } from '../components/playlist/PlaylistEditModal';

interface Playlist {
  id: string;
  name: string;
  count: number;
  hue: number; // orb color
}

interface CustomTrack {
  id: string;
  title: string;
  duration: string;
  artworkUrl?: string;
}

const DEFAULT_PLAYLISTS: Playlist[] = [
  { id: '1', name: 'お気に入り', count: 0, hue: 290 },
  { id: '2', name: '集中モード', count: 0, hue: 260 },
  { id: '3', name: 'リラックス', count: 0, hue: 195 },
];

// TODO: Replace with real user state from auth/subscription
const IS_PREMIUM_USER = false;
const CUSTOM_TRACKS: CustomTrack[] = [];

export function PlaylistScreen() {
  const { tracks } = useTracks();
  const [playlists, setPlaylists] = useState<Playlist[]>(DEFAULT_PLAYLISTS);
  const [editModal, setEditModal] = useState<{ mode: 'add' | 'edit'; playlist?: Playlist } | null>(null);

  const handleSavePlaylist = (name: string, hue: number, id?: string) => {
    if (id) {
      setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name, hue } : p)));
    } else {
      setPlaylists((prev) => [...prev, { id: String(Date.now()), name, count: 0, hue }]);
    }
    setEditModal(null);
  };

  const handleDeletePlaylist = (id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    setEditModal(null);
  };

  const hasCustomTracks = IS_PREMIUM_USER && CUSTOM_TRACKS.length > 0;

  return (
    <GradientBackground>
      <div style={pageStyle}>
        <h1 style={headingStyle}>ライブラリ</h1>
        <p style={subStyle}>コードやプレイリストを管理できるページ</p>

        {/* ── Section 1: Recent Tracks (10) ── */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>最近再生した曲</h2>
          <div style={trackListStyle}>
            {tracks.slice(0, 10).map((track) => (
              <div key={track.id} style={trackRowStyle}>
                <div style={trackArtStyle}>
                  {track.artworkUrl ? (
                    <img src={track.artworkUrl} alt="" style={trackImgStyle} />
                  ) : (
                    <div style={{ ...trackImgStyle, background: 'linear-gradient(135deg, #e0d8f0, #c8bde5)' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={trackTitleStyle}>{track.title}</div>
                  <div style={trackArtistStyle}>{track.artist}</div>
                </div>
              </div>
            ))}
            {tracks.length === 0 && (
              <div style={emptyStyle}>まだ再生履歴がありません</div>
            )}
          </div>
        </div>

        {/* ── Section 2: Custom Order (full width row) ── */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>カスタム制作</h2>
          <div style={customOrderCardStyle}>
            {hasCustomTracks ? (
              // Premium user with custom tracks
              <div style={customTracksWrapStyle}>
                {CUSTOM_TRACKS.map((track) => (
                  <div key={track.id} style={customTrackItemStyle}>
                    <div style={customTrackArtStyle}>
                      {track.artworkUrl ? (
                        <img src={track.artworkUrl} alt="" style={trackImgStyle} />
                      ) : (
                        <div style={{ ...trackImgStyle, background: 'linear-gradient(135deg, #9178BD, #6c5ce7)' }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={customTrackTitleStyle}>{track.title}</div>
                      <div style={customTrackMetaStyle}>カスタム制作 · {track.duration}</div>
                    </div>
                    <IoPlayCircle size={28} color={colors.primary} />
                  </div>
                ))}
              </div>
            ) : (
              // Free user: show lock centered
              <div style={lockedWrapStyle}>
                <div style={lockIconCircleStyle}>
                  <IoLockClosed size={26} color={colors.primary} />
                </div>
                <div style={lockedTitleStyle}>カスタム制作はプレミアム機能です</div>
                <div style={lockedDescStyle}>
                  あなただけのオリジナル楽曲を作成するには、プレミアムプランへのアップグレードが必要です
                </div>
                <button style={unlockBtnStyle} type="button">
                  プレミアムにアップグレード
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Section 3: Playlists with Orb Spheres ── */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>作成したプレイリスト</h2>
            <button
              onClick={() => setEditModal({ mode: 'add' })}
              style={addBtnStyle}
              type="button"
            >
              <IoAdd size={16} /> 新規作成
            </button>
          </div>
          <div style={plGridStyle}>
            {playlists.map((pl) => (
              <div
                key={pl.id}
                style={plCardStyle}
                onClick={() => setEditModal({ mode: 'edit', playlist: pl })}
              >
                <OrbSphere size={72} hue={pl.hue} />
                <div style={plNameStyle}>{pl.name}</div>
                <div style={plCountStyle}>{pl.count} 曲</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Playlist add/edit modal */}
      {editModal && (
        <PlaylistEditModal
          mode={editModal.mode}
          playlist={editModal.playlist ? { id: editModal.playlist.id, name: editModal.playlist.name, hue: editModal.playlist.hue } : undefined}
          onSave={handleSavePlaylist}
          onDelete={editModal.mode === 'edit' ? handleDeletePlaylist : undefined}
          onClose={() => setEditModal(null)}
        />
      )}
    </GradientBackground>
  );
}

const pageStyle: React.CSSProperties = {
  padding: '32px 28px', height: '100%', overflowY: 'auto',
  maxWidth: 900, margin: '0 auto', width: '100%',
};
const headingStyle: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: colors.textPrimary, margin: '0 0 4px' };
const subStyle: React.CSSProperties = { fontSize: 13, color: colors.textSecondary, margin: '0 0 24px' };
const sectionStyle: React.CSSProperties = { marginBottom: 28 };
const sectionHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: colors.textPrimary, margin: '0 0 12px' };
const emptyStyle: React.CSSProperties = { fontSize: 13, color: colors.textSecondary, textAlign: 'center', padding: 24 };

// Track list
const trackListStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const trackRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 12,
  background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.6)', cursor: 'pointer',
};
const trackArtStyle: React.CSSProperties = { width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0 };
const trackImgStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const trackTitleStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const trackArtistStyle: React.CSSProperties = { fontSize: 11, color: colors.textSecondary };

// Custom order — full-width row
const customOrderCardStyle: React.CSSProperties = {
  width: '100%', minHeight: 140, borderRadius: 16, padding: '24px 20px',
  background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.65)',
  boxShadow: '3px 3px 12px rgba(174,164,204,0.15), -2px -2px 6px rgba(255,255,255,0.8)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// Locked (free user)
const lockedWrapStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6,
};
const lockIconCircleStyle: React.CSSProperties = {
  width: 56, height: 56, borderRadius: '50%',
  background: 'linear-gradient(145deg, rgba(255,255,255,0.9), rgba(230,225,245,0.7))',
  border: '1px solid rgba(255,255,255,0.8)',
  boxShadow: '3px 3px 8px rgba(174,164,204,0.2), -2px -2px 6px rgba(255,255,255,0.9)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6,
};
const lockedTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: colors.textPrimary };
const lockedDescStyle: React.CSSProperties = {
  fontSize: 11, color: colors.textSecondary, lineHeight: 1.6, maxWidth: 340, margin: '0 auto 12px',
};
const unlockBtnStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#fff', border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #a388c8, #9178BD)',
  borderRadius: 20, padding: '8px 18px',
  boxShadow: '0 3px 10px rgba(145,120,189,0.35)',
};

// Custom tracks (premium user)
const customTracksWrapStyle: React.CSSProperties = {
  width: '100%', display: 'flex', flexDirection: 'column', gap: 8,
};
const customTrackItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: 12,
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)', cursor: 'pointer',
};
const customTrackArtStyle: React.CSSProperties = {
  width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
};
const customTrackTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: colors.textPrimary };
const customTrackMetaStyle: React.CSSProperties = { fontSize: 11, color: colors.primary, marginTop: 2 };

// Playlists
const addBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: colors.primary,
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: 10, padding: '6px 12px', cursor: 'pointer',
  boxShadow: '2px 2px 6px rgba(174,164,204,0.15), -1px -1px 4px rgba(255,255,255,0.7)',
};
const plGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 14,
};
const plCardStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 8px', borderRadius: 16,
  background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.65)',
  boxShadow: '3px 3px 10px rgba(174,164,204,0.12), -2px -2px 6px rgba(255,255,255,0.8)', cursor: 'pointer',
};
const plNameStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: colors.textPrimary, textAlign: 'center' };
const plCountStyle: React.CSSProperties = { fontSize: 10, color: colors.textSecondary };
