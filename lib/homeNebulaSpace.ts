import { CLOUD_SIGNALS, NEBULA_LIGHT, NEBULA_MORPH, PINK_SECONDS } from './homePinkNoise';

/** Smooth interpolation of the band-limited 1/f field; all planes share this clock. */
export function pinkAt(values: readonly number[], seconds: number): number {
  'worklet';
  const t = ((seconds % PINK_SECONDS) + PINK_SECONDS) % PINK_SECONDS;
  const i = Math.floor(t), u = t - i, smooth = u * u * (3 - 2 * u);
  return values[i] + (values[i + 1] - values[i]) * smooth;
}

/** Shared flow reaches the three depths with a delay, plus small local differences. */
export function nebulaMotion(seconds: number, strength: number, layer: number) {
  'worklet';
  const local = CLOUD_SIGNALS[layer], delay = layer * 7;
  const x = .76 * pinkAt(NEBULA_MORPH, seconds - delay) + .24 * pinkAt(local.horizontal, seconds);
  const y = .76 * pinkAt(NEBULA_LIGHT, seconds - delay) + .24 * pinkAt(local.vertical, seconds);
  return {
    // A very slow carrier keeps wisps evolving through the quiet parts of 1/f.
    // Integer harmonics keep the complete deformation seamless at the loop boundary.
    flow: [
      x * 2.8 * strength + (((seconds - delay) % PINK_SECONDS + PINK_SECONDS) % PINK_SECONDS) * Math.PI * 22 / PINK_SECONDS,
      y * 2.4 * strength + (((seconds - delay) % PINK_SECONDS + PINK_SECONDS) % PINK_SECONDS) * Math.PI * 14 / PINK_SECONDS,
    ],
    density: .62 + .22 * strength * (.7 * pinkAt(NEBULA_LIGHT, seconds - delay) + .3 * pinkAt(local.density, seconds)),
    depth: layer,
    strength,
  };
}

/** Texture-domain deformation: contours stretch and dissolve locally, not as a sheet.
 * Premultiplied source-over alpha is also the extinction of stars behind this plane.
 * Three texture taps, no per-pixel procedural noise / fbm / CPU image generation.
 */
export const HOME_NEBULA_SPACE_SHADER = `
uniform shader cloud;
uniform float2 resolution;
uniform float2 flow;
uniform float density;
uniform float depth;
uniform float strength;

half4 main(float2 xy) {
  float2 uv = xy / resolution;
  float aspect = resolution.x / resolution.y;
  float2 p = uv * float2(aspect, 1.0);
  float2 curl = float2(
    sin(p.y * 7.3 + flow.x) + .38 * sin((p.x + p.y) * 12.0 - flow.y),
    cos(p.x * 9.1 + flow.y) + .30 * sin(p.y * 13.0 - flow.x)
  );
  float2 warp = curl * float2(.046, .014) * strength * (1.0 + depth * .14);
  float2 q = uv + warp;
  // Two nearby wisps slide through one another; their shared field shapes the opening.
  half4 first = cloud.eval(q * resolution);
  float2 offset = float2(.046 * sin(flow.y + p.y * 4.1), .020 * cos(flow.x + p.x * 5.2)) * strength;
  half4 second = cloud.eval((q + offset) * resolution);
  float blend = .5 + .22 * sin(p.y * 5.8 + p.x * 3.4 + flow.x - flow.y);
  half4 pigment = mix(first, second, blend);
  float grain = cloud.eval((uv + warp * .48) * resolution).a;
  float edge = smoothstep(0.0, .045, uv.x) * smoothstep(0.0, .045, 1.0 - uv.x)
    * smoothstep(0.0, .045, uv.y) * smoothstep(0.0, .045, 1.0 - uv.y);
  // A spatially varying wash changes the contour, not the whole screen's exposure.
  float wash = .76 + .24 * sin(p.y * 9.0 - p.x * 6.2 + flow.y);
  float alpha = clamp(pigment.a * density * wash * (0.88 + grain * .24) * edge, 0.0, .78);
  half3 color = pigment.a > .0001 ? pigment.rgb / pigment.a : half3(0.0);
  return half4(color * 1.16 * alpha, alpha);
}
`;
