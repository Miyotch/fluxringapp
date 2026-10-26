const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict');
const modules={};
function load(name){
  if(modules[name])return modules[name];
  const out={};modules[name]=out;
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,
    {exports:out,require:p=>load(p.replace('./',''))});
  return out;
}
const {nebulaMotion,pinkAt,HOME_NEBULA_SPACE_SHADER}=load('homeNebulaSpace');
const {NEBULA_LIGHT}=load('homePinkNoise');
for(const strength of [.6,1,1.4]) for(let layer=0;layer<3;layer++) for(let t=0;t<=1024;t+=.5){
  const m=nebulaMotion(t,strength,layer);
  assert.ok(m.flow.every(Number.isFinite)&&m.density>0&&m.density<1);
  const next=nebulaMotion(t+.01,strength,layer);
  assert.ok(Math.abs(next.density-m.density)<.01,'No sudden density changes');
}
for(let i=0;i<=1024;i++)assert.equal(pinkAt(NEBULA_LIGHT,i),NEBULA_LIGHT[i]);
for(let l=0;l<3;l++)assert.deepEqual(nebulaMotion(0,1,l),nebulaMotion(1024,1,l));
(async()=>{
  const CK=await require('canvaskit-wasm')({locateFile:file=>path.join(path.dirname(require.resolve('canvaskit-wasm')),file)});
  let errors='';const effect=CK.RuntimeEffect.Make(HOME_NEBULA_SPACE_SHADER,error=>errors+=error);
  assert.ok(effect,errors);
  const w=160,h=320,info={width:w,height:h,colorType:CK.ColorType.RGBA_8888,alphaType:CK.AlphaType.Unpremul,colorSpace:CK.ColorSpace.SRGB};
  const bytes=new Uint8Array(w*h*4);
  const {renderWatercolorRows}=load('homeWatercolorTexture');
  const actualTexture=new Uint8ClampedArray(bytes.buffer);
  renderWatercolorRows(w,h,1,0,h,actualTexture);
  const visibleArea=[];
  for(let y=Math.round(h*.3);y<h*.7;y++)for(let x=Math.round(w*.82);x<w*.96;x++)visibleArea.push(bytes[(y*w+x)*4+3]);
  assert.ok(visibleArea.reduce((a,b)=>a+b,0)/visibleArea.length>65, 'Pigment must occupy visible side space');
  const image=CK.MakeImage(info,bytes,w*4), child=image.makeShaderOptions(CK.TileMode.Decal,CK.TileMode.Decal,CK.FilterMode.Linear,CK.MipmapMode.None);
  const surface=CK.MakeSurface(w,h),canvas=surface.getCanvas(),paint=new CK.Paint();
  function render(t,{back=CK.TRANSPARENT,densityOverride}={}){
    const m=nebulaMotion(t,1,1),shader=effect.makeShaderWithChildren([w,h,...m.flow,densityOverride??m.density,m.depth,m.strength],[child]);
    canvas.clear(back);paint.setShader(shader);canvas.drawRect(CK.XYWHRect(0,0,w,h),paint);surface.flush();
    const snapshot=surface.makeImageSnapshot(),pixels=snapshot.readPixels(0,0,info);
    snapshot.delete();shader.delete();return pixels;
  }
  const a=render(0),b=render(10),c=render(30),end=render(1023.99);
  function alphaDistance(a,b,normalize=false){
    const sumA=a.reduce((s,v,i)=>s+(i%4===3?v:0),0),sumB=b.reduce((s,v,i)=>s+(i%4===3?v:0),0);
    let delta=0;for(let i=3;i<a.length;i+=4)delta+=Math.abs(a[i]-(normalize?b[i]*sumA/sumB:b[i]));
    return delta/(w*h);
  }
  assert.ok(alphaDistance(a,end)<.1,'The shader must remain continuous across its carrier/1f loop');
  assert.ok(alphaDistance(a,b,true)>.25,'Shape must change in 10 seconds, beyond global opacity');
  assert.ok(alphaDistance(a,c,true)>.5,'Shape must evolve beyond global opacity');
  // Actual compositing: the same white distant star must lose contrast as cloud thickens.
  const weakCloud=render(0,{densityOverride:.25}),strongCloud=render(0,{densityOverride:.80});
  const white=CK.Color(255,255,255,1),weakStar=render(0,{densityOverride:.25,back:white}),strongStar=render(0,{densityOverride:.80,back:white});
  let maxIndex=3;for(let i=7;i<strongCloud.length;i+=4)if(strongCloud[i]>strongCloud[maxIndex])maxIndex=i;
  const p=maxIndex-3;
  assert.ok(strongCloud[maxIndex]>weakCloud[maxIndex]);
  assert.ok(strongStar[p]-strongCloud[p]<weakStar[p]-weakCloud[p], 'Thicker cloud must obscure the star behind it');
  for(const pixels of [a,b,c])for(let x=0;x<w;x++)assert.equal(pixels[x*4+3],0,'No rectangle at the top edge');
  console.log(`PASS: SkSL compiled; shape change at 10s ${alphaDistance(a,b,true).toFixed(3)}, at 30s ${alphaDistance(a,c,true).toFixed(3)} alpha levels/pixel; star occlusion verified`);
  paint.delete();surface.delete();child.delete();image.delete();effect.delete();
})().catch(e=>{console.error(e);process.exitCode=1});
