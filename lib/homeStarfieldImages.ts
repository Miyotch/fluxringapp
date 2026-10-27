import { AlphaType, BlendMode, ColorType, ImageFormat, Skia, rect, type SkImage } from '@shopify/react-native-skia';
import { makeHomeStars, nebulaSize, type Star } from './homeStarfieldModel';
import { CLOUD_VOLUMES, quietHomeStars } from './homeAmbientModel';
import { renderWatercolorRows } from './homeWatercolorTexture';

export type StarfieldImages = { clouds: SkImage[]; starsFar: string; nearStars: Star[] };
const cache = new Map<string, Promise<StarfieldImages>>();
// Drop cache ownership only. Mounted canvases retain their images until unmounted.
export function clearHomeStarfieldCache() { cache.clear(); }
const yieldStartup = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function png(image: SkImage) {
  try {
    const encoded = image.encodeToBase64(ImageFormat.PNG, 100);
    if (!encoded) throw new Error('HOME starfield PNG encoding failed');
    return `data:image/png;base64,${encoded}`;
  }
  finally { image.dispose(); }
}
function pixelImage(width: number, height: number, pixels: Uint8Array) {
  const data = Skia.Data.fromBytes(pixels);
  try {
    const image = Skia.Image.MakeImage({ width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul }, data, width * 4);
    if (!image) throw new Error('HOME starfield image allocation failed');
    return image;
  } finally { data.dispose(); }
}
async function makeNebula(width: number, height: number, layer: number) {
  const size = nebulaSize(width, height);
  const pixels = new Uint8ClampedArray(size.width * size.height * 4);
  for (let y = 0; y < size.height; y += 12) {
    renderWatercolorRows(size.width, size.height, layer, y, y + 12, pixels);
    await yieldStartup();
  }
  return pixelImage(size.width, size.height, new Uint8Array(pixels.buffer));
}
function gaussianSprite(color: readonly number[]) {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x + .5 - 32) / 32, (y + .5 - 32) / 32), at = (y * size + x) * 4;
    pixels[at] = color[0]; pixels[at + 1] = color[1]; pixels[at + 2] = color[2];
    pixels[at + 3] = r >= 1 ? 0 : Math.round(255 * Math.exp(-r * r * 9));
  }
  return pixelImage(size, size, pixels);
}
function makeStars(width: number, height: number, density: number, stars: Star[]) {
  const surface = Skia.Surface.Make(Math.round(width * density), Math.round(height * density));
  if (!surface) throw new Error('HOME starfield surface allocation failed');
  const sprites = new Map<string, SkImage>();
  const sprite = (color: readonly number[]) => {
    const key = color.join(',');
    if (!sprites.has(key)) sprites.set(key, gaussianSprite(color));
    return sprites.get(key)!;
  };
  const paint = Skia.Paint();
  try {
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('transparent'));
    paint.setBlendMode(BlendMode.Plus);
    const draw = (star: Star, core: number, alpha: number, color: readonly number[]) => {
      const radius = core * 4.2 * density;
      paint.setAlphaf(alpha);
      // Wrap sprites too, so a star crossing the tile seam keeps its complete halo.
      for (const offset of [-1, 0, 1]) {
        const cx = (star.x + offset) * width * density;
        if (cx + radius < 0 || cx - radius > width * density) continue;
        canvas.drawImageRect(sprite(color), rect(0, 0, 64, 64), rect(cx - radius, star.y * height * density - radius, radius * 2, radius * 2), paint);
      }
    };
    for (const star of stars) {
      if (star.bright) draw(star, 2.4, .07, [190, 204, 255]);
      draw(star, star.core, star.alpha, star.color);
    }
    surface.flush();
    return png(surface.makeImageSnapshot());
  } finally {
    sprites.forEach(image => image.dispose());
    paint.dispose(); surface.dispose();
  }
}
/** Cache the current size across HOME remounts; old sizes are not retained. No frame-time drawing. */
export function homeStarfieldImages(width: number, height: number, density: number) {
  const key = `${width}:${height}:${density}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const clouds: SkImage[] = [];
    try {
      for (let layer = 0; layer < CLOUD_VOLUMES.length; layer++) clouds.push(await makeNebula(width, height, layer));
      const stars = quietHomeStars(makeHomeStars(width, height));
      await yieldStartup();
      return { clouds, nearStars: stars.filter(star => star.core >= .42),
        starsFar: makeStars(width, height, density, stars.filter(star => star.core < .42)),
      };
    } catch (error) {
      // These images were never published to a canvas, so immediate disposal is safe.
      clouds.forEach(image => image.dispose());
      throw error;
    }
  })();
  cache.set(key, pending);
  void pending.catch(() => { if (cache.get(key) === pending) cache.delete(key); });
  while (cache.size > 1) cache.delete(cache.keys().next().value!);
  return pending;
}
