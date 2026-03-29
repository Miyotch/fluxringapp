/**
 * Figmaアセットのプリロード & キャッシュ
 */

const base = import.meta.env.BASE_URL

const cache = new Map<string, HTMLImageElement>()

function load(src: string): Promise<HTMLImageElement> {
  const cached = cache.get(src)
  if (cached) return Promise.resolve(cached)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      cache.set(src, img)
      resolve(img)
    }
    img.onerror = reject
    img.src = src
  })
}

export function getImage(src: string): HTMLImageElement | null {
  return cache.get(src) ?? null
}

export const SPHERE_SRC = `${base}sphere.png`
export const KNOB_SRC = `${base}knob.png`
export const RING_BEZEL_SRC = `${base}ring-bezel.png`
export const RING_OVERLAY_SRC = `${base}ring-overlay.png`
export const RING_LEVELS_SRC = `${base}ring-levels.png`

/** ほわほわバリアント (Figmaから直接エクスポート) — バリアント5(1層)→バリアント1(5層) */
export const HOWAHOWA_SRCS = [
  `${base}howahowa-5.png`, // Level 1 (amplitude低) — 1層
  `${base}howahowa-4.png`, // Level 2 — 2層
  `${base}howahowa-3.png`, // Level 3 — 3層
  `${base}howahowa-2.png`, // Level 4 — 4層
  `${base}howahowa-1.png`, // Level 5 (amplitude高) — 5層
] as const

/** 光のアニメーション (Figmaから直接エクスポート) — 3バリアント */
export const LIGHT_ANIM_SRCS = [
  `${base}light-anim-1.png`,
  `${base}light-anim-2.png`,
  `${base}light-anim-3.png`,
] as const

/** 全アセットをプリロード。アプリ起動時に1回呼ぶ */
export async function preloadAssets() {
  await Promise.all([
    load(SPHERE_SRC),
    load(RING_OVERLAY_SRC),
    load(RING_LEVELS_SRC),
    load(KNOB_SRC),
    load(RING_BEZEL_SRC),
    ...HOWAHOWA_SRCS.map(load),
    ...LIGHT_ANIM_SRCS.map(load),
  ])
}

/** リングレベルスプライトシートの定数 */
export const RING_LEVELS = {
  cols: 5,
  frameW: 1550,
  frameH: 1500,
} as const
