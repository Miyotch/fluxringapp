import React, { useState } from 'react';
import { IoSearchOutline } from 'react-icons/io5';
import { GradientBackground } from '../components/ui/GradientBackground';
import { colors } from '../theme/colors';
import { useTracks } from '../hooks/useTracks';
import type { Track } from '../types/track';

export function SearchScreen() {
  const { tracks } = useTracks();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? tracks.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.description.toLowerCase().includes(query.toLowerCase()),
      )
    : [];

  return (
    <GradientBackground>
      <div style={pageStyle}>
        <h1 style={headingStyle}>サーチ</h1>
        <p style={subStyle}>サウンドを探すための検索ページ</p>

        {/* Search bar */}
        <div style={searchBarStyle}>
          <IoSearchOutline size={18} color={colors.textSecondary} />
          <input
            type="text"
            placeholder="サウンド名やキーワードで検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Results */}
        {query.trim() ? (
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>検索結果 ({filtered.length})</h2>
            {filtered.length === 0 ? (
              <p style={emptyStyle}>該当するサウンドが見つかりません</p>
            ) : (
              <div style={listStyle}>
                {filtered.map((track) => (
                  <SearchResultCard key={track.id} track={track} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>すべてのサウンド</h2>
            <div style={listStyle}>
              {tracks.map((track) => (
                <SearchResultCard key={track.id} track={track} />
              ))}
            </div>
          </div>
        )}
      </div>
    </GradientBackground>
  );
}

function SearchResultCard({ track }: { track: Track }) {
  return (
    <div style={cardStyle}>
      <div style={cardArtStyle}>
        {track.artworkUrl ? (
          <img src={track.artworkUrl} alt="" style={cardImgStyle} />
        ) : (
          <div style={{ ...cardImgStyle, background: 'linear-gradient(135deg, #e0d8f0, #c8bde5)' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={cardTitleStyle}>{track.title}</div>
        <div style={cardDescStyle}>{track.description}</div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  padding: '32px 28px',
  height: '100%',
  overflowY: 'auto',
};
const headingStyle: React.CSSProperties = {
  fontSize: 22, fontWeight: 700, color: colors.textPrimary, margin: '0 0 4px',
};
const subStyle: React.CSSProperties = {
  fontSize: 13, color: colors.textSecondary, margin: '0 0 20px',
};
const searchBarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.8)',
  boxShadow: '3px 3px 10px rgba(174,164,204,0.15), -2px -2px 6px rgba(255,255,255,0.8)',
  marginBottom: 24,
};
const inputStyle: React.CSSProperties = {
  flex: 1, border: 'none', outline: 'none', background: 'transparent',
  fontSize: 14, color: colors.textPrimary,
};
const sectionStyle: React.CSSProperties = { marginBottom: 20 };
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15, fontWeight: 600, color: colors.textPrimary, margin: '0 0 12px',
};
const emptyStyle: React.CSSProperties = {
  fontSize: 13, color: colors.textSecondary, textAlign: 'center', padding: 32,
};
const listStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8,
};
const cardStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.55)',
  border: '1px solid rgba(255,255,255,0.6)',
  boxShadow: '2px 2px 8px rgba(174,164,204,0.12), -1px -1px 4px rgba(255,255,255,0.7)',
};
const cardArtStyle: React.CSSProperties = {
  width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
};
const cardImgStyle: React.CSSProperties = {
  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
};
const cardTitleStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, color: colors.textPrimary, marginBottom: 2,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
};
const cardDescStyle: React.CSSProperties = {
  fontSize: 12, color: colors.textSecondary,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
};
