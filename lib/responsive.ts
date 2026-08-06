/**
 * responsive.ts — タブレット幅でのフォーム要素サイズ調整
 * ------------------------------------------------------------------
 * スマホ幅ではテキストフィールド・ボタンは画面いっぱい（従来通り）。
 * タブレット幅（iPad等）では横に広がりすぎて間延びして見えるため、
 * フォーム領域の幅を画面幅の60%に制限して中央寄せする。
 */

import { useWindowDimensions } from 'react-native';

// この幅以上をタブレットとみなす（iPad mini 縦向き 744pt を下回らない範囲）
const TABLET_BREAKPOINT = 700;
const FORM_WIDTH_RATIO = 0.6;

/**
 * フォーム（テキストフィールド・ボタン等）を包む View に渡すスタイル。
 * タブレット幅なら { width: 画面幅の60%, alignSelf: 'center' }、
 * スマホ幅なら null（何も変えない＝従来の全幅レイアウトのまま）。
 */
export function useFormWidthStyle(): { width: number; alignSelf: 'center' } | null {
  const { width } = useWindowDimensions();
  if (width < TABLET_BREAKPOINT) return null;
  return { width: width * FORM_WIDTH_RATIO, alignSelf: 'center' };
}
