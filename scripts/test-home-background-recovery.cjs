const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict');
const compile=name=>ts.transpileModule(fs.readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
(async()=>{
  const timers=new Map();let id=0;
  const api={};vm.runInNewContext(compile('homeBackgroundLoader'),{exports:api,
    setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)});
  const fire=async()=>{const [id,t]=timers.entries().next().value;timers.delete(id);t.fn();await flush();return t.delay;};
  let calls=0,results=[],errors=[];
  const loader=api.createHomeBackgroundLoader({load:async()=>{if(++calls<3)throw Error('allocation');return 'sky';},onReady:v=>results.push(v),onError:e=>errors.push(e)});
  loader.setActive(true);await flush();assert.equal(calls,1);
  assert.equal(await fire(),1000);assert.equal(calls,2);
  loader.setActive(false);assert.equal(timers.size,0);
  loader.setActive(true);await flush();assert.deepEqual(results,['sky']);
  loader.setActive(false);loader.setActive(true);assert.equal(calls,3);loader.cancel();
  let permanentCalls=0;
  const permanent=api.createHomeBackgroundLoader({load:async()=>{permanentCalls++;throw Error('persistent');},onReady:()=>assert.fail(),onError:()=>{}});
  permanent.setActive(true);await flush();for(const delay of [1000,3000,10000])assert.equal(await fire(),delay);
  assert.equal(permanentCalls,4);assert.equal(timers.size,0);
  permanent.setActive(false);permanent.setActive(true);await flush();assert.equal(permanentCalls,5);
  permanent.cancel();assert.equal(timers.size,0);
  let resolvePending,late=0,pendingCalls=0;
  const pending=api.createHomeBackgroundLoader({load:()=>{pendingCalls++;return new Promise(r=>resolvePending=r);},onReady:()=>late++,onError:()=>{}});
  pending.setActive(true);pending.setActive(false);pending.setActive(true);assert.equal(pendingCalls,1);
  pending.cancel();resolvePending('obsolete-size');await flush();assert.equal(late,0);

  // Inject allocation failure into the actual image builder; no published image may be disposed.
  let allocations=0,failAt=2,surfaces=0;const images=[];
  const image=()=>{const im={disposed:false,dispose(){assert.ok(!this.disposed);this.disposed=true;},encodeToBase64:()=> 'png'};images.push(im);return im;};
  const noop=()=>{};
  const native={AlphaType:{Unpremul:1},BlendMode:{Plus:1},ColorType:{RGBA_8888:1},ImageFormat:{PNG:1},rect:noop,Skia:{
    Data:{fromBytes:()=>({dispose:noop})},Image:{MakeImage:()=>++allocations===failAt?null:image()},
    Paint:()=>({setBlendMode:noop,setAlphaf:noop,dispose:noop}),Color:noop,
    Surface:{Make:()=>{surfaces++;return {getCanvas:()=>({clear:noop,drawImageRect:noop}),flush:noop,makeImageSnapshot:image,dispose:noop};}},
  }};
  const modules={};function load(name){if(modules[name])return modules[name];const e={};modules[name]=e;
    vm.runInNewContext(compile(name),{exports:e,require:p=>p.startsWith('@')?native:load(p.slice(2)),setTimeout:fn=>{queueMicrotask(fn);return 1;}});return e;}
  const builder=load('homeStarfieldImages');
  await assert.rejects(builder.homeStarfieldImages(80,160,1));
  assert.ok(images[0].disposed,'Unpublished partial cloud released');
  failAt=-1;const first=builder.homeStarfieldImages(80,160,1);
  assert.equal(first,builder.homeStarfieldImages(80,160,1),'Concurrent requests share generation');
  const sky=await first;assert.equal(sky.clouds.length,3);assert.equal(surfaces,1,'Only far-star raster allocated');
  assert.ok(!('starsNear' in sky));assert.ok(sky.clouds.every(im=>!im.disposed));
  builder.clearHomeStarfieldCache();assert.ok(sky.clouds.every(im=>!im.disposed),'Cache clear must not free mounted images');
  const rebuilt=await builder.homeStarfieldImages(80,160,1);assert.notEqual(sky,rebuilt);
  console.log('PASS: transient recovery, bounded retries, foreground restart, cancellation, no duplicate requests, partial image cleanup, shared clouds, no unused star raster');
})().catch(e=>{console.error(e);process.exitCode=1;});
