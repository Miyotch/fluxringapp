import React from 'react';
import { colors } from '../../theme/colors';

interface GradientBackgroundProps {
  children: React.ReactNode;
}

export function GradientBackground({ children }: GradientBackgroundProps) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${colors.backgroundStart} 0%, ${colors.backgroundMid} 50%, ${colors.backgroundEnd} 100%)`,
      }}
    >
      {children}
    </div>
  );
}
