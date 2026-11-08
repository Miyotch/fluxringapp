// HOME の帯の星雲（lib/homeNebulaBand.ts）が 1/f ゆらぎで動くことを確かめる。
//   node scripts/test-home-band-pink.cjs
// 1. 3 本の 1/f 信号: 一周でつながる・標準偏差 1・周期 4〜256 秒の範囲でパワー×周波数が一定（＝1/f）、
//    範囲の外にパワーが無い
// 2. 毎フレームの uniforms: 形の時間変化（tm）は一定、明るさの強弱（breath）は 1/f 信号に比例、
//    流れ（flow）は一定速度で BAND_MOTION.flow 以下
const fs = require('fs');
const ts = require('typescript');
const vm = require('vm');
const assert = require('assert/strict');

const exportsObject = {};
const src = ts.transpileModule(fs.readFileSync('lib/homeNebulaBand.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(src, { exports: exportsObject, Math, Float64Array, Array });
const { BAND_PINK, BAND_PINK_SIGNALS, BAND_MOTION, bandPinkAt, bandUniforms } = exportsObject;

const n = BAND_PINK.period * BAND_PINK.rate;
for (const table of BAND_PINK_SIGNALS) {
  assert.equal(table.length, n + 1);
  assert.equal(table[0], table[n], 'the loop must be seamless');
  const values = table.slice(0, n);
  const mean = values.reduce((a, v) => a + v, 0) / n;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
  assert.ok(Math.abs(mean) < 1e-9, 'zero mean');
  assert.ok(Math.abs(sd - 1) < 1e-9, 'unit standard deviation');
  // DFT at every k up to 2 * kMax: power * k is constant inside the band and zero outside
  const inBand = [], outBand = [];
  for (let k = 1; k <= BAND_PINK.kMax * 2; k++) {
    let re = 0, im = 0;
    for (let t = 0; t < n; t++) { const a = 2 * Math.PI * k * t / n; re += values[t] * Math.cos(a); im += values[t] * Math.sin(a); }
    const p = re * re + im * im;
    (k >= BAND_PINK.kMin && k <= BAND_PINK.kMax ? inBand : outBand).push(p * k);
  }
  assert.ok(Math.max(...inBand) / Math.min(...inBand) < 1.000001, 'power x frequency must be constant (1/f)');
  assert.ok(Math.max(...outBand) < Math.min(...inBand) * 1e-12, 'no power outside the 1/f band');
}
console.log(`PASS: 3 signals are 1/f between ${BAND_PINK.period / BAND_PINK.kMax} and ${BAND_PINK.period / BAND_PINK.kMin} s, seamless, unit sd`);

for (const strength of [.6, 1, 1.4]) {
  const amp = BAND_MOTION.breath * strength / Math.sqrt(3);
  const first = bandUniforms(0, strength, 300, 680, .78);
  for (let s = 0; s < BAND_PINK.period; s += 7.3) {
    const u = bandUniforms(s, strength, 300, 680, .78);
    assert.equal(u.tm, first.tm, 'no time-driven morph: the shape term must stay fixed');
    u.breath.forEach((b, i) => assert.ok(Math.abs(b - amp * bandPinkAt(BAND_PINK_SIGNALS[i], s)) < 1e-12, 'breath is proportional to the 1/f signal'));
    assert.ok(Math.abs(u.flow - s * BAND_MOTION.flow * 300) < 1e-9, 'flow is a constant, slow drift');
  }
}
assert.ok(BAND_MOTION.flow <= .001, 'a faster drift turns the brightness spectrum into 1/f^2 (measured 2026-11-08)');
console.log('PASS: brightness changes only through the 1/f signals; shape fixed; slow constant flow');
