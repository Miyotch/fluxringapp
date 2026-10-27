/* ===== v100 FR Starfield（ホーム背景：天の川バンド＋星）=====
   A案ベース。変更点：①星を「にじんだ光点」に作り直し（光条・ステッカー感を廃止） ②星雲の「ゆらぎ」を追加
   負荷方針：描画は起動時・画面サイズ変更時の1回だけ。動きはCSSのopacity/transformのみ（GPU合成）。毎フレームのJS描画ゼロ
   レイヤー（下から）：#nebBand（星雲A・不透明）→ #frNebB（星雲B・形違い）→ #frStars（星・静止）→ #frGlint → 魔法陣 */
(function(){
  var cv=document.getElementById('nebBand'); if(!cv) return;
  var host=cv.parentElement||document.body;
  var RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CFG={
    bandY:0.50, bandW:0.17, tiltDeg:-7,
    nebPeak:0.72,         /* A案の明るさ */
    dust:0.55,
    morph:0.55,           /* 星雲Bの形の違い（0〜1）。大きいほど揺らぎが大きく見える */
    driftPx:7,            /* 星雲の漂う幅（px） */
    periodA:26, periodB:19, periodF:17, /* ゆらぎ周期（秒）：A漂い／B漂い／A↔B溶け合い */
    nDust:2200, nMid:110, nBright:9,
    glintMin:9, glintMax:15 /* 0で瞬きなし */
  };
  var RAMP=[[0.00,[12,11,30]],[0.30,[22,24,64]],[0.55,[38,46,112]],[0.78,[62,74,168]],[1.00,[118,136,222]]];
  var SC=[[196,210,250],[196,210,250],[214,222,255],[214,222,255],[236,238,255],[255,240,222]];

  var seed=0; function R(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}
  function rnd(a,b){return a+R()*(b-a);} function gauss(){var u=R(),v=R();return Math.sqrt(-2*Math.log(u+1e-9))*Math.cos(6.283*v);}
  var PERM=new Float32Array(512);
  function hash(x,y){var h=Math.sin(x*127.1+y*311.7+PERM[0]*97.3)*43758.5453;return h-Math.floor(h);} /* 格子状の模様が出ない連続ハッシュ */
  function sm(t){return t*t*(3-2*t);}
  function vnoise(x,y){var xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=sm(xf),v=sm(yf);
    var a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
  function fbm(x,y,o){var s=0,a=0.5,n=0;for(var k=0;k<o;k++){s+=a*vnoise(x,y);n+=a;x*=2.03;y*=2.03;a*=0.5;}return s/n;}
  function ramp(t){t=Math.max(0,Math.min(1,t));for(var i=1;i<RAMP.length;i++){if(t<=RAMP[i][0]){var p=RAMP[i-1],q=RAMP[i],k=(t-p[0])/(q[0]-p[0]);
    return [p[1][0]+(q[1][0]-p[1][0])*k,p[1][1]+(q[1][1]-p[1][1])*k,p[1][2]+(q[1][2]-p[1][2])*k];}}return RAMP[RAMP.length-1][1];}
  var TA=CFG.tiltDeg*Math.PI/180, CS=Math.cos(TA), SN=Math.sin(TA);

  /* 追加レイヤー */
  function mk(id){var c=document.createElement('canvas');c.id=id;c.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';return c;}
  var nebB=mk('frNebB'), stars=mk('frStars'), gl=document.createElement('div'); gl.id='frGlint';
  cv.parentNode.insertBefore(gl,cv.nextSibling); cv.parentNode.insertBefore(stars,gl); cv.parentNode.insertBefore(nebB,stars);

  /* 星雲（ph=形の位相。Bは位相をずらして"少し違う形"にする） */
  function drawNeb(c,W,H,ph){
    var asp=W/H, gw=Math.max(80,Math.round(W/2.5)), gh=Math.max(160,Math.round(H/2.5)); /* 低解像度で計算しCSSで拡大（柔らかい星雲なので十分） */
    c.width=gw; c.height=gh; var x2=c.getContext('2d'), img=x2.createImageData(gw,gh), d=img.data;
    var ox=ph*1.7, oy=ph*0.9;
    for(var y=0;y<gh;y++){for(var x=0;x<gw;x++){
      var nx=x/gw, ny=y/gh, dist=(-(nx-0.5)*asp*SN+(ny-CFG.bandY)*CS);
      var band=Math.exp(-Math.pow(dist/CFG.bandW,2)), halo=Math.exp(-Math.pow(dist/(CFG.bandW*2.6),2))*0.35;
      var n=fbm(nx*3.2*asp+11.3+ox,ny*3.2+4.1+oy,5);
      var fil=fbm(nx*7.5*asp+2.7+ox*1.3,ny*7.5+9.2-oy,4);
      var lane=1-Math.abs(fbm(nx*4.4*asp+31.0+ox*0.6,ny*4.4+17.0+oy*0.6,4)*2-1);
      lane=Math.pow(Math.max(0,lane),6)*Math.exp(-Math.pow(dist/(CFG.bandW*0.7),2));
      var v=(band*(0.35+0.85*n)*(0.75+0.5*fil)+halo*n)*CFG.nebPeak; v*=1-CFG.dust*lane; v=Math.max(0,Math.min(1,v));
      var col=ramp(v), vg=1-0.55*Math.pow(Math.min(1,Math.hypot((nx-0.5)*1.1,(ny-0.47)*0.9)*1.55),2.2);
      var o=(y*gw+x)*4; d[o]=col[0]*vg; d[o+1]=col[1]*vg; d[o+2]=col[2]*vg; d[o+3]=255;
    }}
    x2.putImageData(img,0,0);
  }

  /* 星：硬い円ではなく、ガウスでにじんだ光点スプライトを縮小描画（安っぽさの主因＝くっきりした円・十字光条を廃止） */
  var SP=(function(){var s=document.createElement('canvas');s.width=s.height=64;var c=s.getContext('2d');
    var g=c.createRadialGradient(32,32,0,32,32,32);
    for(var i=0;i<=10;i++){var r=i/10;g.addColorStop(r,'rgba(255,255,255,'+Math.exp(-r*r*9).toFixed(4)+')');}
    c.fillStyle=g;c.fillRect(0,0,64,64);return s;})();
  var tint={};
  function sprite(rgb){var k=rgb.join(',');if(tint[k])return tint[k];var s=document.createElement('canvas');s.width=s.height=64;var c=s.getContext('2d');
    c.drawImage(SP,0,0);c.globalCompositeOperation='source-in';c.fillStyle='rgb('+k+')';c.fillRect(0,0,64,64);return tint[k]=s;}
  var BRIGHT=[];
  function drawStars(W,H){
    var DPR=Math.min(window.devicePixelRatio||1,3), asp=W/H;
    stars.width=Math.round(W*DPR); stars.height=Math.round(H*DPR);
    var c=stars.getContext('2d'); c.setTransform(DPR,0,0,DPR,0,0); c.clearRect(0,0,W,H); c.globalCompositeOperation='lighter';
    function inCardZone(x,y){return x>0.18&&x<0.82&&y>0.22&&y<0.70;}
    function pick(bandBias){ /* 帯＋濃淡ノイズで"群れ"を作る（一様ばらまき＝ノイズっぽさの原因） */
      for(var t=0;t<12;t++){var x=R(),y;
        if(R()<bandBias){y=CFG.bandY+(x-0.5)*asp*Math.tan(TA)+gauss()*CFG.bandW*0.8/CS;} else y=R();
        if(y<0||y>1) continue;
        var clump=fbm(x*6*asp+5.1,y*6+2.3,3); if(R()>Math.pow(clump,1.6)*1.9) continue;
        if(y>0.55&&R()<0.4) continue;
        return [x,y];}
      return null;}
    function star(x,y,core,a,rgb){var s=core*4.2;c.globalAlpha=Math.min(1,a);c.drawImage(sprite(rgb),x*W-s,y*H-s,s*2,s*2);}
    var i,p,k,col;
    for(i=0;i<CFG.nDust;i++){p=pick(0.8);if(!p)continue;k=p[1]>0.55?0.8:1;col=SC[Math.floor(R()*SC.length)];star(p[0],p[1],rnd(0.18,0.38)*k,rnd(0.18,0.6),col);}
    for(i=0;i<CFG.nMid;i++){p=pick(0.45);if(!p)continue;k=p[1]>0.55?0.75:1;col=SC[Math.floor(R()*SC.length)];star(p[0],p[1],rnd(0.42,0.62)*k,rnd(0.55,0.85),col);}
    BRIGHT=[];
    for(i=0;i<CFG.nBright*6&&BRIGHT.length<CFG.nBright;i++){p=pick(0.35);if(!p||inCardZone(p[0],p[1])||p[1]>0.62)continue;
      col=SC[Math.floor(R()*SC.length)];
      star(p[0],p[1],2.4,0.07,[190,204,255]);          /* ごく淡い大気のにじみ */
      star(p[0],p[1],rnd(0.75,0.95),1,col);             /* 芯 */
      BRIGHT.push(p);}
    c.globalAlpha=1; c.globalCompositeOperation='source-over';
  }

  function render(){
    var W=host.clientWidth,H=host.clientHeight; if(!W||!H) return;
    seed=20261026; for(var q=0;q<512;q++)PERM[q]=R();
    drawNeb(cv,W,H,0); drawNeb(nebB,W,H,CFG.morph);
    cv.style.width=nebB.style.width='100%'; cv.style.height=nebB.style.height='100%';
    seed=777; drawStars(W,H);
  }

  /* ゆらぎ：星雲A/Bがそれぞれ定位置で往復し、AとBがゆっくり溶け合う（＝雲の形が変わって見える）。星は静止 */
  var D=CFG.driftPx, st=document.createElement('style');
  st.textContent='#nebBand{mix-blend-mode:normal!important;z-index:0!important;image-rendering:auto}'
   +'#nebBand,#frNebB{transform:scale(1.06);will-change:transform,opacity}'
   +'@keyframes frDriftA{0%{transform:translate3d('+(-D)+'px,'+(D*0.4)+'px,0) scale(1.06)}100%{transform:translate3d('+D+'px,'+(-D*0.4)+'px,0) scale(1.06)}}'
   +'@keyframes frDriftB{0%{transform:translate3d('+(D*0.8)+'px,'+(D*0.5)+'px,0) scale(1.07)}100%{transform:translate3d('+(-D*0.8)+'px,'+(-D*0.5)+'px,0) scale(1.07)}}'
   +'@keyframes frFade{0%{opacity:0}100%{opacity:1}}'
   +'#frGlint{position:absolute;z-index:0;width:18px;height:18px;margin:-9px 0 0 -9px;pointer-events:none;opacity:0;'
   +'background:radial-gradient(circle,rgba(240,244,255,.9) 0,rgba(205,218,255,.35) 18%,rgba(190,206,255,.08) 42%,rgba(190,206,255,0) 70%)}'
   +'@keyframes frGlintA{0%{opacity:0;transform:scale(.6)}50%{opacity:.85;transform:scale(1)}100%{opacity:0;transform:scale(.7)}}'
   +'#frGlint.on{animation:frGlintA 3.6s ease-in-out 1 both}';
  document.head.appendChild(st);
  if(!RM){
    cv.style.animation='frDriftA '+CFG.periodA+'s ease-in-out infinite alternate';
    nebB.style.animation='frDriftB '+CFG.periodB+'s ease-in-out infinite alternate, frFade '+CFG.periodF+'s ease-in-out infinite alternate';
  } else nebB.style.opacity='0.5';

  var gT=null;
  function glint(){ gT=null; if(document.hidden||!BRIGHT.length) return;
    var p=BRIGHT[Math.floor(Math.random()*BRIGHT.length)];
    gl.classList.remove('on'); gl.style.left=(p[0]*100).toFixed(2)+'%'; gl.style.top=(p[1]*100).toFixed(2)+'%'; void gl.offsetWidth; gl.classList.add('on'); sched(); }
  function sched(){ if(RM||!(CFG.glintMax>0)) return; if(gT) clearTimeout(gT); gT=setTimeout(glint,(CFG.glintMin+Math.random()*(CFG.glintMax-CFG.glintMin))*1000); }
  document.addEventListener('visibilitychange',function(){ if(document.hidden){ if(gT){clearTimeout(gT);gT=null;} } else sched(); });

  var rT=null,lw=0,lh=0;
  function maybe(){var w=host.clientWidth,h=host.clientHeight;if(Math.abs(w-lw)>1||Math.abs(h-lh)>1){lw=w;lh=h;render();}}
  window.addEventListener('resize',function(){clearTimeout(rT);rT=setTimeout(maybe,200);});
  maybe(); sched();
  window.__frStarfield={cfg:CFG,rerender:render};
})();
