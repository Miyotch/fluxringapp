/**
 * artwork.ts — 同梱アート画像の参照（v98_FIX ハンドオフの実ファイル）
 * ------------------------------------------------------------------
 * assets/art/ の実アート（683×1024・2:3）をバンドルし、URI 文字列として配る。
 * 画像の消費側は全て URI 文字列を受け取る作りのため（RN Image / Skia useImage /
 * Skia.Data.fromURI / expo-three TextureLoader）、ここで一元的に解決する。
 *
 * 注意（実機/リリースビルド）:
 *   Asset.fromModule().uri は dev では http、リリースの iOS では file:// を返す。
 *   Android のリリースでは APK 内 asset:// になりうるため、App 起動時に
 *   prefetchArtwork() で downloadAsync() し localUri（file://）を確定させる。
 *   解決後は resolvedUri() が localUri を優先して返す。
 */

import { Asset } from 'expo-asset';

// 作品アート（cards.json の key と対応）
export const ART_MODULES = {
  blue: require('../assets/art/blue.jpg'),
  white: require('../assets/art/white.jpg'),
  mesh: require('../assets/art/mesh.jpg'),
  kite: require('../assets/art/kite.jpg'),
  bloom: require('../assets/art/bloom.jpg'),
} as const;

// サムネ（コレクションのグリッド等・107×160）
export const THUMB_MODULES = {
  blue: require('../assets/art/blue_thumb.jpg'),
  white: require('../assets/art/white_thumb.jpg'),
  mesh: require('../assets/art/mesh_thumb.jpg'),
  kite: require('../assets/art/kite_thumb.jpg'),
  bloom: require('../assets/art/bloom_thumb.jpg'),
} as const;

export type ArtKey = keyof typeof ART_MODULES;

/** モジュール → 現時点で最良の URI（localUri があればそれを優先） */
export function moduleUri(mod: number): string {
  const a = Asset.fromModule(mod);
  return a.localUri ?? a.uri;
}

/** 作品アートの URI */
export const artUri = (key: ArtKey): string => moduleUri(ART_MODULES[key]);
/** サムネの URI */
export const thumbUri = (key: ArtKey): string => moduleUri(THUMB_MODULES[key]);

/**
 * 全アートをローカルへ展開して localUri を確定させる（起動時に一度）。
 * これで Android リリースでも file:// が使え、Skia / GL テクスチャが読める。
 */
export async function prefetchArtwork(): Promise<void> {
  const mods = [...Object.values(ART_MODULES), ...Object.values(THUMB_MODULES)];
  await Promise.all(
    mods.map((m) =>
      Asset.fromModule(m)
        .downloadAsync()
        .catch(() => {}),
    ),
  );
}
