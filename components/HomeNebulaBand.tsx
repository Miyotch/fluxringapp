import React from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import { Canvas, Fill, LinearGradient, Shader, Skia, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { BAND_FALLBACK_COLORS, HOME_NEBULA_BAND_SHADER, bandUniforms } from '../lib/homeNebulaBand';

const effect = Skia.RuntimeEffect.Make(HOME_NEBULA_BAND_SHADER);
if (!effect) console.warn('[HomeNebulaBand] Band shader unavailable; using a flat night sky');

/** 試作のスマホ表示と同じ、画面幅(dp)×0.75 の物理 px（上限 480）で描いて拡大する。 */
const BAND_PX_RATIO = .75;
const BAND_PX_MAX = 480;

/**
 * ホーム背景の星雲（天の川の帯）。不透明なので最奥に置き、星はこの上に重ねる。
 * 時計が止まれば（背面・ゆらぎ停止・OSの視差減）uniforms が変わらず再描画も止まる。
 */
export function HomeNebulaBand({ width, height, clock, strength }: {
  width: number; height: number; clock: SharedValue<number>; strength: number;
}) {
  const scale = Math.min(1, Math.min(BAND_PX_MAX, width * BAND_PX_RATIO) / (width * PixelRatio.get()));
  const w = width * scale, h = height * scale;
  const uniforms = useDerivedValue(() => bandUniforms(clock.value / 1000, strength, w, h), [clock, strength, w, h]);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
    <Canvas pointerEvents="none" style={{ width: w, height: h, transformOrigin: 'top left', transform: [{ scale: 1 / scale }] }}>
      {effect
        ? <Fill><Shader source={effect} uniforms={uniforms} /></Fill>
        : <Fill><LinearGradient start={vec(0, 0)} end={vec(0, h)} colors={BAND_FALLBACK_COLORS} /></Fill>}
    </Canvas>
  </View>;
}
