/**
 * safeArea.ts — セーフエリアの共通ヘルパー
 * ------------------------------------------------------------------
 * iPhone 16 Pro などの Dynamic Island 機では上部インセットが 59pt あり、
 * 従来の固定値（52〜60px＝ステータスバー44pt想定）では端末の時計表示と
 * 画面上部の要素が重なる。実寸を react-native-safe-area-context から取り、
 * 「インセット＋余白」で配置する。
 *
 * 各画面の gap は「従来の固定値 − 44（ステータスバー想定値）」を採用。
 * これにより 44pt 機では従来と同じ見た目のまま、59pt 機では自動的に下がる。
 *
 * 前提: App.tsx の最外殻で <SafeAreaProvider> がマウントされていること。
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 全ページ共通: ヘッダー情報をセーフエリアからさらに下げる余白（指摘対応）
const HEADER_EXTRA_DROP = 10;

/**
 * 上部固定要素の paddingTop / top に使う値。
 * @param gap セーフエリア下端からの余白（既定 8）
 */
export function useTopInset(gap = 8): number {
  const insets = useSafeAreaInsets();
  return insets.top + gap + HEADER_EXTRA_DROP;
}

/**
 * 下部固定要素の paddingBottom / marginBottom に使う値。
 * ホームインジケータ（34pt）を避けつつ、従来値を下回らないようにする。
 * @param min 最低限確保する余白（従来の固定値を渡す）
 * @param gap インセットに上乗せする余白（既定 0）
 */
export function useBottomInset(min = 12, gap = 0): number {
  const insets = useSafeAreaInsets();
  return Math.max(min, insets.bottom + gap);
}
