/**
 * usePausableClock.ts — 本当に止まる時計
 * ------------------------------------------------------------------
 * 参照: FR_v98_layer_thermal_report_v2.pdf「② rAFループの非停止」
 *
 *   > 加えて visibilitychange のハンドラがコード全体でゼロ件です。
 *   > 画面OFF・アプリ背面でも全ループが継続します。
 *   > バックグラウンド再生中の消耗はここが直接の原因です。
 *   > if(!active) return; で中身をスキップするのではなく、
 *   > ループ自体を止める形に統一してください。
 *
 * Skia の `useClock()` は止められない。値を使う側で `stop` を見て計算を
 * スキップしても、時計自体は毎フレーム値を書き換えるため、それを購読する
 * derived value と Canvas は再描画され続ける。＝レポートが指摘する
 * 「中身をスキップするだけでループは回り続ける」状態そのもの。
 *
 * ここでは reanimated の useFrameCallback を使い、非アクティブ時は
 * setActive(false) でコールバック自体を外す。購読者への通知が止まるので
 * Skia の再描画も完全に停止する。
 *
 * FLUX RING は UIBackgroundModes:["audio"] でバックグラウンド再生する
 * アプリなので、背面に回ったあとも星と天の川を描き続けるのは
 * そのまま電池消耗と発熱になる。
 */

import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSharedValue, useFrameCallback, type SharedValue } from 'react-native-reanimated';

/** アプリが前面にあるか（background / inactive では false） */
export function useAppForeground(): boolean {
  const [active, setActive] = useState(() => AppState.currentState === 'active');
  useEffect(() => {
    const onChange = (s: AppStateStatus) => setActive(s === 'active');
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * 経過ミリ秒を返す時計。`active` が false の間はフレームコールバックごと
 * 外れるので、購読している derived value も Canvas も更新されない。
 *
 * 値は「動いていた時間の累計」。止めている間は進まないので、再開しても
 * 位相が飛ばない（＝再開の瞬間に星が一斉に明滅を切り替える「点滅」が出ない）。
 */
/** 1フレームで進める上限(ms)。再開直後の巨大な差分を吸収する */
const CLOCK_DT_MAX_MS = 50;

/**
 * 背景アニメの最小更新間隔(ms)。33 ≒ 30fps。
 *
 * 全画面 Canvas の再ラスタライズ回数は「時計が値を書いたフレーム数」と 1:1 で
 * 決まる（clock → 74/103本の derived → sksg の startMapper → picture の push →
 * RNSkPictureRenderer::setPicture → requestRedraw）。つまりここを間引けば、
 * 塗る回数がそのまま比例して減る。
 *
 * 30fps にするのは、この層が「ゆっくり流れる雲・またたく星・呼吸する光」しか
 * 持たないから。映画が24fpsで成立する種類の動きで、60fps である必要がない。
 * カードの操作（GL・ジェスチャ追従）はこの時計を使っていないので、手触りには
 * 一切影響しない。
 *
 * clock.value には端数を捨てずに累計を足すので、雲の流れる速さも星の明滅周期も
 * 変わらない。サンプリング点が半分になるだけ。
 */
export const AMBIENT_MIN_STEP_MS = 33;

export function usePausableClock(active: boolean, minStepMs = 0): SharedValue<number> {
  const clock = useSharedValue(0);
  // 間引き用の端数入れ。購読者がいない SharedValue なので、ここへ毎フレーム
  // 書いても mapper は 1 本も走らない＝Canvas は塗り直されない。
  const acc = useSharedValue(0);

  const tick = useCallback(
    (info: { timeSincePreviousFrame: number | null }) => {
      'worklet';
      // 「動いていた時間」だけを積む。以前は実時間（timeSinceFirstFrame）を
      // そのまま入れていたため、止めている間も時計は進み、再開した瞬間に
      // 位相が飛んでいた。星の明滅が一斉に切り替わるので、カードが正面へ
      // 戻った瞬間に画面がチカッと光って見えていた（実機で指摘）。
      const dt = Math.min(info.timeSincePreviousFrame ?? 1000 / 60, CLOCK_DT_MAX_MS);
      if (minStepMs <= 0) {
        clock.value += dt;
        return;
      }
      const a = acc.value + dt;
      if (a < minStepMs) {
        acc.value = a;
        return;
      }
      acc.value = 0;
      clock.value += a; // 端数を捨てない＝速度・位相は不変
    },
    [clock, acc, minStepMs],
  );

  // useCallback で固定しておかないと、再レンダーのたびに
  // unregister → register の scheduleOnUI 往復が入る。
  const frame = useFrameCallback(tick, false);

  useEffect(() => {
    frame.setActive(active);
    if (!active) acc.value = 0;
  }, [active, frame, acc]);

  return clock;
}

/**
 * 画面が前面にあり、かつ呼び出し側が止めていないときだけ進む時計。
 * 背景系コンポーネントはこれを使う。
 */
export function useBackdropClock(paused: boolean): {
  clock: SharedValue<number>;
  running: boolean;
} {
  const foreground = useAppForeground();
  const running = foreground && !paused;
  return { clock: usePausableClock(running, AMBIENT_MIN_STEP_MS), running };
}
