/** Shared deterministic sky layout for native HOME and its browser design study. */
export function homeStars(layer: number) {
  const hash = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  return Array.from({ length: [560, 170, 32][layer] }, (_, i) => {
    const seed = i * 7.13 + layer * 971;
    const y = hash(seed + 2);
    // Half of the distant stars gather in a diagonal, irregular Milky Way.
    const band = .12 + y * .72 + (hash(seed + 3) - .5) * .27;
    return { x: layer === 0 && i % 2 === 0 ? band : hash(seed + 1), y,
      r: [.35, .65, 1.05][layer] * (.6 + hash(seed + 4)),
      warm: hash(seed + 5) > .83 };
  });
}
