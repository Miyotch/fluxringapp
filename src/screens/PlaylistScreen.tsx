import React from 'react';
import { IoMusicalNotes, IoAdd } from 'react-icons/io5';
import { GradientBackground } from '../components/ui/GradientBackground';
import { colors } from '../theme/colors';
import { useTracks } from '../hooks/useTracks';

export function PlaylistScreen() {
  const { tracks } = useTracks();

  const playlists = [
    { id: '1', name: 'お気に入り', count: 0, color: '#d4a0c8' },
    { id: '2', name: '集中モード', count: 0, color: '#9b8fd4' },
    { id: '3', name: 'リラックス', count: 0, color: '#8bb8d4' },
  ];

  return (
    <GradientBackground>
      <div style={pageStyle}>
        <h1 style={headingStyle}>ライブラリ</h1>
        <p style={subStyle}>コードやプレイリストを管理できるページ</p>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>プレイリスト</h2>
            <button style={addBtnStyle} type="button">
              <IoAdd size={16} /> 新規作成
            </button>
          </div>
          <div style={gridStyle}>
            {playlists.map((pl) => (
              <div key={pl.id} style={playlistCardStyle}>
                <div style={{ ...playlistIconStyle, background: pl.color }}>
                  <IoMusicalNotes size={22} color="#fff" />
                </div>
                <div style={playlistNameStyle}>{pl.name}</div>
                <div style={playlistCountStyle}>{pl.count} 曲</div>
              </div>
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>最近再生した曲</h2>
          <div style={trackListStyle}>
            {tracks.slice(0, 5).map((track) => (
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
          </div>
        </div>
      </div>
    </GradientBackground>
  );
}

const pageStyle: React.CSSProperties = { padding: '32px 28px', height: '100%', overflowY: 'auto' };
const headingStyle: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: colors.textPrimary, margin: '0 0 4px' };
const subStyle: React.CSSProperties = { fontSize: 13, color: colors.textSecondary, margin: '0 0 24px' };
const sectionStyle: React.CSSProperties = { marginBottom: 28 };
const sectionHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: colors.textPrimary, margin: 0 };
const addBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: colors.primary,
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: 10, padding: '6px 12px', cursor: 'pointer',
  boxShadow: '2px 2px 6px rgba(174,164,204,0.15), -1px -1px 4px rgba(255,255,255,0.7)',
};
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 };
const playlistCardStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 12px', borderRadius: 16,
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '3px 3px 10px rgba(174,164,204,0.15), -2px -2px 6px rgba(255,255,255,0.8)', cursor: 'pointer',
};
const playlistIconStyle: React.CSSProperties = { width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const playlistNameStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: colors.textPrimary };
const playlistCountStyle: React.CSSProperties = { fontSize: 11, color: colors.textSecondary };
const trackListStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const trackRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 12,
  background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.6)',
};
const trackArtStyle: React.CSSProperties = { width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0 };
const trackImgStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const trackTitleStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const trackArtistStyle: React.CSSProperties = { fontSize: 11, color: colors.textSecondary };
