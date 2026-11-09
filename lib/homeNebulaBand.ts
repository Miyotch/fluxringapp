/**
 * homeNebulaBand.ts — ホーム背景の星雲（天の川の帯）
 * ------------------------------------------------------------------
 * 公式サイト冒頭の試作（OPENING v30）の帯シェーダー BAND_FS を SkSL へ移したもの。
 * 色と強さの値（BAND_PALETTE）は 2026-11-07 に試作の「色の調整」パネルで
 * 決められたものをそのまま持つ。
 *
 * 作り:
 *   ・帯は画面を斜めに横切る。帯に沿った距離 u と帯を横切る距離 w で全てを記述し、
 *     幅の呼吸・蛇行・雲・暗い筋・縁の淡い雲を value noise の fbm で作る。
 *   ・動きは 1/f ゆらぎ（BAND_MOTION・下の「動きと 1/f」）。帯の光が場所ごとに本物の
 *     1/f 信号で強まり弱まり、中の模様はごくゆっくり帯に沿って右上へ流れて画面外へ抜ける。
 *   ・色は帯に沿って h1→h5 を渡り、iris で色相が斑にゆっくり移ろう（明るさは
 *     保ったまま色だけ動く）。
 *   ・最後に幕（veil）を掛けて落ち着かせる。
 *   ・ホームではカードの下（カード下端〜タブバーの間）に軸を通す（BAND_BELOW_CARD）。
 *     2026-11-08 の初版は試作どおり画面中央に立てて置き、芯が全部カードの後ろに隠れた。
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
  body: .4, glow: .14, core: .33, edgeA: .6, lane: .29, width: .9, angle: 27, wave: 1.35, iris: 1, lift: 1.6,
} as const;

/**
 * 幕の濃さと明るさ。試作には 2 つの見え方があり、どちらも 2026-11-07 に試作の調整パネルで決めた値:
 *   待機中 … 幕 .38・明るさ 1（文字を読ませるため暗く沈める）
 *   試聴中 … 幕 .04・明るさ 1.6（lift。CSS の brightness(1.6) を空全体に掛ける）
 * ホームは帯がカードの外の狭い帯域にしか出ない。待機中の値では実機で地色と見分けがつかなかった
 * （2026-11-08、帯域の明るさ 255 中 26）ので、試聴中の値を使う。
 */
export const BAND_VEIL = .04;
export const BAND_LIFT = BAND_PALETTE.lift;
export const BAND_VEIL_COLOR = [12, 11, 30] as const;
/** 試作は読み込みごとに 0〜40 秒のどこかから始める。アプリは固定の位相から */
const BAND_PHASE_S = 20;

/**
 * 動きと 1/f（2026-11-08）。
 * 試作は fbm の時間軸を一定の速さで進めて形を変えていた。「細かい段ほど半分の強さで倍の速さ」は
 * 振幅が 1/f、パワーでは 1/f² で、明るさを実測すると周期 5〜50 秒で傾き約 -2.4、50 秒より長い側は
 * 平らだった（1/f ゆらぎなら -1）。そこで時間で形を変えるのをやめ、明るさの変化を本物の 1/f 信号で作る:
 *   breath … 帯の光（地色との差）を (1 + b) 倍する。b は 3 本の独立な 1/f 信号を、場所ごとに違う
 *            重み（動かない fbm の模様）で混ぜたもの。b は信号に比例するので、どの画素の明るさも
 *            信号と同じ 1/f になる（独立な 1/f の和は 1/f）。値は b の標準偏差の目安で、
 *            「星雲のゆらぎの深さ」（strength 0.6／1／1.4）を掛ける
 *   flow   … 中の模様が帯に沿って右上へ流れ、画面外へ抜ける速さ（画面幅 / 秒）。一定速度の移動は
 *            ゆらぎではなく、速いと傾きを崩す（.01 では 1/f² が勝った）ので、明るさの 1/f を崩さない .001 に抑える
 * 実測（JS へ写した計算で、画面の帯の 8 か所・2048 秒）: 周期 4〜256 秒の傾き -0.91〜-1.13。
 * 信号が 1/f であること・明るさがその信号だけで動くことは scripts/test-home-band-pink.cjs で確かめる。
 */
export const BAND_MOTION = { breath: .5, flow: .001 } as const;

/**
 * 帯域を限った 1/f 信号（周期 BAND_PINK.period 秒で一周する）。周波数 k/period の成分を振幅 1/√k で
 * 足す＝パワーが 1/f。k = kMin〜kMax なので周期 4〜256 秒の範囲だけが 1/f。標準偏差 1 にそろえる。
 * 逆 FFT で一度だけ作る（4096 点。描画中の計算は表を引くだけ）。
 */
