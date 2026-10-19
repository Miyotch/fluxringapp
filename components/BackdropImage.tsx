/**
 * BackdropImage.tsx — ホーム背景の画像版（青雲）
 * ------------------------------------------------------------------
 * 1080×1920（9:16）。それ以外の縦横比の端末では cover で端が切れる。
 * BackdropSky の地色・天の川の代わりに最奥へ敷き、星・調律陣・減光はその上に重なる。
 */

import React from 'react';
import { Image, StyleSheet } from 'react-native';

const SRC = require('../assets/FR_bg_nebula4_FIX_1080x1920.png');

export const BackdropImage: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <Image source={SRC} style={[StyleSheet.absoluteFill, { width, height }]} resizeMode="cover" />
);

export default BackdropImage;
