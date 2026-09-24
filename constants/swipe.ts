/**
 * swipe.ts — 「払う」の手応えをアプリ全体でそろえる（2026-09-24）
 * ------------------------------------------------------------------
 * 以前は HOME のカード、再生画面のカード、再生バナーで、送るのに必要な距離と
 * 速さがそれぞれ違い、動き方も違っていた（HOME は指について吸い付く、再生画面は
 * 傾きながら飛ぶ、バナーは動かない）。同じ指の動きで同じ結果になるよう、
 * 基準と寄せ方をここへ一本化する。
 *
 * 基準は HOME（岡さんの参照 fr_v98_FIX の値）:
 *   ・カード幅の 20% 動かしたら送る
 *   ・速く払ったとき（500px/秒 超）は、カード幅の 6% 動いていれば送る
 */

/** 送る距離（カード幅比） */
export const SWIPE_THRESH_R = 0.2;
/** 速く払ったときの最小の距離（カード幅比） */
export const SWIPE_FAST_MIN_R = 0.06;
/** 速く払ったとみなす速さ（px/秒） */
export const SWIPE_VEL = 500;

/**
 * 指を離したあとの寄せ。指を離したときの速さを引き継いで始まる
 * （velocity を渡す）。以前の決まった時間の動きは出だしが一番速く、
 * ゆっくり引いて離すと、離した瞬間にカードが急に吸い込まれていた。
 * 行き過ぎはしない（overshootClamping）。隣の札は ±2 枚までしか描いて
 * いないので、行き過ぎて外の札を見せないため。
 */
export const SWIPE_SPRING = {
  stiffness: 260,
  damping: 30,
  mass: 1,
  overshootClamping: true,
} as const;

/**
 * 送るかどうか。dx=指の移動(px)、vx=指の速さ(px/秒)、cardW=カード幅(px)。
 * 戻り値: 1=次へ（左へ払った） / -1=前へ（右へ払った） / 0=送らない
 */
export function swipeDirection(dx: number, vx: number, cardW: number): -1 | 0 | 1 {
  'worklet';
  const mag = Math.abs(dx);
  const fast = Math.abs(vx) > SWIPE_VEL && Math.sign(vx) === Math.sign(dx);
  if (mag >= cardW * SWIPE_THRESH_R || (fast && mag > cardW * SWIPE_FAST_MIN_R)) {
    return dx < 0 ? 1 : -1;
  }
  return 0;
}
