/**
 * BackdropSky.tsx — ホーム背景ブロック D の下半分（地色＋天の川＋点滅星）
 * ------------------------------------------------------------------
 * 参照 fr_v98-2_FIX.html / fr_v99_tsubasa.html の対応レイヤー
 * （背景ブロックはこの 2 ファイルでバイト単位一致。「v84の既存背景は無改変」）:
 *
 *   .bgbase   地色      静的（radial-gradient・painted once）
 *   #nebBand  天の川    Canvas2D・雲36（blur 13px・加算）＋ 星520（シャープ）
 *   .bgstars  点滅星    DOM 479要素・CSS keyframes（box-shadow のハロー付き）
 *   .bgaura   無効      opacity:0!important → **移植しない**
 *
 * 旧 NebulaBand.tsx + StarField.tsx の 2 枚の Canvas を 1 枚に畳んでいる。
 *
 * ── 描画方式の使い分け（2026-08-18 実機検証で確定） ──
 *
 * 星本体は **Path で描く**。半径 0.35〜1.5px のサブピクセル図形なので、
 * スプライトを Atlas で縮小描画すると縮小時のアンチエイリアスが効かず、
 * 淡いはずの星が硬い点になって「中央に星が多すぎる」見えになった。
 * Skia の Path はサブピクセル円を正しくアンチエイリアスする。
 *   ※星の個数・分布は参照と一致を実測済み（アプリ400/参照平均413.8、
 *     中央40-60%帯はアプリ132/参照140.1）。差は数ではなく描画方式だった。
 *
 * 雲とハローは **Atlas で描く**。こちらは数十〜百px級で拡大方向のため
 * スプライトが破綻せず、放射グラデのシェーダ再生成を毎フレーム避けられる。
 *
 * ── 参照へ寄せた点 ──
 *
 * ① ハローをガウス減衰へ（③として計画したぶん）
 *    参照は box-shadow '0 0 Bpx'（σ = B/2 のガウス）。線形の RadialGradient で
 *    近似していたため裾が急に切れて輪郭が立っていた。MaskFilter.MakeBlur で
 *    正確に焼く。σ/芯半径 = spec.halo（層1=1.3 / 層2=2.2）。
 *
 * ② 雲の blur(13px) をスプライトへ焼き込み
 *    参照は各雲の塗りに個別へ blur をかける。ガウスは線形なので「合成後に
 *    ぼかす」＝「各雲をぼかしてから合成」。実行時の全画面 saveLayer は不要。
 *
 * ③ 遠景 317 星の filter:blur(0.4px)
 *    一度 BlurMask で復元したが、発熱対策で撤去した（下の Path のコメント参照）。
 *    参照は静的 DOM への CSS filter で毎フレームのコストがゼロなのに対し、
 *    BlurMask は毎フレーム全画面規模のマスクぼかしを 8 群ぶん発生させていた。
 *
 * ④ 合成は内側 plus（参照 globalCompositeOperation='lighter'）＋
 *    レイヤー全体 screen（参照 canvas の mix-blend-mode:screen）。
 *
 * 明滅の群量子化について:
 *   参照は星ごとに独立して明滅するが、最も目立つ層2（36個）は移植当初から
 *   1星1群＝実質個別だった。層0(317)/層1(126)は輝度 0.08〜0.26 と淡く、
 *   群にまとめても知覚差が出ない。derived value 数を抑える利点が勝るため
 *   群方式（8/12/36・天の川16）を維持する。
 *
 * 未移植（意図的・2026-08-17 判断）:
 *   ・カードのフリップ量に連動する横パララックス（参照 animateBG の
 *     translateX(shift*-7)）
 */

