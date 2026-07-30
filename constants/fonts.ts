/**
 * fonts.ts — 書体の定義（トンマナ確定）
 * ------------------------------------------------------------------
 * tonmana_typography_reference / tonmana_usage_map.md より:
 *   欧文・数字 = EB Garamond（Google Fonts / OFL。アプリに同梱）
 *   和文       = Hiragino Mincho ProN / Yu Mincho 系明朝（OS標準・同梱不要）
 *
 * 数字表記（価格・周波数・時間・通し番号・シリアル等）は EB Garamond で統一する。
 * 和文と混ざる文字列に EB Garamond を当てても、和文グリフは持たないため
 * OS のフォールバック（明朝）で描かれる。数字・英字だけが EB Garamond になる。
 *
 * ※ Skia 描画（魔法陣・カード裏の刻印）は RN の fontFamily を見ないため、
 *   別途 lib/skiaFonts.ts で同じ ttf を Typeface として読み込んでいる。
 */

// サブパスから読む（パッケージのルートを import すると未使用の全ウェイト
// 10ファイル・約4.5MB がバンドルに載るため）。
import { EBGaramond_400Regular } from '@expo-google-fonts/eb-garamond/400Regular';

/** useFonts / loadAsync に渡すマップ。キーが fontFamily 名になる。 */
export const APP_FONTS = {
  EBGaramond_400Regular,
} as const;

/** 数字・欧文に当てる書体名 */
export const NUM_FONT = 'EBGaramond_400Regular';
