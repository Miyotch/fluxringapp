/**
 * shuffle.ts — 配列をランダムな順に並べ替える（Fisher–Yates）
 * ------------------------------------------------------------------
 * 元の配列は変更しない（新しい配列を返す）。
 */

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