export const BAND_PINK = { period: 2048, rate: 2, kMin: 8, kMax: 512 } as const;
export function bandPinkTable(seed: number): number[] {
  const n = BAND_PINK.period * BAND_PINK.rate, re = new Float64Array(n), im = new Float64Array(n);
  let state = seed >>> 0;
  for (let k = BAND_PINK.kMin; k <= BAND_PINK.kMax; k++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const phase = state / 4294967296 * Math.PI * 2, a = 1 / Math.sqrt(k);
    re[k] = a * Math.cos(phase); im[k] = a * Math.sin(phase);
    re[n - k] = re[k]; im[n - k] = -im[k];
  }
  // 逆 FFT（基数 2）。実数になるよう共役対称に入れてあるので、結果は re だけを使う
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = 2 * Math.PI / len;
    for (let i = 0; i < n; i += len) for (let j = 0; j < len / 2; j++) {
      const wr = Math.cos(ang * j), wi = Math.sin(ang * j), a = i + j, b = a + len / 2;
      const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
      re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
    }
  }
  let ss = 0;
  for (let t = 0; t < n; t++) ss += re[t] * re[t];
  const rms = Math.sqrt(ss / n), out = Array.from(re, v => v / rms);
  out.push(out[0]);
  return out;
}
/** 3 本の独立な 1/f 信号（帯の光の強弱に使う） */
export const BAND_PINK_SIGNALS = [20261108, 1109, 7741].map(bandPinkTable);
/** 表を時刻 seconds で引く（なめらかに補間・周期で折り返す） */
export function bandPinkAt(table: readonly number[], seconds: number): number {
  'worklet';
  const n = table.length - 1, x = ((seconds * BAND_PINK.rate) % n + n) % n, i = Math.floor(x), u = x - i;
  return table[i] + (table[i + 1] - table[i]) * u * u * (3 - 2 * u);
}

/**
 * ホームでの置き場所: カードの下端からフッター（タブバー）の上端までの帯域に、帯の軸を通す。
 *   x  … 軸の基準点の横位置（画面幅比）
 *   t  … 帯域の中での縦位置（0 = カードの下端、1 = フッターの上端）
 * 角度と太さは試作の横長（PC）の値（27°・短辺 × .22 × width）。縦長用の +32° は、帯を文字の後ろへ
 * 立てて通す試作の都合なので使わない（立てると芯が全部カードの後ろへ入る）。
 */
export const BAND_BELOW_CARD = { x: .5, t: .5 } as const;
/** 帯の軸の基準点（高さ比）。cardBottomY・stripBottomY は同じ単位（dp）で渡す */
export function bandAnchorBelowCard(cardBottomY: number, stripBottomY: number, height: number) {
  if (height <= 0) return undefined;
  return (cardBottomY + (stripBottomY - cardBottomY) * BAND_BELOW_CARD.t) / height;
}

const COLORS = {
  skyT: rgb(BAND_PALETTE.skyT), skyB: rgb(BAND_PALETTE.skyB),
  h1: rgb(BAND_PALETTE.h1), h2: rgb(BAND_PALETTE.h2), h3: rgb(BAND_PALETTE.h3), h4: rgb(BAND_PALETTE.h4), h5: rgb(BAND_PALETTE.h5),
  hot: rgb(BAND_PALETTE.hot), halo: rgb(BAND_PALETTE.halo), edge: rgb(BAND_PALETTE.edge),
};

const hex = (c: readonly number[]) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const veiled = (c: readonly [number, number, number]) =>
  hex(c.map((v, i) => Math.min(255, (v + (BAND_VEIL_COLOR[i] - v) * BAND_VEIL) * BAND_LIFT)));
/** シェーダーが作れない環境向け: 帯なしの地色（上→下）に幕を掛けたもの */
export const BAND_FALLBACK_COLORS = [veiled(BAND_PALETTE.skyT), veiled(BAND_PALETTE.skyB)];

/**
 * 帯の置き方。
 *   anchorY あり … ホーム: 軸を (BAND_BELOW_CARD.x, anchorY) に通し、試作の横長の角度・太さで置く
 *   anchorY なし … 試作 buildSky と同じ（画面中央・縦長では角度を 32° 立てて帯を少し太く）
 */
