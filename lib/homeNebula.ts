/** Clear deep space: smooth ambient light and individual distant stars, without dusty wisps. */
export const HOME_NEBULA_SHADER = `
uniform float2 resolution;
float hash(float2 p) { return fract(sin(dot(p, float2(127.1,311.7))) * 43758.5453); }
half4 main(float2 xy) {
  float2 uv=xy/resolution;
  float2 p=float2(uv.x,uv.y*resolution.y/resolution.x);
  float glow=exp(-pow((uv.x-.90)/.65,2.0)-pow((uv.y-.22)/.42,2.0));
  float distant=exp(-pow((uv.x-.08)/.70,2.0)-pow((uv.y-.82)/.36,2.0));
  float3 col=float3(.010,.017,.029)+float3(.010,.023,.041)*glow+float3(.009,.014,.026)*distant;
  // Tiny, isolated points imply distant star clusters; no cloudy or fingerprint-like texture.
  float2 cell=floor(p*155.0), local=fract(p*155.0);
  float2 center=float2(.2+.6*hash(cell+13.0),.2+.6*hash(cell+71.0));
  float arm=exp(-pow((uv.x-(.85-uv.y*.65))/.26,2.0));
  float present=step(.992-arm*.025,hash(cell));
  float point=1.0-smoothstep(.035,.14,length(local-center));
  col+=float3(.28,.32,.38)*present*point*(.25+.55*hash(cell+41.0));
  return half4(col,1.0);
}
`;