import React, { useMemo, useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import {
  Atlas,
  Canvas,
  Circle,
  Group,
  Paint,
  Path,
  RadialGradient,
  Skia,
  vec,
  type SkRSXform,
  type SkColor,
} from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { useBackdropClock } from '../lib/usePausableClock';

import {
  buildClouds,
  buildStarGroups,
  REF_W,
  type Cloud,
  type NebStarGroup,
} from './NebulaBand';
import {
  buildLayers,
  STAR_COLOR,
  HALO_TUNE,
  type BuiltLayer,
  type TwinkleGroup,
  type LayerSpec,
} from './StarField';
import {
  makeGlowSprite,
  makeBlurredRadialSprite,
  fullSprite,
  cachedImage,
  ATLAS_TINT,
} from '../lib/skiaSprites';

// ══════ 実機診断用スイッチ（確認が済んだら全て既定値へ戻すこと） ══════
// 参照との差を目で詰めるとき、どの層が原因かを 1 層ずつ切って絞り込む。
const DEBUG_SKY = {
  /** true = bgstars を赤く塗る。新コードが端末へ届いているかの確認用 */
  proofOfLife: false,
  showBase: true,
  showNebula: true,
  showStars: true,
};
const PROOF_COLOR = 'rgb(255,40,40)';

// ── 雲スプライト（起動時に 1 回だけ焼く） ──
/** ぼかしの伸びしろを取るため芯は 60%、残り 40% がぼけ代 */
const CLOUD_SPRITE_PX = 256;
const CLOUD_CORE_RATIO = 0.6;
/**
 * 雲スプライト座標での σ。
 * 参照は画面座標で blur(13px)。雲の実半径は 70〜190（×scale）で、代表値を
 * 130 とすると σ_sprite = 13 × (芯半径 / 130)。芯半径 = 256/2*0.6 = 76.8 なので
 * σ ≈ 7.7。雲の大小でぼかし量が ±30% ほどぶれるが、低不透明の背景層なので
 * 知覚差にはならない（気になれば大中小 3 枚に分ける）。
 */
// 代表半径は 130 ではなく 150 を採る。1枚のスプライトを拡縮しているので
// σ は雲の半径に比例してしまい、大きい雲（r≈190）が 1.5 倍ぼける。中央の
// 明るさは大きい雲が作るため、過ぼかしがそのまま中心の輝度低下になる。
const CLOUD_SIGMA = (13 * ((CLOUD_SPRITE_PX / 2) * CLOUD_CORE_RATIO)) / 150;

/**
 * 雲の濃度の全体倍率。
 * 参照と実機を並べて測ったところ、中央発光部の輝度がアプリ 85.4 / 参照 110.2
 * と約 23% 低かった（全体・暗部はほぼ一致）。雲は帯の中央に密集するので、
 * ここを上げると中心がいちばん強く持ち上がる。
 * 2026-08-18 ユーザー指示「真ん中をもっと光らせてよい」。
 */
const CLOUD_GAIN = 1.3;

/** ハロースプライト一辺。芯 + 3σ がちょうど収まる比率を層ごとに計算する */
const HALO_SPRITE_PX = 96;

/** 雲のグラデ停止点（参照 loop(): addColorStop 0 / 0.42 / 1） */
const CLOUD_STOPS = [
  { at: 0, color: 'rgba(255,255,255,1)' },
  { at: 0.42, color: 'rgba(255,255,255,0.5)' },
  { at: 1, color: 'rgba(255,255,255,0)' },
];

/** 'r,g,b' と α から SkColor（Float32Array・0..1）を作る */
function rgbaColor(rgb: string, a: number): SkColor {
  const [r, g, b] = rgb.split(',').map((v) => Number(v) / 255);
  return new Float32Array([r, g, b, a]);
}

// ══════ 天の川の雲（Atlas で 36 個を 1 ドローに束ねる） ══════
const CloudAtlas: React.FC<{
  clouds: Cloud[];
  W: number;
  H: number;
  scale: number;
  clock: SharedValue<number>;
  stop: SharedValue<boolean>;
}> = ({ clouds, W, H, scale, clock, stop }) => {
  const sprite = useMemo(() => {
    let core = 0;
    let size = CLOUD_SPRITE_PX;
    const image = cachedImage('cloudSpriteBlurred', () => {
      const made = makeBlurredRadialSprite(
        CLOUD_SPRITE_PX,
        CLOUD_CORE_RATIO,
        CLOUD_STOPS,
        CLOUD_SIGMA,
      );
      core = made.core;
      size = made.size;
      return made.image;
    });
    // キャッシュヒット時は焼き関数が走らないので幾何値を計算し直す
    if (!core) core = (CLOUD_SPRITE_PX / 2) * CLOUD_CORE_RATIO;
    return { image, core, size };
  }, []);

  const rect = useMemo(() => fullSprite(sprite.image), [sprite.image]);
  const sprites = useMemo(() => clouds.map(() => rect), [clouds, rect]);
  const base = useMemo(
    () => clouds.map((c) => [c.c[0] / 255, c.c[1] / 255, c.c[2] / 255] as const),
    [clouds],
  );
  /** 芯半径 r で描くには、スプライト全体を r × (size/core) の正方形へ拡大する */
  const spriteScale = sprite.size / sprite.core;

  // 参照 loop(): 横ドリフト・縦ドリフト・膨縮（式はそのまま）
  const transforms = useDerivedValue<SkRSXform[]>(() => {
    const t = stop.value ? 0 : clock.value / 1000;
    return clouds.map((c) => {
      const cx = ((c.bx + c.dr * 9 * Math.sin(t * c.w1 + c.ph)) / 100) * W;
      const cy = ((c.by + 5 * Math.sin(t * c.w2 + c.ph + 2.0)) / 100) * H;
      const r = c.r * scale * (1 + 0.22 * Math.sin(t * c.w1 * 0.7 + c.ph + 4.0));
      const side = r * spriteScale;
      return Skia.RSXform(side / sprite.size, 0, cx - side / 2, cy - side / 2);
    });
  }, [clock]);

  // 参照 loop(): 濃淡呼吸
  const colors = useDerivedValue<SkColor[]>(() => {
    const t = stop.value ? 0 : clock.value / 1000;
    return clouds.map((c, i) => {
      const a =
        c.a * CLOUD_GAIN * (0.66 + 0.34 * (0.5 + 0.5 * Math.sin(t * c.w2 * 0.9 + c.ph + 1.0)));
      const [r, g, b] = base[i];
      return new Float32Array([r, g, b, Math.min(1, a)]);
    });
  }, [clock]);

  if (!sprite.image) return null;
  return (
    <Atlas
      image={sprite.image}
      sprites={sprites}
      transforms={transforms}
      colors={colors}
      colorBlendMode={ATLAS_TINT}
      blendMode="plus"
    />
  );
};

// ══════ 天の川の星 1 群（520個を16群・参照どおりシャープな Path） ══════
const NebStarLayer: React.FC<{
  g: NebStarGroup;
  clock: SharedValue<number>;
  stop: SharedValue<boolean>;
}> = ({ g, clock, stop }) => {
  const opacity = useDerivedValue(() => {
    const t = stop.value ? 0 : clock.value / 1000;
    return g.b * (0.16 + 0.84 * (0.5 + 0.5 * Math.sin(t * g.f + g.ph)));
  }, [clock]);
  return <Path path={g.path} color="rgb(200,214,252)" opacity={opacity} blendMode="plus" />;
};

// ══════ bgstars の 1 群（本体 = Path / ハロー = Atlas のガウス減衰） ══════
const TwinkleLayer: React.FC<{
  g: TwinkleGroup;
  spec: LayerSpec;
  layerIndex: number;
  scale: number;
  clock: SharedValue<number>;
  stop: SharedValue<boolean>;
}> = ({ g, spec, layerIndex, scale, clock, stop }) => {
  const opacity = useDerivedValue(() => {
    // 停止時は谷 = 基輝度で静止（参照の初期 style.opacity = o0 と同じ）
    if (stop.value) return g.o0;
    const t = clock.value / 1000;
    return g.o0 + (g.o1 - g.o0) * (0.5 - 0.5 * Math.cos((t + g.ph) * g.w));
  }, [clock]);

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

  const bodyColor = DEBUG_SKY.proofOfLife ? PROOF_COLOR : STAR_COLOR;

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
          撤去した。各群の星は画面全域に散っておりパスのバウンズが実質フルスクリーン
          なので、「マスク生成→ぼかし→合成」が毎フレーム 8 群ぶん走っていた。参照側は
          静的 DOM に CSS filter を一度当てるだけで毎フレームのコストはゼロ。
          0.4px は DPR3 実機ではほぼ視認できない差なので、素の AA に委ねる */}
      <Path path={g.path} color={bodyColor} />
    </Group>
  );
};

