import React from 'react';
import { GradientBackground } from '../components/ui/GradientBackground';
import { colors } from '../theme/colors';

export function SettingsScreen() {
  return (
    <GradientBackground>
      <div style={containerStyle}>
        <span style={{ fontSize: 18, color: colors.textSecondary }}>設定</span>
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
