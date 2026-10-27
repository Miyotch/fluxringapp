import React, { type ReactElement } from 'react';
import { drawAsPicture, Group, ImageFormat, Skia, type SkImage } from '@shopify/react-native-skia';

const cache = new Map<string, Promise<string>>();

/** Same Skia scene and device pixel density as the live canvas. Native Image shares the URI bitmap. */
export function sharedCardSurfaceImage(key: string, width: number, height: number, density: number, artwork: ReactElement) {
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const picture = await drawAsPicture(<Group transform={[{ scale: density }]}>{artwork}</Group>);
    let surface: ReturnType<typeof Skia.Surface.Make> = null;
    let snapshot: SkImage | null = null;
    try {
      surface = Skia.Surface.Make(Math.ceil(width * density), Math.ceil(height * density));
      if (!surface) throw new Error('Card surface allocation failed');
      const canvas = surface.getCanvas();
      canvas.clear(Skia.Color('transparent'));
      canvas.drawPicture(picture);
      surface.flush();
      snapshot = surface.makeImageSnapshot();
      const encoded = snapshot.encodeToBase64(ImageFormat.PNG, 100);
      if (!encoded) throw new Error('Card surface encoding failed');
      return `data:image/png;base64,${encoded}`;
    } finally {
      snapshot?.dispose(); surface?.dispose(); picture.dispose();
    }
  })();
  cache.set(key, pending);
  void pending.catch(() => { if (cache.get(key) === pending) cache.delete(key); });
  // HOME and player can share their current sizes; do not retain historical orientations.
  while (cache.size > 2) cache.delete(cache.keys().next().value!);
  return pending;
}
