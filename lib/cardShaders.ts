/**
 * cardShaders.ts — カード3D表現の GLSL シェーダー（Web版リファレンス移植）
 * ------------------------------------------------------------------
 * 技術選定: このアプリは既に @react-three/fiber/native（three.js）+ expo-gl
 * （＝実 WebGL/OpenGL ES）で角丸の押し出しジオメトリ・トラックボール回転
 * ジェスチャ・カメラを実装済み（実機動作の実績あり）。
 *
 * リファレンス仕様は「Web(WebGL)版」＝生 GLSL を前提にしているため、
 * three.js の ShaderMaterial（GLSL をほぼそのまま使える）へ移植するのが
 * 最短・最小リスクの経路。Skia の RuntimeEffect（SkSL）は 2D Canvas 用の
 * シェーディング言語で、3Dシーングラフ・深度バッファ・パースペクティブ
 * 投影を持たないため、採用すると角丸押し出しジオメトリ・カメラ・
 * ジェスチャ物理まで含めた全面書き直しが必要になり、リスクとコストに
 * 見合わない。よって「Skia ではなく three.js ShaderMaterial（生GLSL）」
 * を採用する。
 *
 * 数値・定数はリファレンス仕様の値をそのまま使用（コメントで対応関係を明記）。
 * 座標系: モデル行列で world 空間へ変換した位置・法線を使う
 * （three.js の ShaderMaterial は cameraPosition/modelMatrix/viewMatrix/
 *   projectionMatrix を自動でuniform宣言してくれるため、追加の受け渡し不要）。
 *
 * 簡略化した点（優先度外・実機安定性を優先）:
 *   ・ジェスチャ物理（tAngX/tAngY のオイラー角・慣性の指数）は、既存の
 *     クォータニオン トラックボール方式（実機で動作実績あり）を維持し、
 *     リファレンスのオイラー角ベース物理には置き換えない
 *   ・カメラFOV/距離・ジオメトリの厚み比は既存 v98 準拠の値を維持
 *     （アスペクト比 2:3・角丸 0.085 は共通）
 *   ・出力は簡易ガンマ補正（pow 1/2.2）で近似（正確な sRGB OETF ではない）
 */

// 表裏で共通の頂点シェーダー。world 空間の位置・法線を varying で渡す。
export const CARD_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

// ── 表面（アート面）: 3-①のライティング式をそのまま移植 ──
// diff/fres/rim は共通ライティング。band が「傾けると走る光の帯」（最重要項目）。
export const ART_FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D map;
uniform float uHasMap;
uniform vec3 uLight; // (0.45, -0.55, -0.80) 参照値
uniform vec2 uCardPx; // カードの見かけ寸法(px)。表面オーバーレイを px 基準で描くため
// 0=正面で静止 / 1=傾いている。ライティング項の効き具合。CardGL が回転角から毎フレーム渡す。
uniform float uMotion;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

// 角丸長方形の符号付き距離（内側が負）
float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + vec2(r);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
}

