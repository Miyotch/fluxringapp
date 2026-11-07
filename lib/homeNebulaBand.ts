/**
 * homeNebulaBand.ts — ホーム背景の星雲（天の川の帯）
 * ------------------------------------------------------------------
 * 公式サイト冒頭の試作（OPENING v30）の帯シェーダー BAND_FS を SkSL へ移したもの。
 * 色と強さの値（BAND_PALETTE）は 2026-11-07 に試作の「色の調整」パネルで
 * 決められたものをそのまま持つ。
 *
 * 作り:
 *   ・帯は画面を斜めに横切る。帯に沿った距離 u と帯を横切る距離 w で全てを記述し、
 *     幅の呼吸・蛇行・雲・暗い筋・縁の淡い雲を 3 次元の value noise（3 つ目の軸が
 *     時間）で変形する。流れるのではなく、形そのものがその場で変わる。
 *   ・色は帯に沿って h1→h5 を渡り、iris で色相が斑にゆっくり移ろう（明るさは
 *     保ったまま色だけ動く）。
 *   ・最後に試作の待機時と同じ幕（veil）を掛けて落ち着かせる。
 *
 * 試作の 2 パス目（帯の上で光る砂粒）は dens=0 で無効化されていたので移していない。
 * 描画は低解像度（試作のスマホと同じ、画面幅 dp × 0.75 物理px）で、拡大して敷く。
 * 帯は滑らかなので粗さは見えない。
 */

const rgb = (c: readonly [number, number, number]) => [c[0] / 255, c[1] / 255, c[2] / 255];

/** 2026-11-07 試作の調整パネルの値（RGB は 0〜255） */
export const BAND_PALETTE = {
  skyT: [5, 9, 34], skyB: [11, 22, 66],
  h1: [5, 2, 13], h2: [92, 146, 246], h3: [58, 94, 226], h4: [87, 136, 214], h5: [7, 23, 59],
  hot: [28, 30, 84], halo: [43, 22, 105], edge: [118, 92, 206],
  body: .4, glow: .14, core: .33, edgeA: .6, lane: .29, width: .9, angle: 27, wave: 1.35, iris: 1,
} as const;

/** 試作の待機時の幕（.veil opacity .38・色 #0C0B1E）。試聴中は .04 まで上がる */
export const BAND_VEIL = .38;
export const BAND_VEIL_COLOR = [12, 11, 30] as const;
/** 試作は読み込みごとに 0〜40 秒のどこかから始める。アプリは固定の位相から */
const BAND_PHASE_S = 20;

const COLORS = {
  skyT: rgb(BAND_PALETTE.skyT), skyB: rgb(BAND_PALETTE.skyB),
  h1: rgb(BAND_PALETTE.h1), h2: rgb(BAND_PALETTE.h2), h3: rgb(BAND_PALETTE.h3), h4: rgb(BAND_PALETTE.h4), h5: rgb(BAND_PALETTE.h5),
  hot: rgb(BAND_PALETTE.hot), halo: rgb(BAND_PALETTE.halo), edge: rgb(BAND_PALETTE.edge),
};

const hex = (c: readonly number[]) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const veiled = (c: readonly [number, number, number]) =>
  hex(c.map((v, i) => v + (BAND_VEIL_COLOR[i] - v) * BAND_VEIL));
/** シェーダーが作れない環境向け: 帯なしの地色（上→下）に幕を掛けたもの */
export const BAND_FALLBACK_COLORS = [veiled(BAND_PALETTE.skyT), veiled(BAND_PALETTE.skyB)];

/** 帯の置き方（試作 buildSky と同じ）。縦長では角度を 32° 立て、帯を少し太くする */
export function bandGeometry(width: number, height: number) {
  'worklet';
  const portrait = width < height;
  const ang = -(BAND_PALETTE.angle + (portrait ? 32 : 0)) * Math.PI / 180;
  return {
    dir: [Math.cos(ang), Math.sin(ang)],
    BW: Math.min(width, height) * (portrait ? .26 : .22) * BAND_PALETTE.width,
    origin: [width * .56, height * .5],
  };
}

