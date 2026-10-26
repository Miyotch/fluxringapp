/** Procedural interstellar dust, drawn on a static canvas separate from animated stars. */
export const HOME_NEBULA_SHADER = `
uniform float2 resolution;
float hash(float2 p) { return fract(sin(dot(p, float2(127.1,311.7))) * 43758.5453); }
float noise(float2 p) {
  float2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+float2(1,0)),f.x),mix(hash(i+float2(0,1)),hash(i+float2(1,1)),f.x),f.y);
}
float fbm(float2 p) {
  float v=0.0, a=.5;
  for(int i=0;i<5;i++) { v+=a*noise(p); p=float2(p.x*.8-p.y*.6,p.x*.6+p.y*.8)*2.03+7.4; a*=.5; }
  return v;
}
half4 main(float2 xy) {
  float2 uv=xy/resolution;
  float2 p=float2(uv.x,uv.y*resolution.y/resolution.x);
  float2 warp=float2(fbm(p*2.7),fbm(p*2.7+19.2));
  float cloud=fbm(p*6.0+warp*3.0);
  float detail=fbm(p*19.0+warp*2.0);
  // An oblique galactic arm with uneven edges and dark dust cutting across it.
  float spine=.82-uv.y*.72+.12*sin(uv.y*7.0);
  float distance=abs(uv.x-spine+(warp.x-.5)*.32);
  float arm=exp(-distance*distance/ .052);
  float dust=smoothstep(.40,.70,fbm(p*8.0+warp*4.0+37.0));
  float wisps=pow(max(cloud-.24,0.0),1.6)*( .5+detail)*arm;
  float halo=exp(-distance*distance/.22)*.018;
  float3 col=float3(.009,.015,.026)+float3(.30,.40,.54)*halo;
  float3 gas=mix(float3(.15,.19,.25),float3(.27,.25,.23),smoothstep(.38,.68,detail));
  col+=gas*wisps*3.8*(1.0-dust*.83);
  col+=float3(.032,.060,.095)*pow(cloud,3.0)*(1.0-arm)*.7;
  // Keep the center calm for the artwork; preserve light and dust toward the margins.
  float center=exp(-pow((uv.x-.5)/.31,2.0)-pow((uv.y-.48)/.32,2.0));
  col*=1.0-center*.23;
  float vignette=1.0-.23*smoothstep(.3,.85,length(uv-.5));
  return half4(pow(col*vignette,float3(.80)),1.0);
}
`;