// リニア → sRGB（正式な OETF）。three.js が SRGBColorSpace で行った復号の逆。
// 静止時に GL 面を素の作品画像へ戻すために使う。
vec3 linearToSrgb(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(-uLight);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 H = normalize(L + V);

  float diff = max(dot(N, L), 0.0);
  // フレネル: 0.06 + 0.55 * (1-NdotV)^3
  float fres = 0.06 + 0.55 * pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 cyan = vec3(0.93, 0.95, 0.98); // uCyan
  float rimAmount = 0.40;             // uRim

  vec4 artSample = uHasMap > 0.5 ? texture2D(map, vUv) : vec4(0.13, 0.14, 0.22, 1.0);
  vec3 art = artSample.rgb;

  // スペキュラ: pow(NdotH,64) * 0.6
  float spec = pow(max(dot(N, H), 0.0), 64.0) * 0.6;

  // 光の帯（band）: 傾き(V.x, V.y)に応じて対角線上をスライドする光の帯
  float diag = vUv.x * 0.72 + vUv.y * 0.72;
  float bandCenter = 0.72 + V.x * 0.55 - V.y * 0.22;
  float band = exp(-pow((diag - bandCenter) / 0.16, 2.0));

  // 環境反射: reflect(-V,N).y を 0..1 に正規化
  vec3 R = reflect(-V, N);
  float env = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);

  vec3 lit = (art * (0.58 + 0.5 * diff) + vec3(spec) * 0.29 + vec3(env) * 0.065 + vec3(band) * 0.17) * 0.9;
  lit += cyan * fres * rimAmount;

  // ── 静止時は素の作品画像そのものへ落とす ────────────────────────
  // ライティング項は「傾けたときの表現」だが、正面で静止していても
  //   band   最大 1.0（diag = 0.72(u+v) と bandCenter ≒ 0.72 が中央で一致し、
  //          対角線上に幅広の帯が出っぱなしになる）→ +0.17
  //   env    0.5 → +0.0325
  //   fres   0.06 → シアン(0.93,0.95,0.98) を +0.024
  //   本体   art × (0.58+0.5×0.7477) × 0.9 = art × 0.86（コントラスト圧縮）
  // が乗り続ける。結果はリニア空間で「絵 × 0.86 + 白～シアン 0.21」で、
  // 暗部ほど持ち上がって少し霞んだ寒色になる。
  //
  // 静止時のホームは RN の <Image>（＝素の作品画像）を重ねて見せているので、
  // GL 面がこの状態のままだと「タップして戻ると色みが変わる」ことになる。
  // uMotion=0 では art を厳密な sRGB へ戻してそのまま返すので、GL 面と
  // <Image> が一致する（この後に載る CardSurface 相当の作図は Skia 版と
  // 同一なので、そちらもそのまま揃う）。
  // ライティング側は従来どおり簡易ガンマ。静止側は three.js が SRGBColorSpace で
  // 復号したぶんを**厳密な sRGB OETF で戻す**。pow(1/2.2) では暗部が最大 8/255
  // 持ち上がってしまい、平面の <Image> と一致しない。
  vec3 litOut  = pow(clamp(lit, 0.0, 1.0), vec3(1.0 / 2.2));
  vec3 flatOut = linearToSrgb(clamp(art, 0.0, 1.0));
  vec3 col = mix(flatOut, litOut, uMotion);

  // ── v99-tsubasa の表面オーバーレイ（.face.front::after）────────────
  // components/CardSurface.tsx と同一の作図。CSS は sRGB 空間で合成するので
  // ガンマ補正の「後」に載せる。フリップ中は GL 面が見えるため、静止時の
  // Skia オーバーレイと同じ見えをここでも作らないと回転開始時に金枠が消える。
  //
  // vUv.y は remapUV により 1=カード上端。CSS の 180deg は上→下なので反転。
  float t = 1.0 - vUv.y;

  // (a) 面内減光: 白.05 0% → 透明 34% → 暗.12 76% → 暗.26 100%
  vec3 deep = vec3(3.0, 5.0, 14.0) / 255.0;
  if (t < 0.34) {
    col = mix(col, vec3(1.0), 0.05 * (1.0 - t / 0.34));
  } else if (t < 0.76) {
    col = mix(col, deep, 0.12 * ((t - 0.34) / 0.42));
  } else {
    col = mix(col, deep, 0.12 + 0.14 * ((t - 0.76) / 0.24));
  }

  // 参照のカード幅 188.6px 基準へ正規化する。CardSurface.tsx も同じ係数で
  // スケールするので、静止（Skia）↔ 回転中（GL）で寸法がぶれない。
  float s = uCardPx.x / 188.6;

  // (c) 下端の内側シャドウ inset 0 -18px 30px rgba(3,5,14,.22)
  //     dy=-18 で穴が上へずれるため、実質は下辺だけの減光。
  //     ガウス(σ=15)の裾を smoothstep で近似する。
  float dBot = vUv.y * uCardPx.y / s; // 下端からの距離（参照px）
  col = mix(col, deep, 0.22 * (1.0 - smoothstep(-4.0, 48.0, dBot)));

  // (b) 内枠の二重ヘアラインは Skia 側（CardSurface）と揃えて撤去。
  //     実機で「横枠が太い」と出たため。参照 v98 も P.frame=0.0 で枠なし。

  gl_FragColor = vec4(col, artSample.a);
}
`;

// ── 裏面（アルミ削り出し面）: 3-②のライティング式＋刻印テクスチャ合成 ──
// envG（疑似スカイボックス）・ヘアライン・二段スペキュラを数値どおり移植。
// 刻印（3層彫り込み陰影）は lib/cardBackTexture.ts が生成したテクスチャ
// （文字部分のみ・背景は透明）を、金属の上からアルファ合成する。
export const ALUMINUM_FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D inkMap;
uniform float uHasInk;
uniform vec3 uLight;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

// 決定論ハッシュ（GLSL版）: fract(sin(dot(p, k)) * 43758.5453)
float hash12(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(-uLight);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 H = normalize(L + V);

  float diff = max(dot(N, L), 0.0);
  float fres = 0.06 + 0.55 * pow(1.0 - max(dot(N, V), 0.0), 3.0);

  // 疑似スカイボックス反射: R.y を sky/hor/gnd で混色
  vec3 R = reflect(-V, N);
  float envG = smoothstep(-0.35, 0.85, R.y);
  vec3 sky = vec3(0.86, 0.90, 0.97);
  vec3 hor = vec3(0.58, 0.62, 0.72);
  vec3 gnd = vec3(0.24, 0.26, 0.32);
  vec3 envC = mix(mix(gnd, hor, clamp(envG * 2.0, 0.0, 1.0)), sky, clamp(envG * 2.0 - 1.0, 0.0, 1.0));

  // ヘアライン: 横240分割・縦14分割の擬似ランダムで削り出しの筋を作る
  vec2 cell = floor(vUv * vec2(240.0, 14.0));
  float line = hash12(cell);
  vec3 base = mix(vec3(0.60, 0.63, 0.70), vec3(0.80, 0.83, 0.90), envG) + vec3((line - 0.5) * 0.032);

  // 二段スペキュラ: 鋭い(pow64) + 広い(pow14)
  // 刻印文字が白飛びして読みづらいとの指摘のため、裏面のみ反射率を抑制
  // （表面 ART_FRAGMENT_SHADER・共通の uLight は変更しない）。
  float spec = pow(max(dot(N, H), 0.0), 64.0) * 0.6;
  float spec2 = pow(max(dot(N, H), 0.0), 14.0) * 0.32;

  vec3 col = base * (0.42 + 0.58 * diff) + envC * 0.14 + vec3(spec) * 0.40 + vec3(spec2) * 0.35
    + fres * vec3(0.50, 0.55, 0.66) * 0.14;

  // 刻印（3層彫り込み・lib/cardBackTexture.ts の carve）を金属の上に合成
  if (uHasInk > 0.5) {
    vec4 ink = texture2D(inkMap, vUv);
    col = mix(col, ink.rgb, ink.a);
  }

  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)); // 簡易ガンマ補正
  gl_FragColor = vec4(col, 1.0);
}
`;
