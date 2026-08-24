/**
 * BackdropVeil.tsx — ホーム背景ブロック D の上半分（減光・粒状感の3層）
 * ------------------------------------------------------------------
 * 参照 v99 の対応レイヤー（いずれもカードより下・調律陣より上）:
 *   .bgvig      常時ビネット   静的 radial × opacity 0.59（P.vig）
 *   #bggrain    空気の粒       140px の SVG ノイズを background-repeat × 0.05
 *
 * ※ .focus-dim（フリップ連動の暗転）は撤去した。参照 v98 の 3D ビューは
 *   回転中に背景を暗くしない（駆動元の aProg は 2D フリップ用で 0 固定）。
 *
 * 参照ではこの 2 層とも「一度描いたら opacity しか動かない」ため実質コスト 0。
 * アプリでは減光と粒状感で 2 枚の Canvas に分かれていたので
 * 1 枚へ畳んだ。
 *
 * 粒（#bggrain）について:
 *   これまで <FractalNoise> を全画面へ敷いていた。単独 Canvas で静止している
 *   間は一度きりの評価で済むが、focus-dim（カード回転連動）と同じ Canvas へ
 *   入れると、カードを裏返すたびに全画面ぶんのプロシージャルノイズが毎フレーム
 *   評価されてしまう。参照と同じ「140px を 1 枚焼いて敷き詰める」へ変更した。
 *   焼けなかった環境では従来どおり <FractalNoise> へフォールバックする。
 */

import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  ColorMatrix,
  FractalNoise,
  Group,
  Image as SkiaImage,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';

import { makeNoiseTile, cachedImage } from '../lib/skiaSprites';

// ── 参照実装の定数 ──
const VIG_OPACITY = 0.59; // P.vig

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

export type BackdropVeilProps = {
  width: number;
  height: number;
  /** 粒の濃さ。既定 0.05（参照値）。実機の暗部の出方で 0.04〜0.07 が調整幅 */
  grainOpacity?: number;
};

const BackdropVeilImpl: React.FC<BackdropVeilProps> = ({
  width: W,
  height: H,
  grainOpacity = GRAIN_OPACITY,
}) => {
  // CSS の radial-gradient circle は終了半径が farthest-corner。
  // 中心が縦にずれているぶん、下側コーナーが最遠になる。
  const vigC = vec(W * 0.5, H * 0.44);
  const vigR = Math.hypot(W * 0.5, H * 0.56);

  const grainTile = useMemo(
    () => cachedImage('grainTile', () => makeNoiseTile(TILE, FREQ, OCTAVES, DESATURATE)),
    [],
  );
  // 焼いたタイルを敷き詰めるための行列（左上から TILE 刻み）
  const grainCells = useMemo(() => {
    if (!grainTile) return [];
    const cols = Math.ceil(W / TILE);
    const rows = Math.ceil(H / TILE);
    const out: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) out.push({ x: c * TILE, y: r * TILE });
    }
    return out;
  }, [grainTile, W, H]);

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width: W, height: H }]} pointerEvents="none">
      {/* ① .bgvig — 常時ビネット（静的） */}
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

      {/* ② .focus-dim は撤去。
          参照 v98 の 3D ビューは回転中に背景を暗くしない（dim.style.opacity を
          駆動する aProg は 2D フリップ用で、3D 版が居る限り 0 固定・693/731行）。
          アプリ独自の追加演出だったが、SharedValue が1つでも生きていると
          この全画面 Canvas が毎フレーム再記録＋再ラスタライズされる
          （clear＋ビネット＋dim＋グレイン21枚 ≒ 9.8Mpx/フレーム）。
          外したことで、この層は SharedValue を1つも持たない完全な静的
          レイヤーになり、再描画コストが恒久的にゼロになる。 */}

      {/* ③ #bggrain — 空気の粒。140px タイルの敷き詰め（参照と同じ作り） */}
      <Group opacity={grainOpacity}>
        {grainTile ? (
          grainCells.map((cell, i) => (
            <SkiaImage
              key={i}
              image={grainTile}
              x={cell.x}
              y={cell.y}
              width={TILE}
              height={TILE}
              fit="fill"
            />
          ))
        ) : (
          // タイルを焼けなかった環境のみ、従来のプロシージャル評価へ
          <Rect x={0} y={0} width={W} height={H}>
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
        )}
      </Group>
    </Canvas>
  );
};


// React.memo で包む。DiscoverScreen が再レンダーすると、素の FC のままでは
// children の要素ツリーが作り直され、RN Skia の Canvas が
// stopMapper → recorder 再構築 → 全ノード再 push（sksg/Container.native.ts）
// を丸ごとやり直す。フリップの開始・終了はまさにその瞬間なので、
// 一番引っかかってほしくないタイミングで最大のコストが乗っていた。
export const BackdropVeil = React.memo(BackdropVeilImpl);

export default BackdropVeil;