export function bandGeometry(width: number, height: number, anchorY?: number) {
  'worklet';
  if (anchorY !== undefined) {
    const ang = -BAND_PALETTE.angle * Math.PI / 180;
    return {
      dir: [Math.cos(ang), Math.sin(ang)],
      BW: Math.min(width, height) * .22 * BAND_PALETTE.width,
      origin: [width * BAND_BELOW_CARD.x, height * anchorY],
    };
  }
  const portrait = width < height;
  const ang = -(BAND_PALETTE.angle + (portrait ? 32 : 0)) * Math.PI / 180;
  return {
    dir: [Math.cos(ang), Math.sin(ang)],
    BW: Math.min(width, height) * (portrait ? .26 : .22) * BAND_PALETTE.width,
    origin: [width * .56, height * .5],
  };
}

/** 星の寄せ先（lib/homeStarfieldModel.ts の makeHomeStars 用）。高さを 1 とした単位 */
export function bandStarGeometry(width: number, height: number, anchorY?: number) {
  const g = bandGeometry(width, height, anchorY);
  return { dir: g.dir, ox: g.origin[0] / height, oy: g.origin[1] / height, bw: g.BW / height };
}

/** 1 フレームぶんの uniforms。seconds は止められる時計の累計秒、strength はゆらぎの深さ（揺れの大きさに掛ける） */
export function bandUniforms(seconds: number, strength: number, width: number, height: number, anchorY?: number) {
  'worklet';
  const g = bandGeometry(width, height, anchorY);
  // 3 本を等しく混ぜたときに b の標準偏差が breath × strength の目安になるよう 1/√3 を掛ける
  const amp = BAND_MOTION.breath * strength / Math.sqrt(3);
  return {
    resolution: [width, height],
    origin: g.origin,
    dir: g.dir,
    BW: g.BW,
    // 形の時間変化は使わない（固定の位相）。明るさの変化は breath、移動は flow だけ
    tm: BAND_PHASE_S * .5 * BAND_PALETTE.wave,
    flow: seconds * BAND_MOTION.flow * width,
    breath: [
      amp * bandPinkAt(BAND_PINK_SIGNALS[0], seconds),
      amp * bandPinkAt(BAND_PINK_SIGNALS[1], seconds),
      amp * bandPinkAt(BAND_PINK_SIGNALS[2], seconds),
    ],
    skyT: COLORS.skyT, skyB: COLORS.skyB,
    h1: COLORS.h1, h2: COLORS.h2, h3: COLORS.h3, h4: COLORS.h4, h5: COLORS.h5,
    hot: COLORS.hot, halo: COLORS.halo, edge: COLORS.edge,
    body: BAND_PALETTE.body, glowP: BAND_PALETTE.glow, coreP: BAND_PALETTE.core,
    edgeA: BAND_PALETTE.edgeA, laneP: BAND_PALETTE.lane, iris: BAND_PALETTE.iris,
    veil: BAND_VEIL,
    lift: BAND_LIFT,
  };
}

