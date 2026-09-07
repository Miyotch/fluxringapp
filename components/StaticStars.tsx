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
  ColorMatrix,
  Group,
  Image as SkiaImage,
  Path,
  Skia,
  type SkColor,
  type SkRSXform,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import type { Transforms3d } from '@shopify/react-native-skia';

import {
  STAR_COLOR,
  HALO_TUNE,
  stillOpacity,
  type LayerSpec,
  type SplitLayer,
  type TwinkleGroup,
} from './StarField';
import { makeGlowSprite, fullSprite, cachedImage, ATLAS_TINT } from '../lib/skiaSprites';
import type { SealInkImage } from './StarSeal';

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

// ══════ 調律陣のシルエットで星を削る ══════
//
// 星が調律陣より手前に見えるのは描画順の問題ではない（順序は BackdropSky →
// StarSeal で正しく、Android でも Skia Canvas は既定で TextureView ＝通常の
// View と同じペイント順に従う）。原因は濃度差で、彫刻の線は α 0.12〜0.34 の
// 薄い塗り、対して近景の星は α 0.84〜0.98 のほぼ不透明な白。薄い線は明るい星を
// 覆い隠せない（輝度 238 → 208 程度にしか落ちない）。
//
// 彫刻側を濃くすると見た目が変わってしまう（2026-09-07 に一度やって、線の両側に
// 暗い縁が付き「黒い線画」になった）。そこで **星の平面から彫刻の形を抜く**。
// 調律陣の Canvas には一切触れないので、彫刻の見え方は 1 ドットも変わらない。
//
//   dstOut: r = d * (1 - sa)   （BlendMode.d.ts:37）
//
// ── なぜ ColorMatrix で α を増幅するのか ──
// 焼いた ink 画像をそのまま使うと sa が薄すぎて効かない。極細線はアンチエイリアス
// で被覆が 0.5 前後しかないため、実効 α は 0.16 × 0.54 ≒ 0.086 ＝星は 91% 残る。
// 同じ絵を何回も重ねれば削れるが、全画面の転送を回数ぶん払うことになる。
// α だけを GAIN 倍してクランプすれば、1 回の転送で済み、しかもクランプ後も
// 被覆の比率は残るので形は鈍らない。
const SEAL_MASK_GAIN = 8;       // α の増幅率（min(1, α*GAIN) でクランプされる）
const SEAL_MASK_STRENGTH = 0.8; // 削りの上限。1 未満にして硬い切り欠きを避ける

// 4x5 カラーマトリクス。RGB は素通しで、α 行だけ GAIN 倍する
const SEAL_MASK_MATRIX = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, SEAL_MASK_GAIN, 0,
];

/**
 * 星より **あと**、かつ横パララックスの `<Group transform>` の **外** に置くこと。
 * マスクは画面に固定で、星の平面だけが横へ流れるため、中に入れると陣とずれて流れる。
 *
 * ink が null（MakeOffscreen が使えない端末）のときは何も描かない＝従来の見た目。
 */
export const SealOccluder: React.FC<{ ink?: SealInkImage }> = ({ ink }) => {
  if (!ink) return null;
  return (
    <SkiaImage
      image={ink.image}
      x={0}
      y={0}
      width={ink.width}
      height={ink.height}
      fit="fill"
      blendMode="dstOut"
      opacity={SEAL_MASK_STRENGTH}
    >
      <ColorMatrix matrix={SEAL_MASK_MATRIX} />
    </SkiaImage>
  );
};

export type StaticStarsProps = {
  width: number;
  height: number;
  /** StarField.splitLayers() の結果。ここでは still 側だけを描く */
  layers: SplitLayer[];
  bodyColor?: string;
  /**
   * 星の平面の横ずらし（BackdropSky が作る周期 W の巻き戻し済み transform）。
   *
   * ここへ SharedValue を渡した瞬間、この Canvas は「値が変わったフレームだけ」
   * 塗り直される側になる。上の但し書きの唯一の例外で、意図的に許している：
   *   ・値が動くのは横スワイプの最中だけ（指を離して整定したら止まる）
   *   ・止まっている間の塗り直し回数はこれまでどおりゼロ
   * ネイティブの transform（親 View をずらす）なら塗り直しゼロにできるが、
   * Android では Skia の Canvas が親の transform に付いてこない場合があり、
   * 実機で星が動かなかった。確実に効く Skia 内部の変換を採る。
   */
  transform?: SharedValue<Transforms3d>;
  /** 調律陣の彫刻シルエット。この Canvas の星からこの形を dstOut で抜く */
  occluder?: SealInkImage;
};

const StaticStarsImpl: React.FC<StaticStarsProps> = ({
  width: W,
  height: H,
  layers,
  bodyColor,
  transform,
  occluder,
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
        <Group transform={transform}>
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
        </Group>
        {/* 星を削る。パララックスの Group の外＝画面固定。この Canvas の星にだけ効く */}
        <SealOccluder ink={occluder} />
      </Canvas>
    ),
    [W, H, layers, bodyColor, transform, occluder],
  );

  return tree;
};

export const StaticStars = React.memo(StaticStarsImpl);

export default StaticStars;