export type BackdropSkyProps = {
  width: number;
  height: number;
  /** ホーム以外を表示している間は true にして明滅を止める（参照 __frSealPause 相当） */
  paused?: boolean;
};

const BackdropSkyImpl: React.FC<BackdropSkyProps> = ({
  width: W,
  height: H,
  paused = false,
}) => {
  const scale = W / REF_W;

  // reduce-motion → 静止画（他の背景コンポーネントと同じ扱い）
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      // @ts-ignore RN のバージョン差で remove の有無が変わる
      sub?.remove?.();
    };
  }, []);

  // 背面（バックグラウンド再生中）やホーム以外では時計ごと止める。
  // 参照レポート② の「if(!active) return; ではなくループ自体を止める」に対応。
  const { clock } = useBackdropClock(paused || reduced);
  const stop = useSharedValue(false);
  useEffect(() => {
    // paused（フリップ中の一時停止）では「止まった見た目」へ切り替えない。
    // stop=true にすると雲も星も t=0 の姿へ飛び、光点は画面外へ退避するため、
    // 止めた瞬間と再開した瞬間の両方でガクッと切り替わって見える。
    // 時計が止まっていれば値は最後の状態で凍るので、それで十分。
    // ここを立てるのは reduce-motion（意図的に動きを消す設定）のときだけ。
    stop.value = reduced;
  }, [reduced, stop]);

  const clouds = useMemo(buildClouds, []);
  const nebStarGroups = useMemo(() => buildStarGroups(W, H), [W, H]);
  const starLayers = useMemo<BuiltLayer[]>(() => buildLayers(W, H), [W, H]);

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width: W, height: H }]} pointerEvents="none">
      {/* ── .bgbase: radial(125% 95% at 50% 28%) #15132e → #0c0a1f → #07060f ──
          横 rx=1.25W の正円を縦に 0.95H/1.25W へ圧縮して楕円化（静的） */}
      {DEBUG_SKY.showBase && (
        <Group
          transform={[
            { translateX: W / 2 },
            { translateY: H * 0.28 },
            { scaleY: (H * 0.95) / (W * 1.25) },
            { translateX: -W / 2 },
            { translateY: -H * 0.28 },
          ]}
        >
          <Circle cx={W / 2} cy={H * 0.28} r={W * 1.25}>
            <RadialGradient
              c={vec(W / 2, H * 0.28)}
              r={W * 1.25}
              colors={['#15132e', '#0c0a1f', '#07060f']}
              positions={[0, 0.55, 1]}
            />
          </Circle>
        </Group>
      )}

      {/* ── #nebBand: 内側は加算合成、レイヤー全体を screen で載せる ──
          参照は canvas 内が globalCompositeOperation='lighter'、canvas 自体が
          mix-blend-mode:screen。雲のぼかしはスプライトへ焼き込み済みなので
          ここでの ImageFilter は不要（saveLayer は合成のためだけ） */}
      {DEBUG_SKY.showNebula && (
        <Group layer={<Paint blendMode="screen" />}>
          <CloudAtlas clouds={clouds} W={W} H={H} scale={scale} clock={clock} stop={stop} />
          {nebStarGroups.map((g, i) => (
            <NebStarLayer key={i} g={g} clock={clock} stop={stop} />
          ))}
        </Group>
      )}

      {/* ── .bgstars: 遠近3層479星。遠景→近景の順（参照の DOM 生成順） ── */}
      {DEBUG_SKY.showStars &&
        starLayers.map((l, li) =>
          l.groups.map((g, gi) => (
            <TwinkleLayer
              key={`${li}-${gi}`}
              g={g}
              spec={l.spec}
              layerIndex={li}
              scale={scale}
              clock={clock}
              stop={stop}
            />
          )),
        )}
    </Canvas>
  );
};


// React.memo で包む。DiscoverScreen が再レンダーすると、素の FC のままでは
// children の要素ツリーが作り直され、RN Skia の Canvas が
// stopMapper → recorder 再構築 → 全ノード再 push（sksg/Container.native.ts）
// を丸ごとやり直す。フリップの開始・終了はまさにその瞬間なので、
// 一番引っかかってほしくないタイミングで最大のコストが乗っていた。
export const BackdropSky = React.memo(BackdropSkyImpl);

export default BackdropSky;
