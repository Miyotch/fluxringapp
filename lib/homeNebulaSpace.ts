import { CLOUD_SIGNALS, NEBULA_LIGHT, NEBULA_MORPH, PINK_SECONDS } from './homePinkNoise';

/** Smooth interpolation of the band-limited 1/f field; all planes share this clock. */
export function pinkAt(values: readonly number[], seconds: number): number {
  'worklet';
  const t = ((seconds % PINK_SECONDS) + PINK_SECONDS) % PINK_SECONDS;
  const i = Math.floor(t), u = t - i, smooth = u * u * (3 - 2 * u);
  return values[i] + (values[i + 1] - values[i]) * smooth;
}

export const NEBULA_MOTION_SPEED = .65;
// Half of build (6)'s cloud opacity; preserve its contours and slow breathing.
export const NEBULA_OPACITY = .5;

/** Shared flow reaches the three depths with a delay, plus small local differences. */
export function nebulaMotion(seconds: number, strength: number, layer: number) {
  'worklet';
  // Slow both contour evolution and density without changing the approved shapes.
  seconds *= NEBULA_MOTION_SPEED;
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
    // Each plane travels right across the viewport, then re-enters seamlessly.
    drift: (((seconds % PINK_SECONDS) + PINK_SECONDS) % PINK_SECONDS) / PINK_SECONDS * (18 + layer * 6),
  };
}

/** Texture-domain deformation: contours stretch and dissolve locally, not as a sheet.
 * Premultiplied source-over alpha is also the extinction of stars behind this plane.
 * Two texture taps and a bounded, smooth noise field on the low-resolution GPU plane.
 */
export const HOME_NEBULA_SPACE_SHADER = `
uniform shader cloud;
uniform float2 resolution;
uniform float2 flow;
uniform float density;
uniform float depth;
uniform float strength;
uniform float drift;

float fieldHash(float2 p) {
  float3 h = fract(float3(p.x, p.y, p.x) * .1031);
  h += dot(h, h.yzx + 33.33);
  return fract((h.x + h.y) * h.z);
}
float fieldNoise(float2 p) {
  float2 cell = floor(p), f = fract(p);
  // Quintic interpolation keeps both velocity and acceleration smooth at cell edges.
  float2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(fieldHash(cell), fieldHash(cell + float2(1, 0)), u.x),
    mix(fieldHash(cell + float2(0, 1)), fieldHash(cell + float2(1, 1)), u.x), u.y);
}

half4 main(float2 xy) {
  float2 uv = xy / resolution;
  float aspect = resolution.x / resolution.y;
  float2 p = uv * float2(aspect, 1.0);
  // Periodic coordinates keep the long loop seamless; no sine stripes touch the image.
  float2 travel = float2(sin(flow.x), cos(flow.y)) * .85;
  float2 counter = float2(cos(flow.x + flow.y), sin(flow.y - flow.x)) * .65;
  float2 domain = p * 5.2 + float2(depth * 13.7, depth * 7.9);
  float2 broad = float2(fieldNoise(domain + travel), fieldNoise(domain + counter + 19.3));
  float2 detail = float2(fieldNoise(domain * 2.1 + broad * 1.7 + counter + 4.8),
    fieldNoise(domain * 2.1 + broad * 1.7 - travel + 31.6));
  float2 curl = (broad - .5) * 1.5 + (detail - .5) * .65;
  float2 warp = curl * float2(.12, .055) * strength * (1.0 + depth * .14);
  float2 q = uv + warp;
  q.x = fract(q.x - drift);
  // Two nearby wisps slide through one another; their shared field shapes the opening.
  float firstEdge = smoothstep(0.0, .12, q.x) * smoothstep(0.0, .12, 1.0 - q.x);
  half4 first = cloud.eval(q * resolution) * firstEdge;
  float2 offset = (detail - .5) * float2(.09, .045) * strength;
  float2 secondQ = float2(fract(q.x + offset.x), q.y + offset.y);
  float secondEdge = smoothstep(0.0, .12, secondQ.x) * smoothstep(0.0, .12, 1.0 - secondQ.x);
  half4 second = cloud.eval(secondQ * resolution) * secondEdge;
  float blend = .3 + .4 * broad.y;
  half4 pigment = mix(first, second, blend);
  float edge = smoothstep(0.0, .045, uv.x) * smoothstep(0.0, .045, 1.0 - uv.x)
    * smoothstep(0.0, .045, uv.y) * smoothstep(0.0, .045, 1.0 - uv.y);
  // A spatially varying wash changes the contour, not the whole screen's exposure.
  float wash = .60 + .36 * fieldNoise(domain * 1.4 + broad * 2.0 - counter + 8.1);
  float alpha = clamp(pigment.a * density * wash * (.88 + pigment.a * .24) * edge, 0.0, .78) * ${NEBULA_OPACITY};
  half3 color = pigment.a > .0001 ? pigment.rgb / pigment.a : half3(0.0);
  return half4(color * 1.16 * alpha, alpha);
}
`;