/** 星の寄せ先（lib/homeStarfieldModel.ts の makeHomeStars 用）。高さを 1 とした単位 */
export function bandStarGeometry(width: number, height: number) {
  const g = bandGeometry(width, height);
  return { dir: g.dir, ox: g.origin[0] / height, oy: g.origin[1] / height, bw: g.BW / height };
}

/** 1 フレームぶんの uniforms。seconds は止められる時計の累計秒、strength はゆらぎの深さ（速さに掛ける） */
export function bandUniforms(seconds: number, strength: number, width: number, height: number) {
  'worklet';
  const g = bandGeometry(width, height);
  return {
    resolution: [width, height],
    origin: g.origin,
    dir: g.dir,
    BW: g.BW,
    tm: (seconds * strength + BAND_PHASE_S) * .5 * BAND_PALETTE.wave,
    skyT: COLORS.skyT, skyB: COLORS.skyB,
    h1: COLORS.h1, h2: COLORS.h2, h3: COLORS.h3, h4: COLORS.h4, h5: COLORS.h5,
    hot: COLORS.hot, halo: COLORS.halo, edge: COLORS.edge,
    body: BAND_PALETTE.body, glowP: BAND_PALETTE.glow, coreP: BAND_PALETTE.core,
    edgeA: BAND_PALETTE.edgeA, laneP: BAND_PALETTE.lane, iris: BAND_PALETTE.iris,
    veil: BAND_VEIL,
  };
}

