/**
 * StaticStars.tsx — 明滅させない星と、その描き方の共通部品
 * ------------------------------------------------------------------
 * なぜ Canvas を分けるのか（2026-09-05）
 *
 * 2026-09-03 の発熱対策コミット（3ef239c）が突き止めたとおり、この画面の
 * 支配的なコストは「1枚あたり何画素塗るか」ではなく **全画面 Canvas を
 * 1秒に何回塗り直すか**。RN Skia は Canvas 単位でしか再描画できず、その回数は
 * 「時計が値を書いたフレーム数」と 1:1 で決まる。1回ごとに Canvas 全面の
 * clear、BackdropSky の全画面 saveLayer、焼き画像の全面ブリットという
 * **星の本数に比例しない固定費** が乗る。
 *
 * 裏を返すと、SharedValue を1本も参照しない Canvas は sksg が startMapper を
 * 張らないので、マウント時に 1 回ラスタライズしたきり二度と塗り直されない
 * （2026-09-03 d4c59c7 ④ で接地影を静的化したときと同じ根拠）。GPU から見れば
 * 以後はキャッシュ済みレイヤーの合成だけになる。
 *
 * つまり星は「数（密度）」と「動き（明滅）」を別の Canvas へ分けられる。
 *   ・密度  → この静的 Canvas。何個置いても毎フレームの仕事は増えない
 *   ・明滅  → BackdropSky の生きた Canvas。ここだけ本数を絞る
 * 発熱対策で減らすべきだったのは後者だけで、前者は減らし損だった。
 *
 * 振り分けの境界は StarField.tsx の LayerSpec.liveGroups。
 */

import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  Atlas,
  Canvas,
  Group,
  Path,
  Skia,
  type SkColor,
  type SkRSXform,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

import {
  STAR_COLOR,
  HALO_TUNE,
  stillOpacity,
  type LayerSpec,
  type SplitLayer,
  type TwinkleGroup,
} from './StarField';
import { makeGlowSprite, fullSprite, cachedImage, ATLAS_TINT } from '../lib/skiaSprites';

/** ハロースプライト一辺。芯 + 3σ がちょうど収まる比率を層ごとに計算する */
export const HALO_SPRITE_PX = 96;

/** 'r,g,b' と α から SkColor（Float32Array・0..1）を作る */
export function rgbaColor(rgb: string, a: number): SkColor {
  const [r, g, b] = rgb.split(',').map((v) => Number(v) / 255);
  return new Float32Array([r, g, b, a]);
}

/**
 * 星1群の描画（本体 = Path / ハロー = ガウス減衰スプライトの Atlas）。
 *
 * 明滅する群（BackdropSky の TwinkleLayer）と静的な群（下の StaticStars）で
 * 絵は完全に同じで、opacity に SharedValue を渡すか素の数値を渡すかだけが違う。
 * **この差がそのまま「毎フレーム塗り直すか、1回で凍るか」の差になる** ので、
 * 描画側は共通化して取り違えが起きないようにしておく。
 */
