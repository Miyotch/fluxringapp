/**
 * skiaSprites.ts — オフスクリーンへ焼く小さな部品（Atlas / タイル用）
 * ------------------------------------------------------------------
 * なぜ焼くのか:
 *   参照HTMLは Canvas2D の `createRadialGradient` や CSS の `box-shadow` で
 *   放射グラデを描く。ブラウザはこれをラスタキャッシュに載せるので、位置や
 *   濃度が変わっても再ラスタライズはほぼ起きない。
 *   一方 Skia の宣言的シーンでは <RadialGradient> の中心・半径が動くたびに
 *   シェーダが作り直され、毎フレーム 36個（雲）や 162個（星のハロー）ぶんの
 *   グラデ生成が走る。ここが実機での主要なコストだった。
 *
 *   同じ絵は「1枚のスプライトを焼いて drawAtlas で複製」に置き換えられる。
 *   グラデ生成は起動時の 1 回だけになり、毎フレームはテクスチャの複製で済む。
 *
 * 注意: MakeOffscreen は GPU/CPU の状況で null を返しうる。呼び出し側は
 *   null を必ず扱うこと（その場合は従来の宣言的描画へフォールバックする）。
 */

import {
  Skia,
  TileMode,
  BlurStyle,
  type SkImage,
  type SkRect,
} from '@shopify/react-native-skia';

/** グラデーションの停止点（CSS の color-stop と同じ並び） */
export type SpriteStop = { at: number; color: string };

/**
 * オフスクリーンのスナップショットを、どのコンテキストからでも描ける画像へ変換する。
 *
 * **これを忘れると「何も描かれない」。** MakeOffscreen が返すサーフェスは
 * GPU バックドのことがあり、そのスナップショットは生成時の GL コンテキストに
 * 紐づいたテクスチャ画像になる。Skia の描画は別スレッド／別コンテキストで
 * 走るため、そのまま <Image> へ渡しても無視されて透明になる。
 * makeNonTextureImage() でラスタ画像へ落とすと、どこからでも安全に描ける。
 *
 * 2026-08-18: これが原因で調律陣の彫刻層・天の川の雲・星のハロー・粒の
 * タイルが実機で丸ごと消えていた（焼き込みは成功し null も返らないので
 * 型チェックでもログでも気付けない）。
 */
function detach(surface: ReturnType<typeof Skia.Surface.MakeOffscreen>): SkImage | null {
  if (!surface) return null;
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  return snapshot.makeNonTextureImage() ?? snapshot;
}

/**
 * 焼いた画像のモジュールレベルキャッシュ。
 * ホームは他タブへ移ると DiscoverScreen ごとアンマウントされる（参照は DOM を
 * 残して rAF を止めるだけ）。素直に useMemo だけにするとホームへ戻るたび焼き直しが
 * 走り、とくに調律陣の彫刻層（2,000超プリミティブ）で復帰時のひっかかりになる。
 * 画面サイズ単位で保持しておけば 2 回目以降は即座に返せる。
 * 端末回転などでキーが変わる想定なので、上限を決めて古いものから捨てる。
 */
// ホームだけで cloudSpriteBlurred / starHalo1 / starHalo2 / sealInk / sealGlow /
// grainTile の 6 キーを同時に使う。上限 4 のままだと挿入のたびに最古が押し出され、
// ホームへ戻るたびどれか 1 枚（最悪 sealInk の 2,000 超プリミティブ）を焼き直す
// ローテーションになっていた。回転などでキーが変わるぶんの余裕も見て 8 にする。
const CACHE_LIMIT = 8;
const imageCache = new Map<string, SkImage | null>();

export function cachedImage(key: string, make: () => SkImage | null): SkImage | null {
  if (imageCache.has(key)) return imageCache.get(key) ?? null;
  const img = make();
  imageCache.set(key, img);
  while (imageCache.size > CACHE_LIMIT) {
    const oldest = imageCache.keys().next().value;
    if (oldest === undefined) break;
    imageCache.delete(oldest);
  }
  return img;
}

/**
 * 中心 → 外周へ抜ける放射グラデの正方形スプライトを 1 枚焼く。
 *
 * @param size 一辺のピクセル数。Atlas で拡大して使うので、実表示の最大径より
 *             小さめでよい（グラデは滑らかなので拡大しても破綻しない）
 */
export function makeRadialSprite(size: number, stops: SpriteStop[]): SkImage | null {
  const surface = Skia.Surface.MakeOffscreen(size, size);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const r = size / 2;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: r, y: r },
      r,
      stops.map((s) => Skia.Color(s.color)),
      stops.map((s) => s.at),
      TileMode.Clamp,
    ),
  );
  canvas.drawCircle(r, r, r, paint);
  return detach(surface);
}

