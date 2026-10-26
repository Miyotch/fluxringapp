/** Stable random sky: no grid or diagonal band, and no flicker on rerender. */
export function homeStars(layer: number) {
  let seed = 83771 + layer * 971;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return Array.from({ length: [560, 170, 32][layer] }, () => ({
    x: .03 + random() * .94,
    y: .02 + random() * .96,
    r: [.4, .65, 1.05][layer] * (.55 + random() ** 2 * 1.2),
    opacity: .3 + random() ** 2 * .7,
    warm: random() > .82,
  }));
}
