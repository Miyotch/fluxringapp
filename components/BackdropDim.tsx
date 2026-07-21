/**
 * BackdropDim.tsx — 背景の暗化2層（v99 `.bgvig` / `.focus-dim` 準拠）
 * ------------------------------------------------------------------
 * 参照: fr_v99_tsubasa.html 23行 / 25行 / 682行(P.vig) / 709行(dim制御)。
 * ホームの背景が参照より明るく見えていた主因＝この2層の欠如。
 *
 *  ① bgvig（常時ビネット）
 *     radial-gradient(circle at 50% 44%, transparent 28%, rgba(5,4,12,.6) 84%)
 *     × opacity P.vig = 0.59。周辺を沈めて星空・天の川の外縁を締める。
 *  ② focus-dim（フリップ連動の暗転）
 *     radial-gradient(circle at 50% 46%, transparent 30%, rgba(5,4,12,.55) 78%)
 *     × opacity = フリップ進捗 aProg × DIMV(0.94)。
 *     カードが裏返るほど背景が沈み、裏面テキストへ視線を集める。
 *
 * CSS の radial-gradient circle は終了半径が farthest-corner なので、
 * 中心から最遠コーナーまでの距離を半径にとる。
 * z順は参照どおり「調律陣より上・カードより下」に置くこと。
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import { useDerivedValue, SharedValue } from 'react-native-reanimated';

// 参照実装の定数
const VIG_OPACITY = 0.59; // P.vig
const DIMV = 0.94;        // dim.style.opacity = aProg * DIMV

export type BackdropDimProps = {
  width: number;
  height: number;
  /** カードの表面からの回転角（度・0=表 / 180=裏）。CardGL の rotationOut をそのまま渡す */
  rotationDeg?: SharedValue<number>;
};

export const BackdropDim: React.FC<BackdropDimProps> = ({ width: W, height: H, rotationDeg }) => {
  // フリップ進捗 aProg = 回転角/180 → 暗転の不透明度
  const dimOpacity = useDerivedValue(
    () => ((rotationDeg?.value ?? 0) / 180) * DIMV,
    [rotationDeg],
  );

  // farthest-corner 半径（中心が縦にずれているぶん下側コーナーが最遠）
  const vigC = vec(W * 0.5, H * 0.44);
  const vigR = Math.hypot(W * 0.5, H * 0.56);
  const dimC = vec(W * 0.5, H * 0.46);
  const dimR = Math.hypot(W * 0.5, H * 0.54);

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width: W, height: H }]} pointerEvents="none">
      {/* ① 常時ビネット */}
      <Group opacity={VIG_OPACITY}>
        <Circle c={vigC} r={vigR}>
          <RadialGradient
            c={vigC}
            r={vigR}
            colors={['rgba(5,4,12,0)', 'rgba(5,4,12,0.6)']}
            positions={[0.28, 0.84]}
          />
        </Circle>
      </Group>

      {/* ② フリップ連動の暗転 */}
      <Group opacity={dimOpacity}>
        <Circle c={dimC} r={dimR}>
          <RadialGradient
            c={dimC}
            r={dimR}
            colors={['rgba(5,4,12,0)', 'rgba(5,4,12,0.55)']}
            positions={[0.3, 0.78]}
          />
        </Circle>
      </Group>
    </Canvas>
  );
};

export default BackdropDim;
