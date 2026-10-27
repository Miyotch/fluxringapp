// Compare the native model against the independently supplied HTML reference.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'lib/homeStarfieldModel.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const modelModule = { exports: {} };
vm.runInNewContext(compiled, { exports: modelModule.exports, module: modelModule, Math, Uint8ClampedArray });
const model = modelModule.exports;
const reference = fs.readFileSync(path.join(root, 'docs/references/home-starfield-v100/starfield_v100.js'), 'utf8');

function runReference(width, height) {
  const nodes = [], starDraws = [];
  const host = { clientWidth: width, clientHeight: height, insertBefore() {} };
  function createElement() {
    const node = { style: {}, parentElement: host, parentNode: host, classList: { remove() {}, add() {} } };
    const context = {
      globalAlpha: 1,
      createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
      putImageData(image) { node.pixels = image.data; },
      createRadialGradient() { return { addColorStop() {} }; },
      fillRect() {}, clearRect() {}, setTransform() {},
      drawImage(sprite, x, y, w, h) {
        if (node.id === 'frStars') starDraws.push({ x, y, w, h, alpha: this.globalAlpha, color: sprite.ctx.fillStyle });
      },
    };
    node.ctx = context; node.getContext = () => context; nodes.push(node); return node;
  }
  const nebula = createElement(); nebula.id = 'nebBand';
  const window = { devicePixelRatio: 2.625, matchMedia: () => ({ matches: false }), addEventListener() {} };
  vm.runInNewContext(reference, {
    window, document: { getElementById: () => nebula, createElement, head: { appendChild() {} }, addEventListener() {} },
    Math, Float32Array, setTimeout: () => 1, clearTimeout() {},
  });
  return { nodes, starDraws };
}
for (const [width, height] of [[390, 844], [411, 890], [844, 390]]) {
  const { nodes, starDraws } = runReference(width, height);
  for (const [id, phase] of [['nebBand', 0], ['frNebB', .55]]) {
    const size = model.nebulaSize(width, height);
    const actual = new Uint8ClampedArray(size.width * size.height * 4);
    model.renderNebulaRows(width, height, phase, 0, size.height, actual);
    assert.deepEqual(actual, nodes.find(node => node.id === id).pixels, `${id} pixels differ at ${width}x${height}`);
  }
  const stars = model.makeHomeStars(width, height);
  const expected = starDraws.filter(draw => Math.abs(draw.w / 8.4 - 2.4) > 1e-10);
  assert.equal(stars.length, expected.length);
  stars.forEach((star, i) => {
    const draw = expected[i];
    assert.ok(Math.abs(star.x - (draw.x + draw.w / 2) / width) < 1e-12);
    assert.ok(Math.abs(star.y - (draw.y + draw.h / 2) / height) < 1e-12);
    assert.ok(Math.abs(star.core - draw.w / 8.4) < 1e-12);
    assert.equal(star.alpha, draw.alpha);
    assert.equal(`rgb(${star.color.join(',')})`, draw.color);
    if (star.bright) {
      assert.ok(star.y <= .62);
      assert.ok(!(star.x > .18 && star.x < .82 && star.y > .22 && star.y < .70));
    }
  });
  assert.equal(stars.filter(star => star.bright).length, 9);
  console.log(`PASS ${width}x${height}: both nebula images match byte-for-byte; ${stars.length} stars match; 9 bright stars outside exclusions`);
}
