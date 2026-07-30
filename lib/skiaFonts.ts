/**
 * skiaFonts.ts — Skia 描画用の EB Garamond 読み込み
 * ------------------------------------------------------------------
 * RN の `Text` は expo-font（constants/fonts.ts）で EB Garamond を使えるが、
 * Skia の `matchFont` は **OS にインストール済みのフォントしか見ない** ため、
 * JS 側で読み込んだ書体は魔法陣（StarSeal）やカード裏の刻印（cardBackTexture）
 * には効かない。そこで同じ ttf を SkTypeface として別途読み込む。
 *
 * 読み込みは非同期なので、App.tsx が起動時に `loadNumTypeface()` を待ってから
 * 画面を出す。以降は `numFont(size)` が同期で SkFont を返す（サイズ別キャッシュ）。
 * 失敗時は null を返し、呼び出し側が従来の matchFont にフォールバックする。
 *
 * ※ EB Garamond は和文グリフを持たない。和文を含む文字列には使わないこと
 *   （呼び出し側で ASCII の run だけこの書体に切り替えている）。
 */

import { Skia, loadData, type SkFont, type SkTypeface } from '@shopify/react-native-skia';
import { EBGaramond_400Regular } from '@expo-google-fonts/eb-garamond/400Regular';

let typeface: SkTypeface | null = null;
let pending: Promise<SkTypeface | null> | null = null;
const fontCache = new Map<number, SkFont>();

/** ttf を SkTypeface として読み込む（多重呼び出しは同じ Promise を共有）。 */
export function loadNumTypeface(): Promise<SkTypeface | null> {
  if (typeface) return Promise.resolve(typeface);
  if (!pending) {
    pending = (async () => {
      try {
        // loadData は Skia 自身の useTypeface と同じ解決経路（require したモジュール
        // ID → アセット URI → SkData）。dev/release どちらでも同じ扱いになる。
        typeface = await loadData(EBGaramond_400Regular, (d) =>
          Skia.Typeface.MakeFreeTypeFaceFromData(d),
        );
      } catch {
        typeface = null; // フォールバック（matchFont）で描く
      }
      return typeface;
    })();
  }
  return pending;
}

/** 読み込み済みなら SkTypeface、未了・失敗なら null。 */
export function getNumTypeface(): SkTypeface | null {
  return typeface;
}

/** 指定サイズの EB Garamond SkFont（サイズ別キャッシュ）。未読込なら null。 */
export function numFont(size: number): SkFont | null {
  if (!typeface) return null;
  const key = Math.round(size * 10);
  const hit = fontCache.get(key);
  if (hit) return hit;
  try {
    const f = Skia.Font(typeface, size);
    fontCache.set(key, f);
    return f;
  } catch {
    return null;
  }
}

/** 数字・欧文のみで構成された文字列か（＝EB Garamond で描いてよいか）。 */
export function isLatinOnly(text: string): boolean {
  for (const ch of text) if (ch.charCodeAt(0) > 0x7f) return false;
  return true;
}
