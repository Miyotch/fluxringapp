import React from 'react';

interface GradientBackgroundProps {
  children: React.ReactNode;
}

export function GradientBackground({ children }: GradientBackgroundProps) {
  return (
    <div style={{ flex: 1, height: '100%' }}>
      {children}
    </div>
  );
}
