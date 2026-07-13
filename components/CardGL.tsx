/**
 * CardGL.tsx — 実3D（WebGL）で厚みつきカードを全方向に360°回転
 * ------------------------------------------------------------------
 * react-three-fiber（/native = expo-gl バックエンド）で、薄い直方体の
 * カードを描く。表面 = 作品画像テクスチャ、裏面 = 縦ヘアラインの
 * ブラッシュドアルミ、側面（厚み 2〜3mm 相当）= 金属ベゼル。
 *
 * 回転（トラックボール方式）:
 *   指の移動ベクトル (ddx, ddy) から回転軸 (ddy, ddx, 0) を毎フレーム求め、
 *   クォータニオンを世界座標系で前乗算（premultiply）する。
 *   → 横なぞり=左右回転 / 縦なぞり=上下回転 / 斜め=斜め回転、と
 *     指の向きどおりに全方向へ 360° 回せる（Web の OrbitControls と同じ感覚）。
 *   指を離すとその時の速度で慣性回転し、指数減衰でなめらかに止まる。
 *
 * 入力: RN 標準 PanResponder（どのビルドでも確実に発火）。
 * 描画: useFrame（JSスレッド）で quaternion を mesh に反映。
 *   3D 変換は WebGL 内で完結するので、RN の perspective 合成不具合とは無関係。
 *
 * 注意: expo-gl / three はネイティブ依存。反映には EAS 再ビルドが必要。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, StyleProp, ViewStyle } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import { withSpring, SharedValue } from 'react-native-reanimated';

// カードの見かけ比率は 2:3。ワールド単位で W×H×D（D=厚み）。
const W = 1.3;
const H = W * 1.5;
const DEPTH_RATIO = 0.045; // 幅に対する厚み（2〜3mm 相当・実機調整ポイント）
const SENS = 0.55; // 1px ドラッグあたりの回転角（度）
const DECAY = 3.0; // 慣性の指数減衰（大きいほど早く止まる・実機調整ポイント）
const STOP_DEG_PER_SEC = 2; // これ未満の角速度で停止

// ── トラックボール回転の状態（JS スレッドで共有する ref） ──
export type SpinState = {
  q: THREE.Quaternion;   // 現在の姿勢
  vx: number;            // X軸まわり角速度（度/秒・縦なぞり由来）
  vy: number;            // Y軸まわり角速度（度/秒・横なぞり由来）
  dragging: boolean;
};

const TMP_Q = new THREE.Quaternion();
const TMP_AXIS = new THREE.Vector3();
const TMP_FRONT = new THREE.Vector3();

/** 世界座標系で (degX, degY) ぶん回転を加える（軸 = 指の移動と直交） */
function applySpin(q: THREE.Quaternion, degX: number, degY: number) {
  const mag = Math.hypot(degX, degY);
  if (mag < 1e-4) return;
  TMP_AXIS.set(degX / mag, degY / mag, 0);
  TMP_Q.setFromAxisAngle(TMP_AXIS, (mag * Math.PI) / 180);
  q.premultiply(TMP_Q);
}

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

const CardMesh: React.FC<{
  spin: React.MutableRefObject<SpinState>;
  frontUri: string;
  rotationOut?: SharedValue<number>;
}> = ({ spin, frontUri, rotationOut }) => {
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

  // 毎フレーム: 慣性を進める → 姿勢を mesh へ → 表面の向きを外部へ通知
  useFrame((_, dt) => {
    const s = spin.current;
    if (!s.dragging) {
      const speed = Math.hypot(s.vx, s.vy);
      if (speed > STOP_DEG_PER_SEC) {
        applySpin(s.q, s.vx * dt, s.vy * dt);
        const f = Math.exp(-DECAY * dt);
        s.vx *= f;
        s.vy *= f;
      } else {
        s.vx = 0;
        s.vy = 0;
      }
    }
    if (meshRef.current) meshRef.current.quaternion.copy(s.q);
    if (rotationOut) {
      // 表面法線と視線のなす角（度）。cos(rotationOut)=表面度 になり
      // 既存の aProg / fore の導出式がそのまま使える。
      TMP_FRONT.set(0, 0, 1).applyQuaternion(s.q);
      const z = Math.max(-1, Math.min(1, TMP_FRONT.z));
      rotationOut.value = (Math.acos(z) * 180) / Math.PI;
    }
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
  const spin = useRef<SpinState>({
    q: new THREE.Quaternion(),
    vx: 0,
    vy: 0,
    dragging: false,
  });
  const last = useRef({ x: 0, y: 0 });

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // 縦・横・斜め、どの方向の動きでも掴む
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const s = spin.current;
          s.dragging = true;
          s.vx = 0;
          s.vy = 0;
          last.current = { x: 0, y: 0 };
        },
        onPanResponderMove: (_e, g) => {
          const ddx = g.dx - last.current.x;
          const ddy = g.dy - last.current.y;
          last.current = { x: g.dx, y: g.dy };
          // 指の移動ベクトルどおりに回す（横=Y軸 / 縦=X軸 / 斜め=合成軸）
          applySpin(spin.current.q, ddy * SENS, ddx * SENS);
          if (dragXOut) dragXOut.value = g.dx;
        },
        onPanResponderRelease: (_e, g) => {
          const s = spin.current;
          s.dragging = false;
          // 離した瞬間の速度（px/ms → 度/秒）で慣性回転
          s.vx = g.vy * 1000 * SENS;
          s.vy = g.vx * 1000 * SENS;
          if (dragXOut) dragXOut.value = withSpring(0, { damping: 16, stiffness: 120 });
        },
        onPanResponderTerminate: () => {
          spin.current.dragging = false;
          if (dragXOut) dragXOut.value = withSpring(0, { damping: 16, stiffness: 120 });
        },
      }),
    [dragXOut],
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
        <CardMesh spin={spin} frontUri={frontUri} rotationOut={rotationOut} />
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: 'transparent' },
});

export default CardGL;
