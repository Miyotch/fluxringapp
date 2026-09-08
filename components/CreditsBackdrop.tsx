/**
 * CreditsBackdrop.tsx — CREDITS 画面と同じ背景（放射状グラデーション＋3つのオーラ）
 * ------------------------------------------------------------------
 * 元は screens/SettingsDetailScreens.tsx 内に閉じていたが、設定配下以外の画面
 * （コレクション／メディア／VIP等）でも同じ背景を使うため独立させた。
 * 中央上部が明るい放射状グラデーション＋3つのソフトなオーラ（blur近似はエッジが
 * 透明に落ちる radial gradient で代替。RN には CSS の filter:blur 相当がないため）。
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient as SvgRadial, Stop, Rect, Circle } from 'react-native-svg';

export const CR = {
  page: '#0E0C20',
  deepest: '#05040c',
  text: '#ECEEF7',
  sub: '#9498BE',
  tertiary: 'rgba(236, 238, 247, 0.30)',
  cyan: '#60CEE0',
  violet: '#7C62D6',
  border: '#3A3D72',
} as const;

export const CreditsBackdrop: React.FC<{ w: number; h: number }> = ({ w, h }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgRadial id="crbg" cx="50%" cy="0%" r="85%">
          <Stop offset="0.28" stopColor="#15132e" />
          <Stop offset="0.55" stopColor="#0c0a1f" />
          <Stop offset="1" stopColor="#07060f" />
        </SvgRadial>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#crbg)" />
    </Svg>
    <Svg width={300} height={300} style={{ position: 'absolute', left: -80, top: -60 }}>
      <Defs>
        <SvgRadial id="crb1" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#5868E2" stopOpacity={0.2} />
          <Stop offset="1" stopColor="#5868E2" stopOpacity={0} />
        </SvgRadial>
      </Defs>
      <Circle cx={150} cy={150} r={150} fill="url(#crb1)" />
    </Svg>
    <Svg width={260} height={260} style={{ position: 'absolute', right: -90, top: 280 }}>
      <Defs>
        <SvgRadial id="crb2" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={CR.cyan} stopOpacity={0.1} />
          <Stop offset="1" stopColor={CR.cyan} stopOpacity={0} />
        </SvgRadial>
      </Defs>
      <Circle cx={130} cy={130} r={130} fill="url(#crb2)" />
    </Svg>
    <Svg width={220} height={220} style={{ position: 'absolute', left: 20, bottom: -80 }}>
      <Defs>
        <SvgRadial id="crb3" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={CR.violet} stopOpacity={0.14} />
          <Stop offset="1" stopColor={CR.violet} stopOpacity={0} />
        </SvgRadial>
      </Defs>
      <Circle cx={110} cy={110} r={110} fill="url(#crb3)" />
    </Svg>
  </View>
);

export default CreditsBackdrop;