/** 試作 BAND_FS の SkSL 版。座標は Canvas の px（y は下向き）、resolution はその大きさ */
export const HOME_NEBULA_BAND_SHADER = `
uniform float2 resolution;
uniform float2 origin;
uniform float2 dir;
uniform float BW;
uniform float tm;
uniform float flow;
uniform float3 breath;
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
uniform float lift;

// 格子点の乱数。試作の hs（fract(p*.3183+c)*17 の積の小数部）は、同じ格子点を隣の画素が
// 計算し直したときに GPU の丸め（積和の融合のしかた）で別の値になることがあり、雲の中に
// 直線の縁を持つ三角形・四角形が出ていた（試作の WebGL にも同じものが出る）。
// ここでは整数だけで正確に計算できる置換多項式 (34x²+x) mod 289 を使う。途中の値は
// どれも 10 万未満の整数なので、どの画素で計算しても必ず同じ値になる。
float md(float a) { return a - 289. * floor((a + .5) * .0034602076); }
float pm(float x) { x = md(x); return md(md(x * 34. + 1.) * x); }
float n3(float3 x) {
  float3 i = floor(x), f = fract(x);
  f = f * f * (3. - 2. * f);
  float a0 = pm(i.x), a1 = pm(i.x + 1.);
  float b00 = pm(a0 + i.y), b10 = pm(a1 + i.y), b01 = pm(a0 + i.y + 1.), b11 = pm(a1 + i.y + 1.);
  float c000 = pm(b00 + i.z), c100 = pm(b10 + i.z), c010 = pm(b01 + i.z), c110 = pm(b11 + i.z);
  float c001 = pm(b00 + i.z + 1.), c101 = pm(b10 + i.z + 1.), c011 = pm(b01 + i.z + 1.), c111 = pm(b11 + i.z + 1.);
  return mix(mix(mix(c000, c100, f.x), mix(c010, c110, f.x), f.y),
             mix(mix(c001, c101, f.x), mix(c011, c111, f.x), f.y), f.z) * .0034602076;
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
  // 模様だけが帯に沿って流れる座標。芯の暖かさ・色の並び（warm／cool／hue）は u のまま固定
  float uf = u - flow;
  // 片方の端は暖かく（芯）、もう片方は冷たく
  float warm = ss(-.05 * Wc, -.6 * Wc, u), cool = ss(.1 * Wc, .8 * Wc, u);
  // 帯は幅が呼吸し、進むにつれ軸から少し外れる
  float wv = BW * (.8 + .45 * fbm(float3(uf / Wc * 1.4 + 3., 1.7, T * .11), 3)) * (1. + .55 * warm);
  float off = BW * .35 * (fbm(float3(uf / Wc * 1.1 - 4., 5.2, T * .09 + 2.), 3) - .5);
  float a = (w - off) / wv;
  // 雲: 歪んだ中くらいの塊。帯の縁も崩す
  float wu = fbm(float3(uf / Wc * 2.2 + 9., w / Wc * 2.2, T * .13 + 5.), 2), wv2 = fbm(float3(uf / Wc * 2.2 - 3., w / Wc * 2.2 + 5., T * .12 + 8.), 2);
  float cl = fbm(float3(uf / Wc * 3.2 + 1.4 * wu, w / Wc * 4.2 + 1.4 * wv2, T * .1 + 1.), 5), cl2 = fbm(float3(uf / Wc * 7. + 2. * wu, w / Wc * 9. + 2. * wv2, T * .16 + 6.), 3);
  float ae = a + .5 * (cl - .5);
  float glow = exp(-ae * ae * 1.3) * (.55 + .6 * cl), core = exp(-ae * ae * 4.5);
  float cloud = .35 + 1.1 * ss(.32, .78, cl) * (.65 + .5 * cl2);
  // 暗い筋: 帯に沿う長い裂け目が 2 本、芯で最も強い
  float ln1 = fbm(float3(uf / Wc * 1.6 + .7 * wu, (w - off) / BW * 1.2 + 3., T * .08 + 4.), 4), ln2 = fbm(float3(uf / Wc * 2.6 - 5. + .5 * wv2, (w - off) / BW * 2. - 7., T * .1 + 9.), 3);
  float lane = max(ss(.54, .7, ln1), .8 * ss(.6, .74, ln2)) * exp(-a * a * 1.6);
  // 縁の淡い雲
  float em = ss(.62, .8, fbm(float3(uf / Wc * 4.5 - 11., w / Wc * 4.5 + 4., T * .1 + 3.), 4)) * exp(-sq(abs(ae) - .8) * 5.) * glow;
  // 色は帯に沿って渡る
  float t = clamp(u / (Wc * .7), -1., 1.);
  float3 cc = hue(t), oc = mix(cc, halo, .5 + .3 * cool);
  // 色の移ろい（オパールのように）: 明るさはその場のまま、色相だけが斑に動く
  float p1 = fbm(float3(uf / Wc * 1.6 + 21., w / Wc * 1.6, T * .06 + 2.), 4), p2 = fbm(float3(uf / Wc * 2.3 - 8., w / Wc * 2.3 + 13., T * .08 + 7.), 4);
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
  // 1/f の強弱: 帯の光（地色との差）を (1 + b) 倍する。重み g は動かない模様（流れに乗せず画面に固定）
  float3 g = float3(fbm(float3(u / Wc * 1.3 + 31., w / Wc * 1.3, 50.), 2),
                    fbm(float3(u / Wc * 1.3 + 48., w / Wc * 1.3 - 7., 61.), 2),
                    fbm(float3(u / Wc * 1.3 + 65., w / Wc * 1.3 - 14., 72.), 2));
  g = clamp((g - .5) * 5., -1., 1.);
  float3 base = mix(skyT, skyB, xy.y / Hc);
  c = base + (c - base) * max(0., 1. + dot(g, breath));
  // 幕
  c = mix(c, float3(.047, .043, .118), veil);
  // 明るさ（試作の .sky.lift と同じく、幕のあとで全体に掛ける）
  c = min(c * lift, float3(1.));
  return half4(half3(c), 1.);
}
`;
