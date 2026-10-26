/** HOME-only aluminum finish. Existing screens retain their original materials. */
import { ART_FRAGMENT_SHADER } from './cardShaders';

export const HOME_ART_FRAGMENT_SHADER = ART_FRAGMENT_SHADER
  .replace('vec3(spec) * 0.29', 'vec3(spec) * 0.10')
  .replace('vec3(env) * 0.065', 'vec3(env) * 0.025')
  .replace('vec3(band) * 0.17', 'vec3(band) * 0.045')
  .replace('float rimAmount = 0.40;', 'float rimAmount = 0.16;')
  .replace('mix(flatOut, litOut, uMotion)', 'mix(flatOut, litOut, uMotion * .38)')
  .replace(
  'gl_FragColor = vec4(col, artSample.a);',
  `vec2 pPx = (vUv - .5) * uCardPx;
  float rimDistance = -sdRoundRect(pPx, uCardPx * .5, .085 * uCardPx.x);
  float silverRim = 1.0 - smoothstep(.4, 1.0, rimDistance);
  col = mix(col, vec3(.78, .77, .86), silverRim * .58);
  gl_FragColor = vec4(col, artSample.a);`,
);

export const HOME_ALUMINUM_FRAGMENT_SHADER = `
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

  // Fine horizontal brushing, continuous rather than a tiled/noisy surface.
  float grain = hash12(vec2(floor(vUv.y * 1800.0), 1.0));
  float grainFine = hash12(floor(vUv * vec2(240.0, 1800.0)));
  vec3 base = vec3(0.60, 0.63, 0.68) + (grain - 0.5) * 0.055 + (grainFine - 0.5) * 0.012;
  // Broad, low-contrast reflections keep the engraved text readable.
  float sweep = R.x * .7 + R.y * .35 + (vUv.x - .5) * .65;
  float strip = exp(-pow((sweep - .22) / .20, 2.0));
  float broad = exp(-pow((sweep + .45) / .38, 2.0));
  float dark = exp(-pow((sweep + .04) / .12, 2.0));
  vec3 col = base * (.72 + diff * .10) + envC * .09;
  col += vec3(.12, .13, .15) * strip + vec3(.06, .07, .08) * broad;
  col *= 1.0 - dark * .05;
  // Machined perimeter catches light independently of the satin face.
  float edge = min(min(vUv.x, 1.0-vUv.x), min(vUv.y, 1.0-vUv.y));
  float bevel = 1.0 - smoothstep(.003, .016, edge);
  col = mix(col, vec3(.63, .70, .78) * (.55 + .45 * strip), bevel * .5);
  col += fres * vec3(.07, .08, .11);

  // Correct the metal first; the ink texture already contains display-space colors.
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));

  // 刻印（3層彫り込み・lib/cardBackTexture.ts の carve）を金属の上に合成
  if (uHasInk > 0.5) {
    vec4 ink = texture2D(inkMap, vUv);
    col = mix(col, ink.rgb, ink.a);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;
