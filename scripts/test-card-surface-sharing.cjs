const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict'),Module=require('module'),cp=require('child_process');
const base=path.resolve('node_modules/@shopify/react-native-skia/lib/commonjs'),React=require('react');
const originalLoad=Module._load;
Module._load=function(id,parent,isMain){if(id==='react-native')return {Platform:{OS:'web'},PixelRatio:{get:()=>1},View:'View'};if(id.includes('react-native-reanimated'))return {};if(id.endsWith('/Platform')||id==='../Platform')return {Platform:{OS:'web',PixelRatio:1}};return originalLoad.apply(this,arguments);};
(async()=>{
 global.CanvasKit=await require('canvaskit-wasm')({locateFile:f=>path.resolve('node_modules/canvaskit-wasm/bin',f)});
 global.SkiaApi=require(path.join(base,'skia/web')).JsiSkApi(global.CanvasKit);
 const skia={...require(path.join(base,'skia')),...require(path.join(base,'renderer/components')),...require(path.join(base,'skia/types')),...require(path.join(base,'renderer/Offscreen')),Canvas:({children})=>React.createElement(React.Fragment,null,children)};
 const cache={};function load(file,source){if(!source&&cache[file])return cache[file];const e={};if(!source)cache[file]=e;
 const m=new Module(file);m.exports=e;m.require=id=>id==='react'?React:id==='react-native'?{Platform:{OS:'web',select:o=>o.default}}:id==='@shopify/react-native-skia'?skia:id==='./skiaFonts'?{japaneseFont:()=>null}:load(path.normalize(path.join(path.dirname(file),id+'.tsx')));
 m._compile(ts.transpileModule(source??fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,file);return m.exports;}
 const shared=load('lib/cardSurfaceImage.tsx').sharedCardSurfaceImage;
 const artwork=load('components/CardSurface.tsx').CardSurfaceArtwork;
 const previous=load('old.tsx',fs.readFileSync('scripts/fixtures/CardSurface.before.txt','utf8')).CardSurface;
 let worst=0;
 for(const density of [1,2.625,3])for(const homeFinish of [false,true]){
 const width=227,height=354,props={width,height,homeFinish},w=Math.ceil(width*density),h=Math.ceil(height*density);
 // Strip only the native Canvas host from the previous implementation; keep its entire Skia scene.
 const oldPicture=await skia.drawAsPicture(React.createElement(skia.Group,{transform:[{scale:density}]},React.createElement(previous,props)));
 const surface=skia.Skia.Surface.Make(w,h);surface.getCanvas().clear(skia.Skia.Color('transparent'));surface.getCanvas().drawPicture(oldPicture);surface.flush();const oldImage=surface.makeImageSnapshot();
 const request=shared(`${density}:${homeFinish}`,width,height,density,React.createElement(artwork,props));assert.equal(request,shared(`${density}:${homeFinish}`,width,height,density,React.createElement(artwork,props)));
 const uri=await request,data=skia.Skia.Data.fromBase64(uri.split(',')[1]),newImage=skia.Skia.Image.MakeImageFromEncoded(data);
 const info={width:w,height:h,colorType:skia.ColorType.RGBA_8888,alphaType:skia.AlphaType.Unpremul};const a=oldImage.readPixels(0,0,info),b=newImage.readPixels(0,0,info);assert.equal(a.length,b.length);
 let diff=0;for(let i=0;i<a.length;i++)diff+=Math.abs(a[i]-b[i]);worst=Math.max(worst,diff/a.length);assert.ok(diff/a.length<.1,'Raster differs from the original canvas');
 oldImage.dispose();oldPicture.dispose();surface.dispose();newImage.dispose();data.dispose();
 }
 // Actual generation recovery: a failed allocation must not poison the shared cache.
 const originalMake=skia.Skia.Surface.Make.bind(skia.Skia.Surface);skia.Skia.Surface.Make=()=>null;
 await assert.rejects(shared('failure',10,20,1,React.createElement(artwork,{width:10,height:20})));
 skia.Skia.Surface.Make=originalMake;assert.ok((await shared('failure',10,20,1,React.createElement(artwork,{width:10,height:20}))).startsWith('data:image/png'));
 const fontData=skia.Skia.Data.fromBytes(new Uint8Array(fs.readFileSync('node_modules/@expo-google-fonts/eb-garamond/400Regular/EBGaramond_400Regular.ttf')));
 const face=skia.Skia.Typeface.MakeFreeTypeFaceFromData(fontData);skia.matchFont=opts=>skia.Skia.Font(face,opts.fontSize);
 const back=load('lib/cardBackTexture.ts'),oldBack=load('back-old.ts',fs.readFileSync('scripts/fixtures/cardBackTexture.before.txt','utf8'));
 const names=['renderCardBackPixels','renderAluminumInkPixels','renderStoryBackPixels'];
 const data={title:'FluxRing',story:'A calm night.',artist:'Artist',serial:'No. 001'};
 for(const name of names){
   const args=name==='renderStoryBackPixels'?[data,undefined,512,768]:[data,512,768];
   const legacyResources=[];skia.Skia.Surface.Make=(...args)=>{const s=originalMake(...args),snap=s.makeImageSnapshot.bind(s);legacyResources.push(s);s.makeImageSnapshot=(...a)=>{const im=snap(...a);legacyResources.push(im);return im;};return s;};
   const before=await oldBack[name](...args);legacyResources.reverse().forEach(x=>x.dispose());
   for(const mode of ['success','null-read','throw-read','throw-draw']){
     let freedSurface=0,freedImage=0;
     skia.Skia.Surface.Make=(...a)=>{const s=originalMake(...a),dispose=s.dispose.bind(s),snapshot=s.makeImageSnapshot.bind(s);s.dispose=()=>{freedSurface++;dispose();};if(mode==='throw-draw')s.getCanvas=()=>{throw Error('draw failure');};
       s.makeImageSnapshot=(...a)=>{const im=snapshot(...a),dispose=im.dispose.bind(im);im.dispose=()=>{freedImage++;dispose();};if(mode==='null-read')im.readPixels=()=>null;if(mode==='throw-read')im.readPixels=()=>{throw Error('read failure');};return im;};return s;};
     if(mode.startsWith('throw'))await assert.rejects(async()=>back[name](...args));
     else {const result=await back[name](...args);if(mode==='null-read')assert.equal(result,null);else assert.deepEqual(result.pixels,before.pixels,'Pixels survive immediate resource disposal unchanged');}
     assert.equal(freedSurface,1);assert.equal(freedImage,mode==='throw-draw'?0:1);
   }
 }
 skia.Skia.Surface.Make=originalMake;face.dispose();fontData.dispose();
 console.log('PASS: all three back renderers preserve pixels and release surfaces/snapshots on success, null read and exceptions');
 console.log(`PASS: six old/new render comparisons; mean channel difference <= ${worst.toFixed(5)}/255; shared generation and allocation recovery`);
})().catch(e=>{console.error(e);process.exitCode=1;});
