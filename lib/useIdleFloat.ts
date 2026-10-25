/**
 * useIdleFloat.ts — カードのアイドルフロート（v99-tsubasa）
 * ------------------------------------------------------------------
 * 参照: fr_v99_tsubasa.html 715行
 *   floatY += ((sin(now*0.00090) * 3.0 * damp) - floatY) * 0.055
 *
 * 「重い物ほどゆっくり漂う」を低振幅・長周期で表現し、さらに目標へ低速ラープ
 * させて慣性（遅れて追従する質量感）を出す。振幅はわずか ±3px だが、
 * 接地影が逆相で反応する（components/CardGround.tsx）ことで浮遊が読み取れる。
 *
 * damp は 0..1 の減衰係数。参照は dragging / carouselActive / 裏返し中に 0 へ
 * 収束させて演出の干渉を避けている。
 *
 * 移植ノート:
 *   参照は rAF ベースで係数 0.055 が 60fps 前提。そのまま移すと ProMotion
 *   (120Hz) で追従が 2 倍速くなり慣性が消えるため、フレームレート非依存へ
 *   直している: k = 1 - (1-0.055)^(dt*60)。60fps では元の値と一致する。
 */

import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useSharedValue, useFrameCallback, SharedValue } from 'react-native-reanimated';

/** 振幅(px)。参照 3.0 */
const AMP = 3.0;
/** 角速度(rad/ms)。参照 0.00090 → 周期 ≈ 6.98 秒 */
const OMEGA = 0.0009;
/** 60fps 基準の追従係数。参照 0.055 */
const LERP = 0.055;
/** 1フレームの dt 上限(秒)。復帰直後の巨大 dt で飛ぶのを防ぐ */
const DT_MAX = 0.05;

/**
 * @param damp 0..1 の減衰。0 でフロート停止（0 へ収束）
 * @returns floatY（px・正が下）。カードの translateY にそのまま渡す
 */
export function useIdleFloat(damp: SharedValue<number>, amplitude = AMP): SharedValue<number> {
  const floatY = useSharedValue(0);
  const reduced = useSharedValue(false);

  // reduce-motion → 静止（他の背景コンポーネントと同じ扱い）
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) reduced.value = v;
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduced.value = v;
    });
    return () => {
      mounted = false;
      // @ts-ignore RN のバージョンで remove() の有無が違う
      sub?.remove?.();
    };
  }, [reduced]);

  useFrameCallback((info) => {
    'worklet';
    const dt = Math.min((info.timeSincePreviousFrame ?? 1000 / 60) / 1000, DT_MAX);
    const target = reduced.value ? 0 : Math.sin(info.timestamp * OMEGA) * amplitude * damp.value;
    const k = 1 - Math.pow(1 - LERP, dt * 60);
    floatY.value += (target - floatY.value) * k;
  });

  return floatY;
}

export default useIdleFloat;