/**
 * ガウスぼかしを焼いた白い円のスプライト。
 * CSS の `box-shadow: 0 0 Bpx` と `filter: blur(Npx)` はどちらも
 * 標準偏差 σ のガウス（box-shadow は σ = B/2、filter は σ = N）なので、
 * 「半径 core の白円に σ のガウスをかける」で両方を正確に再現できる。
 *
 * これまでハローを線形の RadialGradient で近似していたが、線形は裾が急に
 * 切れて輪郭が立つ（＝参照より「はっきり」見える）原因になっていた。
 *
 * @param size      スプライト一辺(px)
 * @param coreRatio 芯の半径 ÷ (size/2)。残りがぼかしの伸びしろになる
 * @param sigmaOverCore σ ÷ 芯の半径。box-shadow の B に対しては B/(2*core)
 * @returns 焼いた画像と、Atlas で拡縮する際の基準となる芯半径(スプライト座標)
 */
export function makeGlowSprite(
  size: number,
  coreRatio: number,
  sigmaOverCore: number,
): { image: SkImage | null; core: number; size: number } {
  const core = (size / 2) * coreRatio;
  const surface = Skia.Surface.MakeOffscreen(size, size);
  if (!surface) return { image: null, core, size };
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color('rgb(255,255,255)'));
  const sigma = core * sigmaOverCore;
  if (sigma > 0) paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, sigma, false));
  canvas.drawCircle(size / 2, size / 2, core, paint);
  return { image: detach(surface), core, size };
}

/**
 * 放射グラデにガウスぼかしを重ねたスプライト（天の川の雲用）。
 * 参照は `ctx.filter='blur(13px)'` を各雲の塗りに個別へかけている。
 * ガウスは線形作用素なので「合成後にぼかす」＝「各雲をぼかしてから合成」。
 * 焼き込みで再現でき、実行時の saveLayer は不要になる。
 *
 * @param sigma スプライト座標系での σ。芯半径に対する比で指定すること
 */
export function makeBlurredRadialSprite(
  size: number,
  coreRatio: number,
  stops: SpriteStop[],
  sigma: number,
): { image: SkImage | null; core: number; size: number } {
  const core = (size / 2) * coreRatio;
  const surface = Skia.Surface.MakeOffscreen(size, size);
  if (!surface) return { image: null, core, size };
  const canvas = surface.getCanvas();
  const c = size / 2;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: c, y: c },
      core,
      stops.map((s) => Skia.Color(s.color)),
      stops.map((s) => s.at),
      TileMode.Clamp,
    ),
  );
  if (sigma > 0) paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, sigma, false));
  canvas.drawCircle(c, c, core, paint);
  return { image: detach(surface), core, size };
}

/**
 * feTurbulence(fractalNoise) の 1 タイルを焼く。
 * 参照の `#bggrain` は 140×140 の SVG ノイズを background-repeat で敷いている。
 * Skia の <FractalNoise> は全画面をピクセル単位で評価するプロシージャル
 * シェーダなので、静止レイヤーが動くレイヤーと同じ Canvas に入った瞬間に
 * 毎フレームの実行になる。参照どおり「1タイルを焼いて繰り返す」へ寄せる。
 */
export function makeNoiseTile(
  size: number,
  freq: number,
  octaves: number,
  desaturate: number[],
): SkImage | null {
  const surface = Skia.Surface.MakeOffscreen(size, size);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setShader(Skia.Shader.MakeFractalNoise(freq, freq, octaves, 0, size, size));
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(desaturate));
  canvas.drawRect({ x: 0, y: 0, width: size, height: size }, paint);
  return detach(surface);
}

/** Atlas のスプライト矩形（1枚のスプライト画像を丸ごと使う） */
export function fullSprite(image: SkImage | null): SkRect {
  const w = image?.width() ?? 1;
  const h = image?.height() ?? 1;
  return { x: 0, y: 0, width: w, height: h };
}

/**
 * Atlas の per-instance カラーをスプライトへ適用するときのブレンド。
 * Modulate = スプライト × 色。スプライトは白＋αグラデなので、
 * 結果の RGB = 指定色 / 結果の α = スプライトα × 指定色α になる。
 * （<Atlas> の colorBlendMode は enum 値ではなく文字列名を取る）
 */
export const ATLAS_TINT = 'modulate' as const;
