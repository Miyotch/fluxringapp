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
/**
 * 収束の打ち切り幅(px)。目標 0 のとき、これ未満になったら厳密に 0 を入れて
 * 下流への伝播を止める（指数収束は 0 に到達しないため）。
 */
const DEAD_BAND = 0.01;
/** 1フレームの dt 上限(秒)。復帰直後の巨大 dt で飛ぶのを防ぐ */
const DT_MAX = 0.05;

/**
 * @param damp 0..1 の減衰。0 でフロート停止（0 へ収束）
 * @param enabled false でフレームコールバックごと外す。damp=0 は「毎フレーム
 *   0 へ収束させ続ける」なのでループは回りっぱなしになる。カードを出さない
 *   画面では消費者（CardGround / ページャ）ごと居ないので、UI スレッドを毎フレーム
 *   起こす意味がない。lib/usePausableClock.ts と同じ setActive パターン。
 * @returns floatY（px・正が下）。カードの translateY にそのまま渡す
 */
export function useIdleFloat(
  damp: SharedValue<number>,
  enabled = true,
): SharedValue<number> {
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

  const frame = useFrameCallback((info) => {
    'worklet';
    const dt = Math.min((info.timeSincePreviousFrame ?? 1000 / 60) / 1000, DT_MAX);
    const target = reduced.value ? 0 : Math.sin(info.timestamp * OMEGA) * AMP * damp.value;
    const k = 1 - Math.pow(1 - LERP, dt * 60);
    const next = floatY.value + (target - floatY.value) * k;
    // 目標が 0（＝ドラッグ中・送り中・裏返し中）のとき、指数収束では厳密な 0 に
    // ならない。Reanimated の valueSetter は同値のときだけ短絡するので、
    // 微小な値が毎フレーム更新され続け、下流の mapper（接地影の全画面
    // 再描画・カードスロットの transform 更新）が永久に 60fps で走っていた。
    floatY.value = target === 0 && Math.abs(next) < DEAD_BAND ? 0 : next;
  }, enabled);

  useEffect(() => {
    frame.setActive(enabled);
    if (!enabled) floatY.value = 0;
  }, [enabled, frame, floatY]);

  return floatY;
}

export default useIdleFloat;
