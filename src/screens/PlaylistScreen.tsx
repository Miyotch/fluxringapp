import React from 'react';
import { GradientBackground } from '../components/ui/GradientBackground';
import { colors } from '../theme/colors';

export function PlaylistScreen() {
  return (
    <GradientBackground>
      <div style={containerStyle}>
        <span style={{ fontSize: 18, color: colors.textSecondary }}>
          プレイリスト
        </span>
      </div>
    </GradientBackground>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
};
