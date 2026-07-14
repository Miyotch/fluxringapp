/**
 * NebulaGL.tsx — 再生画面の星雲背景（player_nebula_standalone v98 準拠）
 * ------------------------------------------------------------------
 * 遠くの青い天の川。WebGL のフラグメントシェーダーで、形がその場で morph
 * する（移動ゼロ・乱数なし・時間駆動）。参照 HTML の GLSL を verbatim 移植。
 *   ・simplex noise(snoise) + fbm による雲
 *   ・-58°方向の帯（band）でにじみを絞る
 *   ・hash21 ベースの瞬く星
 * react-three-fiber の全画面クアッド（clip空間直描き）に ShaderMaterial。
 *
 * 注意: expo-gl / three はネイティブ依存。反映には EAS 再ビルドが必要。
 */

import React, { useMemo, useRef } from 'react';
import { StyleProp, ViewStyle, StyleSheet } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// 参照 FS を GLSL ES にそのまま移植（uv=vUv・iRes=解像度・iTime=経過秒）
const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float iTime;
uniform vec2 iRes;
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
float fbm(vec3 p){float s=0.0,a=0.5;for(int i=0;i<4;i++){s+=a*snoise(p);p=p*2.02;a*=0.5;}return s;}
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){
  vec2 uv=vUv;
  vec2 asp=vec2(iRes.x/iRes.y,1.0);
  vec2 p=uv-0.5;
  float ang=-58.0*3.14159/180.0;vec2 dir=vec2(cos(ang),sin(ang));vec2 nr=vec2(-dir.y,dir.x);
  float perp=abs(dot(p*asp,nr));float along=dot(p*asp,dir);
  float band=exp(-pow(perp/0.20,2.0))*exp(-pow(along/0.60,2.0));
  float z=iTime*0.11;
  float n=fbm(vec3(uv*2.4*asp,z));
  n=clamp((n*0.5+0.5-0.38)*2.0,0.0,1.0);
  float cloud=band*n;
  vec3 col=vec3(0.20,0.41,0.82)*cloud*0.60;
  vec2 sg=uv*asp*150.0;vec2 sid=floor(sg);vec2 sf=fract(sg)-0.5;
  float shv=hash21(sid);float dens=0.93-0.06*band;
  if(shv>dens){float bb=hash21(sid+7.7);float tw=0.4+0.6*(0.5+0.5*sin(iTime*(0.8+bb*2.0)+shv*40.0));
    float d=length(sf);float pt=smoothstep(0.09,0.0,d)*bb*tw*(0.55+0.7*band);
    col+=vec3(0.78,0.86,1.0)*pt*0.65;}
  gl_FragColor=vec4(col+vec3(0.020,0.024,0.050),1.0);
}`;

const NebulaQuad: React.FC = () => {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { size, viewport } = useThree();
  const uniforms = useMemo(
    () => ({
      iTime: { value: 0 },
      iRes: { value: new THREE.Vector2(1, 1) },
    }),
    [],
  );

  useFrame((_, dt) => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.iTime.value += dt;
    // アスペクト比のため解像度を反映（DPR 込みのドローバッファサイズ）
    const dpr = viewport.dpr || 1;
    m.uniforms.iRes.value.set(size.width * dpr, size.height * dpr);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

export const NebulaGL: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => (
  <Canvas
    style={StyleSheet.flatten([StyleSheet.absoluteFill, style])}
    gl={{ alpha: false, antialias: false }}
    orthographic
    camera={{ position: [0, 0, 1] }}
    pointerEvents="none"
  >
    <NebulaQuad />
  </Canvas>
);

export default NebulaGL;