export const StarGroupPaint: React.FC<{
  g: TwinkleGroup;
  spec: LayerSpec;
  layerIndex: number;
  /** SharedValue を渡した瞬間、その Canvas は毎フレーム再ラスタライズされる */
  opacity: number | SharedValue<number>;
  bodyColor?: string;
}> = ({ g, spec, layerIndex, opacity, bodyColor = STAR_COLOR }) => {
  // ハロー = box-shadow '0 0 Bpx'（B = 星径 × spec.halo、σ = B/2）。
  // 星径 = 芯半径 × 2 なので σ / 芯半径 = spec.halo。
  // 芯 + 3σ がスプライトへ収まる比率を逆算する。
  const halo = useMemo(() => {
    if (spec.halo <= 0) return null;
    const coreRatio = 1 / (1 + 3 * spec.halo);
    let core = (HALO_SPRITE_PX / 2) * coreRatio;
    const image = cachedImage(`starHalo${layerIndex}`, () => {
      const made = makeGlowSprite(HALO_SPRITE_PX, coreRatio, spec.halo);
      core = made.core;
      return made.image;
    });
    return image ? { image, core, size: HALO_SPRITE_PX } : null;
  }, [spec.halo, layerIndex]);

  const haloRect = useMemo(() => fullSprite(halo?.image ?? null), [halo]);
  const haloSprites = useMemo(
    () => (halo ? g.halos.map(() => haloRect) : []),
    [halo, g.halos, haloRect],
  );
  // ハローの位置・大きさは不動なので起動時に確定（毎フレームの割当ゼロ）
  const haloTransforms = useMemo<SkRSXform[]>(() => {
    if (!halo) return [];
    const k = halo.size / halo.core;
    return g.halos.map((h) => {
      // h.r は「星半径 + box-shadow の B」で作られた視覚半径。
      // ここでは芯 = 星半径に合わせたいので星半径へ戻す。
      const starR = h.r / (1 + 2 * spec.halo);
      const side = starR * k;
      return Skia.RSXform(side / halo.size, 0, h.x - side / 2, h.y - side / 2);
    });
  }, [halo, g.halos, spec.halo]);

  const haloColors = useMemo<SkColor[] | undefined>(() => {
    if (!halo) return undefined;
    const col = rgbaColor(spec.haloRGB, spec.haloA * HALO_TUNE);
    return g.halos.map(() => col);
  }, [halo, g.halos, spec.haloRGB, spec.haloA]);

  return (
    <Group opacity={opacity}>
      {halo?.image && haloTransforms.length > 0 && (
        <Atlas
          image={halo.image}
          sprites={haloSprites}
          transforms={haloTransforms}
          colors={haloColors}
          colorBlendMode={ATLAS_TINT}
        />
      )}
      {/* 星本体。サブピクセル径なので Path のアンチエイリアスに任せる。
          層0 には参照の filter:blur(0.4px) を BlurMask で復元していたが、発熱対策で
          撤去した（2026-08-21）。DPR3 実機ではほぼ視認できない差 */}
      <Path path={g.path} color={bodyColor} />
    </Group>
  );
};

export type StaticStarsProps = {
  width: number;
  height: number;
  /** StarField.splitLayers() の結果。ここでは still 側だけを描く */
  layers: SplitLayer[];
  bodyColor?: string;
};

const StaticStarsImpl: React.FC<StaticStarsProps> = ({
  width: W,
  height: H,
  layers,
  bodyColor,
}) => {
  // ── この Canvas に SharedValue を持ち込まないこと ──────────────
  // opacity は stillOpacity() が返す素の数値。clock も paused も参照しない。
  // 1つでも SharedValue を混ぜると sksg/Container が startMapper を張り、
  // 全画面 Canvas が毎フレーム塗り直される側へ落ちる。ここが崩れると
  // 「星を増やしても毎フレームの仕事は増えない」という前提ごと壊れる。
  //
  // ツリーも useMemo で固定する。RN Skia の <Canvas> は children の要素同一性が
  // 変わると redraw() → stopMapper → recorder 再構築 → 全ノード再走査が走るため。
  const tree = useMemo(
    () => (
      <Canvas style={[StyleSheet.absoluteFill, { width: W, height: H }]} pointerEvents="none">
        {layers.map((l) =>
          l.still.map((g, gi) => (
            <StarGroupPaint
              key={`${l.layerIndex}-${gi}`}
              g={g}
              spec={l.spec}
              layerIndex={l.layerIndex}
              opacity={stillOpacity(g)}
              bodyColor={bodyColor}
            />
          )),
        )}
      </Canvas>
    ),
    [W, H, layers, bodyColor],
  );

  return tree;
};

export const StaticStars = React.memo(StaticStarsImpl);

export default StaticStars;