/** 試作 BAND_FS の SkSL 版。座標は Canvas の px（y は下向き）、resolution はその大きさ */
export const HOME_NEBULA_BAND_SHADER = `
uniform float2 resolution;
uniform float2 origin;
uniform float2 dir;
uniform float BW;
uniform float tm;
uniform float3 skyT;
uniform float3 skyB;
uniform float3 h1;
uniform float3 h2;
uniform float3 h3;
uniform float3 h4;
uniform float3 h5;
uniform float3 hot;
uniform float3 halo;
uniform float3 edge;
uniform float body;
uniform float glowP;
uniform float coreP;
uniform float edgeA;
uniform float laneP;
uniform float iris;
uniform float veil;

float hs(float3 p) {
  p = fract(p * .3183099 + float3(.1, .17, .13));
  p *= 17.;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float n3(float3 x) {
  float3 i = floor(x), f = fract(x);
  f = f * f * (3. - 2. * f);
  return mix(mix(mix(hs(i), hs(i + float3(1., 0., 0.)), f.x), mix(hs(i + float3(0., 1., 0.)), hs(i + float3(1., 1., 0.)), f.x), f.y),
             mix(mix(hs(i + float3(0., 0., 1.)), hs(i + float3(1., 0., 1.)), f.x), mix(hs(i + float3(0., 1., 1.)), hs(i + float3(1., 1., 1.)), f.x), f.y), f.z);
}
// 1/f: 細かいオクターブほど半分の強さ。o 段まで（ループ回数は定数で固定）
float fbm(float3 q, int o) {
  float s = 0., a = .5, n = 0.;
  for (int k = 0; k < 5; k++) {
    if (k < o) {
      s += a * n3(q);
      n += a;
      q = float3(q.x * .8776 - q.y * .4794, q.x * .4794 + q.y * .8776, q.z) * float3(2.03, 2.03, 2.) + float3(17.3, -9.1, 3.7);
      a *= .5;
    }
  }
  return s / n;
}
float ss(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0., 1.); return t * t * (3. - 2. * t); }
float sq(float x) { return x * x; }
float3 hue(float t) {
  if (t < -.55) return mix(h1, h2, (t + 1.) / .45);
  if (t < -.1) return mix(h2, h3, (t + .55) / .45);
  if (t < .35) return mix(h3, h4, (t + .1) / .45);
  return mix(h4, h5, (t - .35) / .65);
}

half4 main(float2 xy) {
  float Wc = resolution.x, Hc = resolution.y;
  float X = xy.x - origin.x, Y = xy.y - origin.y;
  float u = X * dir.x + Y * dir.y, w = -X * dir.y + Y * dir.x, T = tm;
  // 片方の端は暖かく（芯）、もう片方は冷たく
  float warm = ss(-.05 * Wc, -.6 * Wc, u), cool = ss(.1 * Wc, .8 * Wc, u);
  // 帯は幅が呼吸し、進むにつれ軸から少し外れる
  float wv = BW * (.8 + .45 * fbm(float3(u / Wc * 1.4 + 3., 1.7, T * .11), 3)) * (1. + .55 * warm);
  float off = BW * .35 * (fbm(float3(u / Wc * 1.1 - 4., 5.2, T * .09 + 2.), 3) - .5);
  float a = (w - off) / wv;
  // 雲: 歪んだ中くらいの塊。帯の縁も崩す
  float wu = fbm(float3(u / Wc * 2.2 + 9., w / Wc * 2.2, T * .13 + 5.), 2), wv2 = fbm(float3(u / Wc * 2.2 - 3., w / Wc * 2.2 + 5., T * .12 + 8.), 2);
  float cl = fbm(float3(u / Wc * 3.2 + 1.4 * wu, w / Wc * 4.2 + 1.4 * wv2, T * .1 + 1.), 5), cl2 = fbm(float3(u / Wc * 7. + 2. * wu, w / Wc * 9. + 2. * wv2, T * .16 + 6.), 3);
  float ae = a + .5 * (cl - .5);
  float glow = exp(-ae * ae * 1.3) * (.55 + .6 * cl), core = exp(-ae * ae * 4.5);
  float cloud = .35 + 1.1 * ss(.32, .78, cl) * (.65 + .5 * cl2);
  // 暗い筋: 帯に沿う長い裂け目が 2 本、芯で最も強い
  float ln1 = fbm(float3(u / Wc * 1.6 + .7 * wu, (w - off) / BW * 1.2 + 3., T * .08 + 4.), 4), ln2 = fbm(float3(u / Wc * 2.6 - 5. + .5 * wv2, (w - off) / BW * 2. - 7., T * .1 + 9.), 3);
  float lane = max(ss(.54, .7, ln1), .8 * ss(.6, .74, ln2)) * exp(-a * a * 1.6);
  // 縁の淡い雲
  float em = ss(.62, .8, fbm(float3(u / Wc * 4.5 - 11., w / Wc * 4.5 + 4., T * .1 + 3.), 4)) * exp(-sq(abs(ae) - .8) * 5.) * glow;
  // 色は帯に沿って渡る
  float t = clamp(u / (Wc * .7), -1., 1.);
  float3 cc = hue(t), oc = mix(cc, halo, .5 + .3 * cool);
  // 色の移ろい（オパールのように）: 明るさはその場のまま、色相だけが斑に動く
  float p1 = fbm(float3(u / Wc * 1.6 + 21., w / Wc * 1.6, T * .06 + 2.), 4), p2 = fbm(float3(u / Wc * 2.3 - 8., w / Wc * 2.3 + 13., T * .08 + 7.), 4);
  float3 play = mix(mix(h2, mix(h4, edge, .45), ss(.38, .62, p1)), mix(h5, float3(.36, .82, .86), .35), ss(.46, .66, p2));
  float3 L = float3(.2126, .7152, .0722);
  float lum = dot(cc, L), lp = max(.001, dot(play, L));
  cc = mix(cc, play * (lum / lp), iris);
  oc = mix(oc, mix(halo, play * (dot(oc, L) / lp), .6), iris * .7);
  float3 c = mix(skyT, skyB, xy.y / Hc);
  c = mix(c, mix(oc, skyB, .45), min(1., glow * glowP));
  c = mix(c, cc, min(1., pow(core * cloud, 1.25) * (body + .42 * warm)));
  c = mix(c, hot, min(1., pow(core * cloud, 2.6) * coreP * warm));
  c = mix(c, edge, min(.45 * edgeA / .8, em * edgeA));
  c = mix(c, mix(skyT, skyB, .55), laneP * lane);
  // 幕
  c = mix(c, float3(.047, .043, .118), veil);
  return half4(half3(c), 1.);
}
`;
