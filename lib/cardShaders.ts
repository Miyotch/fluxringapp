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

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

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

  vec3 col = (art * (0.58 + 0.5 * diff) + vec3(spec) * 0.29 + vec3(env) * 0.065 + vec3(band) * 0.17) * 0.9;
  col += cyan * fres * rimAmount;

  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)); // 簡易ガンマ補正
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
  float spec = pow(max(dot(N, H), 0.0), 64.0) * 0.6;
  float spec2 = pow(max(dot(N, H), 0.0), 14.0) * 0.32;

  vec3 col = base * (0.42 + 0.58 * diff) + envC * 0.20 + vec3(spec) * 0.55 + vec3(spec2) * 0.5
    + fres * vec3(0.50, 0.55, 0.66) * 0.20;

  // 刻印（3層彫り込み・lib/cardBackTexture.ts の carve）を金属の上に合成
  if (uHasInk > 0.5) {
    vec4 ink = texture2D(inkMap, vUv);
    col = mix(col, ink.rgb, ink.a);
  }

  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)); // 簡易ガンマ補正
  gl_FragColor = vec4(col, 1.0);
}
`;
