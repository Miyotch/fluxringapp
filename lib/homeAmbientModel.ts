import type { Star } from './homeStarfieldModel';

// Broad, overlapping volumes; no outlined contour or closed ring.
export const CLOUD_VOLUMES = [
  { x: .20, y: .35, rx: .69, ry: .34, phase: .12, color: [49, 65, 119] },
  { x: .91, y: .54, rx: .49, ry: .30, phase: .73, color: [48, 88, 145] },
  { x: .18, y: .72, rx: .58, ry: .23, phase: 1.31, color: [74, 79, 143] },
] as const;

/** Alpha vanishes at the texture border so tiny transforms never reveal an edge. */
export function cloudAlpha(x: number, y: number, textureBlue: number, volume: typeof CLOUD_VOLUMES[number]) {
  const field = Math.exp(-1.7 * (((x - volume.x) / volume.rx) ** 2 + ((y - volume.y) / volume.ry) ** 2));
  const edge = Math.min(1, x / .08, (1 - x) / .08, y / .08, (1 - y) / .08);
  const softEdge = Math.max(0, edge) ** 2 * (3 - 2 * Math.max(0, edge));
  // The reference texture carries fine cloud structure; retain broad wisps in its halo.
  const density = Math.max(0, Math.min(1, (textureBlue - 15) / 95));
  return Math.round(255 * field * softEdge * (.07 + Math.pow(density, .85) * .84));
}

/** Restore distant stars, leaving breathing room around titles and navigation. */
export function quietHomeStars(stars: Star[]): Star[] {
  let brightIndex = 0;
  return stars.filter((star, i) => {
    if (star.bright) return brightIndex++ % 3 !== 0;
    const side = Math.abs(star.x - .5) * 2;
    const title = Math.exp(-(((star.y - .205) / .055) ** 2));
    const footer = Math.max(0, (star.y - .80) / .20);
    // Soft regional additions preserve the existing sky and avoid a visible boundary.
    const upperRight = Math.exp(-(((star.x - .80) / .26) ** 2) - (((star.y - .16) / .22) ** 2));
    const lower = Math.exp(-(((star.y - .79) / .19) ** 2));
    // Portrait counts versus the original sky: upper right ~+20%, lower ~+25%.
    const extra = (.24 * upperRight + .186 * lower) * (1 - .65 * title) * (1 - .6 * footer);
    const keep = .56 + .08 * side - .20 * title - .10 * footer + extra;
    const sample = (Math.imul(i + 31, 2654435761) >>> 0) / 4294967296;
    return sample < keep;
  }).map(star => ({ ...star, core: star.core * (star.bright ? .8 : 1), alpha: star.alpha * (star.bright ? .78 : .86) }));
}
