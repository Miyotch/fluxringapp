const fs = require('fs');
const ts = require('typescript');
const vm = require('vm');
const assert = require('assert/strict');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/homePinkNoise.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject });
const { NEBULA_MORPH, NEBULA_LIGHT, CLOUD_SIGNALS, PINK_SECONDS: n } = exportsObject;
for (const values of [NEBULA_MORPH, NEBULA_LIGHT, ...CLOUD_SIGNALS.flatMap(s => [s.density, s.horizontal, s.vertical])]) {
  assert.equal(values.length,n+1);
  assert.equal(values[0],values[n]);
  assert.ok(values.every(v => Number.isFinite(v) && Math.abs(v)<=1));
  const powers=[];
  for(let k=8;k<=128;k++) {
    let re=0,im=0;
    for(let t=0;t<n;t++) { re+=values[t]*Math.cos(2*Math.PI*k*t/n); im+=values[t]*Math.sin(2*Math.PI*k*t/n); }
    powers.push(k*(re*re+im*im));
  }
  assert.ok(Math.max(...powers)/Math.min(...powers)<1.000001, 'Power times frequency must be constant');
  for(const strength of [.6,1,1.4]) assert.ok(values.every(v=>.5+v*.34*strength>=0 && .5+v*.34*strength<=1));
}
console.log('PASS: band-limited 1/f spectrum, finite samples, seamless loop, opacity bounds');


const modelExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/homeAmbientModel.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: modelExports });
const { CLOUD_VOLUMES, cloudAlpha, quietHomeStars } = modelExports;
for (const volume of CLOUD_VOLUMES) {
  for(let p=0;p<=1;p+=.05) {
    assert.equal(cloudAlpha(0,p,100,volume),0);
    assert.equal(cloudAlpha(1,p,100,volume),0);
    assert.equal(cloudAlpha(p,0,100,volume),0);
    assert.equal(cloudAlpha(p,1,100,volume),0);
  }
  for(let y=0;y<=1;y+=.025) for(let x=0;x<=1;x+=.025) {
    const alpha=cloudAlpha(x,y,100,volume);
    assert.ok(alpha>=0 && alpha<=255);
  }
}
for (const signal of CLOUD_SIGNALS) for (const depth of [.6,1,1.4]) {
  assert.ok(signal.density.every(v => .50 + v*.28*depth >= 0 && .50 + v*.28*depth <= 1));
}
// Local variation must not degenerate into one global brightness pulse.
const correlation = (a,b) => {
  let aa=0,bb=0,ab=0;
  for(let i=0;i<n;i++) { aa+=a[i]*a[i]; bb+=b[i]*b[i]; ab+=a[i]*b[i]; }
  return ab/Math.sqrt(aa*bb);
};
for(let a=0;a<3;a++) for(let b=a+1;b<3;b++) assert.ok(Math.abs(correlation(CLOUD_SIGNALS[a].density,CLOUD_SIGNALS[b].density))<.4);
const starExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/homeStarfieldModel.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: starExports });
for (const [w,h] of [[390,844],[411,890],[844,390]]) {
  const original=starExports.makeHomeStars(w,h), quiet=quietHomeStars(original);
  assert.ok(quiet.length/original.length>.50 && quiet.length/original.length<.68);
  if (w < h) {
    // Original portrait region counts, before either requested star addition.
    const upperRight=quiet.filter(s=>s.x>.6&&s.y<.35).length;
    const lower=quiet.filter(s=>s.y>.65).length;
    assert.ok(Math.abs(upperRight/163-1.20)<.01, 'Upper right is ~20% above the original sky');
    assert.ok(Math.abs(lower/256-1.25)<.01, 'Lower sky is ~25% above the original sky');
  }
  assert.equal(quiet.filter(s=>s.bright).length,6);
  const far=quiet.filter(s=>s.core<.42), near=quiet.filter(s=>s.core>=.42);
  assert.equal(far.length+near.length,quiet.length);
  assert.ok(far.length>near.length*8, 'Distant fine points dominate');
  console.log(`PASS ${w}x${h}: ${quiet.length} stars (${far.length} far, ${near.length} near; 6 bright)`);
}
const grid=Array.from({length:20000}, (_,i)=>({x:(i%100)/100,y:Math.floor(i/100)/200,core:.3,alpha:.4,color:[200,210,250],bright:false}));
const quiet=quietHomeStars(grid);
const retention=(ys,ye)=>quiet.filter(s=>s.y>=ys&&s.y<ye).length/grid.filter(s=>s.y>=ys&&s.y<ye).length;
assert.ok(retention(.18,.23)<retention(.4,.6)*.8, 'Title area has fewer stars');
for(const s of CLOUD_SIGNALS) assert.ok(s.vertical.every(v => .68+v*.08*1.4>0 && .68+v*.08*1.4<1));
console.log('PASS: independent cloud signals, transparent edges, opacity bounds, layered star density, quiet titles');
