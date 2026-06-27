/**
 * StarBurst.tsx — FLUX RING 星の一斉点火の参照実装
 * ------------------------------------------------------------------
 * 何を: ある起点(originX/Y)から、カードの縁(edgeRadius)の外へ向けて多数の「星」が
 *       一斉に飛び散り、伸びて・瞬いて・消える演出。購入や達成の瞬間に重ねる。
 *
 * 使い方: 全画面に敷く Canvas。ref.trigger() で点火する。
 *   const ref = useRef<StarBurstHandle>(null);
 *   <StarBurst ref={ref} width={W} height={H} originX={cx} originY={cy} edgeRadius={r} />
 *   ref.current?.trigger();
 *
 * 実装方針: 各星の角度・距離・サイズ・遅延は生成時に一度だけ確定（useMemo）。
 *   点火は単一の SharedValue progress(0→1) を走らせ、各星はそれを派生(useDerivedValue)して
 *   位置・不透明度・大きさを計算する。JS を跨がず UI スレッドだけで動く。
 *
 * 実機調整ポイント:
 *   - COUNT: 星の数。多いほど豪華だが負荷増。既定 28。
 *   - reach: 飛距離の倍率。画面サイズに対して広げたいなら増やす。
 *   - duration: 1点火の長さ ms。
 *   - README 注記: バージョンによっては Skia の Atlas(colors) で一括描画する方が軽い。
 *     ここでは可読性優先で <Circle> を個別描画している。
 *
 * 依存: @shopify/react-native-skia, react-native-reanimated
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
} from 'react';
import { Canvas, Group, Circle } from '@shopify/react-native-skia';
import {
  useSharedValue,
  withTiming,
  Easing,
  useDerivedValue,
} from 'react-native-reanimated';

export type StarBurstHandle = {
  /** 点火する。再呼び出しで何度でも再生できる */
  trigger: () => void;
};

export type StarBurstProps = {
  /** 敷く Canvas の幅/高さ（通常は画面サイズ） */
  width: number;
  height: number;
  /** 飛び散りの起点（通常はカード中心） */
  originX: number;
  originY: number;
  /** カードの縁の半径。星はこの外側から見え始める */
  edgeRadius: number;
  /** 星の数（既定 28） */
  count?: number;
  /** 飛距離の倍率。edgeRadius からの追加距離に掛かる（既定 1） */
  reach?: number;
  /** 1点火の長さ ms（既定 950） */
  duration?: number;
  /** 星の色（既定 シアン白） */
  color?: string;
};

type Star = {
  angle: number; // 飛ぶ方向(rad)
  dist: number; // 縁からの最終到達距離
  size: number; // 半径
  delay: number; // 0..1 の出遅れ
  twinkle: number; // 瞬きの位相
};

// ease-out（速く出て減速）。worklet 内で使うため純関数で定義。
function easeOut(t: number) {
  'worklet';
  return 1 - Math.pow(1 - t, 3);
}

/** 1個の星。progress を派生して自分の状態を計算する */
const StarDot: React.FC<{
  star: Star;
  originX: number;
  originY: number;
  edgeRadius: number;
  reach: number;
  color: string;
  progress: { value: number };
}> = ({ star, originX, originY, edgeRadius, reach, color, progress }) => {
  // 各星のローカル進行度（delay を引いて 0..1 にクランプ）
  const local = useDerivedValue(() => {
    'worklet';
    const span = 1 - star.delay;
    const p = (progress.value - star.delay) / (span <= 0 ? 1 : span);
    return Math.max(0, Math.min(1, p));
  });

  const cx = useDerivedValue(() => {
    'worklet';
    const d = edgeRadius + star.dist * reach * easeOut(local.value);
    return originX + Math.cos(star.angle) * d;
  });

  const cy = useDerivedValue(() => {
    'worklet';
    const d = edgeRadius + star.dist * reach * easeOut(local.value);
    return originY + Math.sin(star.angle) * d;
  });

  const opacity = useDerivedValue(() => {
    'worklet';
    const t = local.value;
    if (t <= 0 || t >= 1) return 0;
    // 立ち上がりで点灯、後半でフェードアウト。微妙な瞬きを足す。
    const fade = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
    const tw = 0.75 + 0.25 * Math.sin(t * 18 + star.twinkle);
    return Math.max(0, fade * tw);
  });

  const r = useDerivedValue(() => {
    'worklet';
    // 出た直後が一番大きく、進むにつれてやや縮む
    return star.size * (0.6 + 0.4 * (1 - local.value));
  });

  return <Circle cx={cx} cy={cy} r={r} color={color} opacity={opacity} />;
};

export const StarBurst = forwardRef<StarBurstHandle, StarBurstProps>(
  (
    {
      width,
      height,
      originX,
      originY,
      edgeRadius,
      count = 28,
      reach = 1,
      duration = 950,
      color = 'rgba(220,245,250,1)',
    },
    ref
  ) => {
    const progress = useSharedValue(0);

    // 星の配置は生成時に一度だけ確定（点火ごとに位置が変わらないよう固定）。
    const stars = useMemo<Star[]>(() => {
      const maxReach = Math.max(width, height) * 0.5;
      return Array.from({ length: count }, (_, i) => {
        // 角度はほぼ等間隔＋ゆらぎで自然なばらつきにする
        const base = (i / count) * Math.PI * 2;
        const jitter = (Math.random() - 0.5) * (Math.PI / count) * 1.6;
        return {
          angle: base + jitter,
          dist: maxReach * (0.35 + Math.random() * 0.65),
          size: 1.4 + Math.random() * 2.6,
          delay: Math.random() * 0.18,
          twinkle: Math.random() * Math.PI * 2,
        };
      });
    }, [count, width, height]);

    useImperativeHandle(
      ref,
      () => ({
        trigger: () => {
          progress.value = 0;
          progress.value = withTiming(1, {
            duration,
            easing: Easing.out(Easing.quad),
          });
        },
      }),
      [progress, duration]
    );

    return (
      <Canvas
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
        }}
        pointerEvents="none"
      >
        <Group>
          {stars.map((star, i) => (
            <StarDot
              key={i}
              star={star}
              originX={originX}
              originY={originY}
              edgeRadius={edgeRadius}
              reach={reach}
              color={color}
              progress={progress}
            />
          ))}
        </Group>
      </Canvas>
    );
  }
);

StarBurst.displayName = 'StarBurst';

/**
 * 代替案（Skia バージョン差への保険・README 注記）:
 *   多数の星を軽く描くなら <Atlas> で 1枚のスプライトをまとめて描画できる。
 *   transforms(rstXform) と colors(各星の明るさ) を SharedValue で渡す形になるが、
 *   Skia のバージョンによって colors の扱いが変わるため、まず本実装(個別 Circle)で
 *   見た目を確定し、負荷が問題になったら Atlas へ置き換えるのが安全。
 */
