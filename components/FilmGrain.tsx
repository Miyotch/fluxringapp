/**
 * FilmGrain.tsx — 空気の粒（v99-tsubasa `#bggrain`）
 * ------------------------------------------------------------------
 * 参照: fr_v99_tsubasa.html 16-18行。
 *   background-image: SVG feTurbulence(fractalNoise, baseFrequency .85,
 *                     numOctaves 2, stitchTiles) → feColorMatrix saturate 0
 *   background-size : 140px 140px（タイル）
 *   opacity         : .05
 *
 * この 1 枚が背景のバンディングと均質さを消している。とくに実機 OLED は
 * 極暗部（#07060f 付近）の階調が潰れて縞に見えやすく、この粒が無いと
 * ブラウザで見えていたビネットの減光が別物になる。
 *
 * 移植ノート:
 *   ・feTurbulence type="fractalNoise" は Skia の FractalNoise と等価。
 *     stitchTiles は tileWidth/tileHeight で再現する。
 *   ・saturate 0 の係数は CSS/SVG と同じ輝度ベクトル (.2126 .7152 .0722)。
 *   ・静止画で良い（参照も静的グレイン）。毎フレーム再生成しない。
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Rect, FractalNoise, ColorMatrix } from '@shopify/react-native-skia';

/** 参照の background-size 140px 140px */
const TILE = 140;
/** feTurbulence baseFrequency="0.85" */
const FREQ = 0.85;
/** numOctaves="2" */
const OCTAVES = 2;
/** #bggrain の opacity */
const GRAIN_OPACITY = 0.05;

// feColorMatrix type="saturate" values="0"
const DESATURATE = [
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0, 0, 0, 1, 0,
];

export type FilmGrainProps = {
  width: number;
  height: number;
  /** 既定 0.05（参照値）。実機の暗部の出方で 0.04〜0.07 が調整幅 */
  opacity?: number;
};

export const FilmGrain: React.FC<FilmGrainProps> = ({
  width,
  height,
  opacity = GRAIN_OPACITY,
}) => (
  <Canvas
    style={[StyleSheet.absoluteFill, { width, height, opacity }]}
    pointerEvents="none"
  >
    <Rect x={0} y={0} width={width} height={height}>
      <FractalNoise
        freqX={FREQ}
        freqY={FREQ}
        octaves={OCTAVES}
        seed={0}
        tileWidth={TILE}
        tileHeight={TILE}
      />
      <ColorMatrix matrix={DESATURATE} />
    </Rect>
  </Canvas>
);

export default FilmGrain;
