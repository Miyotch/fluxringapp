/**
 * CardGL.tsx — 実3D（WebGL）で厚みつきカードを360°回転
 * ------------------------------------------------------------------
 * react-three-fiber（/native = expo-gl バックエンド）で、薄い直方体の
 * カードを描く。表面 = 作品画像テクスチャ、裏面 = 縦ヘアラインの
 * ブラッシュドアルミ、側面（厚み 2〜3mm 相当）= 金属ベゼル。
 * 指ドラッグで Y 軸回転。指を離すと Reanimated の withDecay で
 * 慣性が効き、なめらかに回り続けて減速する。
 *
 * 入力: RN 標準 PanResponder（どのビルドでも確実に発火）。
 *   ドラッグ量 → Reanimated shared value(rot 度) に反映。
 * 描画: useFrame（JSスレッド）で shared value を読み、mesh.rotation.y へ。
 *   3D 変換は WebGL 内で完結するので、以前 iPad で起きた RN の
 *   perspective 合成不具合とは無関係。
 *
 * 注意: これらは追加ネイティブ依存（expo-gl / three）を含むため、
 *   反映には EAS 再ビルドが必要（Metro リロードでは不可）。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, StyleProp, ViewStyle } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import {
  useSharedValue,
  useDerivedValue,
  withDecay,
  cancelAnimation,
  SharedValue,
} from 'react-native-reanimated';

// カードの見かけ比率は 2:3。ワールド単位で W×H×D（D=厚み）。
const W = 1.3;
const H = W * 1.5;
const DEPTH_RATIO = 0.045; // 幅に対する厚み（2〜3mm 相当・実機調整ポイント）
const SENS = 0.6; // 1px ドラッグあたりの回転角（度）

// 決定論ハッシュ（0..1）
function hash(x: number): number {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** 縦ヘアラインのブラッシュドアルミ質感（DataTexture・列ごとに輝度を変える） */
function makeBrushedTexture(): THREE.DataTexture {
  const w = 96;
  const h = 8;
  const data = new Uint8Array(w * h * 4);
  for (let x = 0; x < w; x++) {
    const col = 150 + Math.floor(hash(x * 1.7) * 80); // 列の基本輝度
    for (let y = 0; y < h; y++) {
      const n = Math.max(60, Math.min(235, col + Math.floor((hash(x * 7.1 + y) - 0.5) * 26)));
      const i = (y * w + x) * 4;
      data[i] = n;          // R
      data[i + 1] = n + 2;  // G（わずかに寒色）
      data[i + 2] = n + 8;  // B
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

const CardMesh: React.FC<{ rot: SharedValue<number>; frontUri: string }> = ({ rot, frontUri }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [frontTex, setFrontTex] = useState<THREE.Texture | null>(null);
  const brushed = useMemo(makeBrushedTexture, []);

  // 作品画像テクスチャの読み込み（remote → ローカルへ落としてから）
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const asset = Asset.fromURI(frontUri);
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        const tex = await new TextureLoader().loadAsync(uri);
        tex.colorSpace = THREE.SRGBColorSpace;
        if (alive) setFrontTex(tex);
      } catch {
        // 読み込み失敗時はプレースホルダ色のまま
      }
    })();
    return () => { alive = false; };
  }, [frontUri]);

  // shared value(度) → ラジアンへ。JS スレッドの useFrame で読む。
  useFrame(() => {
    if (meshRef.current) meshRef.current.rotation.y = (rot.value * Math.PI) / 180;
  });

  const D = W * DEPTH_RATIO;

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[W, H, D]} />
      {/* material index: 0:+X 1:-X 2:+Y 3:-Y 4:+Z(表) 5:-Z(裏) */}
      {/* 側面（厚み）: 金属ベゼル（上白→シアン寄り） */}
      <meshStandardMaterial attach="material-0" color="#8FB6C6" metalness={0.9} roughness={0.28} />
      <meshStandardMaterial attach="material-1" color="#8FB6C6" metalness={0.9} roughness={0.28} />
      <meshStandardMaterial attach="material-2" color="#CDE3EC" metalness={0.9} roughness={0.22} />
      <meshStandardMaterial attach="material-3" color="#5E7C8A" metalness={0.9} roughness={0.32} />
      {/* 表: 作品画像（ライト非依存で鮮明に） */}
      <meshBasicMaterial attach="material-4" map={frontTex ?? undefined} color={frontTex ? '#ffffff' : '#222338'} />
      {/* 裏: ブラッシュドアルミ（縦ヘアライン・金属） */}
      <meshStandardMaterial attach="material-5" map={brushed} metalness={0.72} roughness={0.4} color="#c9ced6" />
    </mesh>
  );
};

export type CardGLProps = {
  /** 表面に貼る作品画像URL */
  frontUri: string;
  /** レイアウト上の表示サイズ(px) */
  width: number;
  height: number;
  /** 背面レイヤー追従用（任意・度 / px） */
  rotationOut?: SharedValue<number>;
  dragXOut?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
};

export const CardGL: React.FC<CardGLProps> = ({
  frontUri,
  width,
  height,
  rotationOut,
  dragXOut,
  style,
}) => {
  const rot = useSharedValue(0); // 回転角（度・連続）
  const base = useRef(0);

  // rotationOut/dragXOut へ橋渡し
  useDerivedValue(() => {
    if (rotationOut) rotationOut.value = rot.value;
  }, [rot]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2,
        onPanResponderGrant: () => {
          cancelAnimation(rot);
          base.current = rot.value;
        },
        onPanResponderMove: (_e, g) => {
          rot.value = base.current + g.dx * SENS;
          if (dragXOut) dragXOut.value = g.dx;
        },
        onPanResponderRelease: (_e, g) => {
          // 慣性で回り続けて減速（度/秒）。vx は px/ms。
          rot.value = withDecay({ velocity: g.vx * 1000 * SENS, deceleration: 0.997 });
          if (dragXOut) dragXOut.value = withDecay({ velocity: 0, deceleration: 0.9 });
        },
      }),
    [rot, dragXOut],
  );

  return (
    <View style={[{ width, height }, style]} {...pan.panHandlers}>
      <Canvas
        style={styles.canvas}
        camera={{ position: [0, 0, 3.4], fov: 40 }}
        gl={{ alpha: true }}
      >
        {/* 透明背景（Skia のオーラ/調律陣を透過させる） */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[2.5, 3, 4]} intensity={1.25} />
        <pointLight position={[-3, 1.5, 3]} intensity={0.8} color="#7fdcf0" />
        <CardMesh rot={rot} frontUri={frontUri} />
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: 'transparent' },
});

export default CardGL;
