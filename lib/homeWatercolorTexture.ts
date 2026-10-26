import { CLOUD_VOLUMES } from './homeAmbientModel';

// Concentrate pigment in the visible side spaces, rather than a band behind the card.
export const VISIBLE_CLOUDS = [
  { ...CLOUD_VOLUMES[0], x: .15, y: .29, rx: .64, ry: .28, color: [67, 83, 137] },
  { ...CLOUD_VOLUMES[1], x: .94, y: .48, rx: .43, ry: .29, color: [65, 109, 166] },
  { ...CLOUD_VOLUMES[2], x: .08, y: .68, rx: .46, ry: .26, color: [80, 94, 151] },
];
function noise(x: number, y: number): number {
  const hash = (a: number, b: number) => {
    const n = Math.sin(a * 127.1 + b * 311.7 + 26.1026) * 43758.5453;
    return n - Math.floor(n);
  };
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, octaves: number): number {
  let sum = 0, weight = .5, total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x, y) * weight; total += weight;
    x = x * 2.03 + 3.7; y = y * 2.03 + 1.9; weight *= .5;
  }
  return sum / total;
}
function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
/** Startup-only watercolor pigment. No central band or per-frame noise calculation. */
export function renderWatercolorRows(width: number, height: number, layer: number, from: number, to: number, pixels: Uint8ClampedArray) {
  const volume = VISIBLE_CLOUDS[layer], aspect = width / height;
  for (let y = from; y < Math.min(to, height); y++) for (let x = 0; x < width; x++) {
    const nx = x / (width - 1), ny = y / (height - 1);
    const px = nx * aspect * 9 + volume.phase * 13, py = ny * 9 + volume.phase * 7;
    const wx = fbm(px * .47 + 5.3, py * .47 + 2.1, 3);
    const wy = fbm(px * .47 + 17.6, py * .47 + 9.2, 3);
    const body = fbm(px + wx * 1.8, py + wy * 1.8, 4);
    const grain = fbm(px * 2.3 - wy, py * 2.3 + wx, 3);
    const ridge = 1 - Math.abs(body * 2 - 1);
    const pigment = smooth(.24, .72, body) * (.55 + .45 * grain) + Math.pow(ridge, 9) * .16;
    const volumeMask = Math.exp(-1.5 * (((nx - volume.x) / volume.rx) ** 2 + ((ny - volume.y) / volume.ry) ** 2));
    const edge = smooth(0, .035, nx) * smooth(0, .035, 1 - nx) * smooth(0, .04, ny) * smooth(0, .04, 1 - ny);
    const titleQuiet = 1 - .45 * Math.exp(-(((ny - .205) / .06) ** 2));
    const alpha = Math.min(.93, (.12 + 1.40 * pigment) * volumeMask * edge * titleQuiet);
    const at = (y * width + x) * 4;
    const shade = .82 + .30 * grain;
    pixels[at] = volume.color[0] * shade; pixels[at + 1] = volume.color[1] * shade; pixels[at + 2] = volume.color[2] * shade;
    pixels[at + 3] = Math.round(alpha * 255);
  }
}
