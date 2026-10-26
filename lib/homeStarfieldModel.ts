/** Native adaptation of the supplied starfield_v100.js / FR_home_starfield_spec_v2.md.
 * Pure, deterministic construction only; nothing here runs on an animation frame.
 */
export const STARFIELD = {
  bandY: .5, bandW: .17, tilt: -7 * Math.PI / 180,
  peak: .72, dust: .55, morph: .55,
  driftMsA: 26000, driftMsB: 19000, fadeMs: 17000,
  glintMinMs: 9000, glintMaxMs: 15000,
} as const;
export const STAR_COLORS = [
  [196, 210, 250], [196, 210, 250], [214, 222, 255],
  [214, 222, 255], [236, 238, 255], [255, 240, 222],
] as const;
const rampStops = [0, .30, .55, .78, 1];
// 64 (not 63) at the second stop follows the supplied executable reference.
const rampColors = [[12, 11, 30], [22, 24, 64], [38, 46, 112], [62, 74, 168], [118, 136, 222]];
function seeded(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const noiseSeed = Math.fround(seeded(20261026)());
function hash(x: number, y: number) {
  const h = Math.sin(x * 127.1 + y * 311.7 + noiseSeed * 97.3) * 43758.5453;
  return h - Math.floor(h);
}
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, octaves: number) {
  let sum = 0, amplitude = .5, total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise(x, y); total += amplitude;
    x *= 2.03; y *= 2.03; amplitude *= .5;
  }
  return sum / total;
}
function ramp(value: number) {
  const t = Math.max(0, Math.min(1, value));
  for (let i = 1; i < rampStops.length; i++) {
    if (t <= rampStops[i]) {
      const k = (t - rampStops[i - 1]) / (rampStops[i] - rampStops[i - 1]);
      return rampColors[i].map((c, j) => rampColors[i - 1][j] + (c - rampColors[i - 1][j]) * k);
    }
  }
  return rampColors[4];
}
export function nebulaSize(width: number, height: number) {
  return { width: Math.max(80, Math.round(width / 2.5)), height: Math.max(160, Math.round(height / 2.5)) };
}
/** Render a bounded row range so mobile startup can yield between chunks. */
export function renderNebulaRows(width: number, height: number, phase: number, from: number, to: number, pixels: Uint8ClampedArray) {
  const size = nebulaSize(width, height), aspect = width / height;
  const cs = Math.cos(STARFIELD.tilt), sn = Math.sin(STARFIELD.tilt);
  const ox = phase * 1.7, oy = phase * .9;
  for (let y = from; y < Math.min(to, size.height); y++) {
    for (let x = 0; x < size.width; x++) {
      const nx = x / size.width, ny = y / size.height;
      const dist = -(nx - .5) * aspect * sn + (ny - STARFIELD.bandY) * cs;
      const band = Math.exp(-Math.pow(dist / STARFIELD.bandW, 2));
      const halo = Math.exp(-Math.pow(dist / (STARFIELD.bandW * 2.6), 2)) * .35;
      const n = fbm(nx * 3.2 * aspect + 11.3 + ox, ny * 3.2 + 4.1 + oy, 5);
      const fil = fbm(nx * 7.5 * aspect + 2.7 + ox * 1.3, ny * 7.5 + 9.2 - oy, 4);
      let lane = 1 - Math.abs(fbm(nx * 4.4 * aspect + 31 + ox * .6, ny * 4.4 + 17 + oy * .6, 4) * 2 - 1);
      lane = Math.pow(Math.max(0, lane), 6) * Math.exp(-Math.pow(dist / (STARFIELD.bandW * .7), 2));
      let value = (band * (.35 + .85 * n) * (.75 + .5 * fil) + halo * n) * STARFIELD.peak;
      value *= 1 - STARFIELD.dust * lane;
      const color = ramp(value);
      const vignette = 1 - .55 * Math.pow(Math.min(1, Math.hypot((nx - .5) * 1.1, (ny - .47) * .9) * 1.55), 2.2);
      const offset = (y * size.width + x) * 4;
      pixels[offset] = color[0] * vignette;
      pixels[offset + 1] = color[1] * vignette;
      pixels[offset + 2] = color[2] * vignette;
      pixels[offset + 3] = 255;
    }
  }
}
export type Star = { x: number; y: number; core: number; alpha: number; color: readonly number[]; bright: boolean };
export function makeHomeStars(width: number, height: number): Star[] {
  const random = seeded(777), aspect = width / height;
  const cs = Math.cos(STARFIELD.tilt);
  const range = (a: number, b: number) => a + random() * (b - a);
  const gaussian = () => Math.sqrt(-2 * Math.log(random() + 1e-9)) * Math.cos(6.283 * random());
  function pick(bias: number): [number, number] | null {
    for (let t = 0; t < 12; t++) {
      const x = random();
      const y = random() < bias ? STARFIELD.bandY + (x - .5) * aspect * Math.tan(STARFIELD.tilt) + gaussian() * STARFIELD.bandW * .8 / cs : random();
      if (y < 0 || y > 1) continue;
      if (random() > Math.pow(fbm(x * 6 * aspect + 5.1, y * 6 + 2.3, 3), 1.6) * 1.9) continue;
      if (y > .55 && random() < .4) continue;
      return [x, y];
    }
    return null;
  }
  const stars: Star[] = [];
  for (const tier of [{ count: 2200, bias: .8, min: .18, max: .38, a: .18, b: .6, lower: .8 },
    { count: 110, bias: .45, min: .42, max: .62, a: .55, b: .85, lower: .75 }]) {
    for (let i = 0; i < tier.count; i++) {
      const p = pick(tier.bias); if (!p) continue;
      const color = STAR_COLORS[Math.floor(random() * STAR_COLORS.length)];
      stars.push({ x: p[0], y: p[1], core: range(tier.min, tier.max) * (p[1] > .55 ? tier.lower : 1), alpha: range(tier.a, tier.b), color, bright: false });
    }
  }
  let brightCount = 0;
  for (let i = 0; i < 54 && brightCount < 9; i++) {
    const p = pick(.35);
    if (!p || (p[0] > .18 && p[0] < .82 && p[1] > .22 && p[1] < .70) || p[1] > .62) continue;
    const color = STAR_COLORS[Math.floor(random() * STAR_COLORS.length)];
    stars.push({ x: p[0], y: p[1], core: range(.75, .95), alpha: 1, color, bright: true });
    brightCount++;
  }
  return stars;
}
