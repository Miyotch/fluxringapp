export const colors = {
  // Background
  backgroundStart: '#f5f3fa',
  backgroundEnd: '#e8e0f5',
  backgroundMid: '#f0ecf8',

  // Primary purple
  primary: '#9b8fd4',
  primaryLight: 'rgba(155, 143, 212, 0.4)',
  primaryMuted: 'rgba(160, 145, 195, 0.5)',

  // Text
  textPrimary: '#3a3555',
  textSecondary: '#7a7494',
  textMuted: 'rgba(160, 145, 195, 0.4)',

  // Card / Glass
  cardBackground: 'rgba(255, 255, 255, 0.6)',
  cardBorder: 'rgba(255, 255, 255, 0.8)',
  cardActiveBackground: 'rgba(255, 255, 255, 0.85)',

  // Tab bar
  tabBarBackground: 'rgba(255, 255, 255, 0.9)',
  tabBarBorder: 'rgba(200, 190, 220, 0.3)',
  tabActive: '#7a6bb5',
  tabInactive: '#b0a8c8',

  // Ring
  ringGlow: 'rgba(155, 143, 212, 0.7)',
  ringBezel: 'rgba(255, 255, 255, 0.85)',

  // Buttons
  buttonPlay: '#9b8fd4',
  buttonHeart: '#d4a0c8',
  buttonPlus: '#a898d0',

  white: '#ffffff',
} as const;

export type ColorKey = keyof typeof colors;
