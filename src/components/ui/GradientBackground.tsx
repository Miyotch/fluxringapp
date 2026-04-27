import React from 'react';

interface GradientBackgroundProps {
  children: React.ReactNode;
}

export function GradientBackground({ children }: GradientBackgroundProps) {
  return (
    <div style={bgStyle}>
      {children}
    </div>
  );
}

const bgStyle: React.CSSProperties = {
  flex: 1,
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
  background: 'linear-gradient(180deg, #E6EBF1 0%, #dde3ed 50%, #E6EBF1 100%)',
};
