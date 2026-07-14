/**
 * CardGL.tsx — 実3D（WebGL）で厚みつきカードを全方向に360°回転
 * ------------------------------------------------------------------
 * react-three-fiber（/native = expo-gl バックエンド）で、薄い直方体の
 * カードを描く。表面 = 作品画像テクスチャ、裏面 = 縦ヘアラインの
 * ブラッシュドアルミ＋刻印、側面（厚み 1mm 相当）= 金属ベゼル。
 *
 * 回転（トラックボール方式）:
 *   指の移動ベクトル (ddx, ddy) から回転軸 (ddy, ddx, 0) を毎フレーム求め、
 *   クォータニオンを世界座標系で前乗算（premultiply）する。
 *   → 横なぞり=左右回転 / 縦なぞり=上下回転 / 斜め=斜め回転。
 *   指を離すとその時の速度で慣性回転し、指数減衰でなめらかに止まる。
 *
 * 2つの使い方:
 *   ・プレイヤー: 常時回転可（rotationEnabled 既定 true・flip なし）
 *   ・ホーム    : flipped/onToggleFlip を渡す。表面ではタップで裏返し（回転不可）、
 *                 裏面では全方向回転可。フリップは quaternion のスラープで演出。
 *
 * 入力: RN 標準（回転可のとき PanResponder / 表面は Pressable でタップのみ）。
 * 描画: useFrame（JSスレッド）で quaternion を mesh に反映。
 *   3D 変換は WebGL 内で完結するので、RN の perspective 合成不具合とは無関係。
 *
 * 注意: expo-gl / three はネイティブ依存。反映には EAS 再ビルドが必要。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, PanResponder, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import { withSpring, SharedValue } from 'react-native-reanimated';
import { renderCardBackPixels } from '../lib/cardBackTexture';
import type { CardBackData } from './CardBack';

// カードの見かけ比率は 2:3。ワールド単位で W×H×D（D=厚み）。
const W = 1.3;
const H = W * 1.5;
// 実カード幅を 63mm とし、厚み 1mm 想定 → 1/63 ≈ 0.016（実機調整ポイント）
const DEPTH_RATIO = 0.016;
const SENS = 0.55; // 1px ドラッグあたりの回転角（度）
const DECAY = 3.0; // 慣性の指数減衰（大きいほど早く止まる・実機調整ポイント）
const STOP_DEG_PER_SEC = 2; // これ未満の角速度で停止

// ── トラックボール回転の状態（JS スレッドで共有する ref） ──
export type SpinState = {
  q: THREE.Quaternion;   // 現在の姿勢
  vx: number;            // X軸まわり角速度（度/秒・縦なぞり由来）
  vy: number;            // Y軸まわり角速度（度/秒・横なぞり由来）
  dragging: boolean;
  target: THREE.Quaternion | null; // フリップ等のスラープ目標（null=なし）
  animating: boolean;    // フリップ演出中（この間ドラッグ無効）
};

const TMP_Q = new THREE.Quaternion();
const TMP_AXIS = new THREE.Vector3();
const TMP_FRONT = new THREE.Vector3();

// 表面（正面）と裏面（Y軸まわり180°）の姿勢
const Q_FRONT = new THREE.Quaternion();
const Q_BACK = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

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
  backData?: CardBackData;
  rotationEnabled: boolean;
  rotationOut?: SharedValue<number>;
}> = ({ spin, frontUri, backData, rotationEnabled, rotationOut }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [frontTex, setFrontTex] = useState<THREE.Texture | null>(null);
  const brushed = useMemo(makeBrushedTexture, []);

  // 裏面: ホームの CardBack と同デザインを Skia で焼き込み → DataTexture
  const backTex = useMemo(() => {
    if (!backData) return null;
    try {
      const res = renderCardBackPixels(backData, 512, 768);
      if (!res) return null;
      // three は v=0 が下端 → Skia（上端origin）の行順を反転
      const { pixels, width: tw, height: th } = res;
      const flipped = new Uint8Array(pixels.length);
      const row = tw * 4;
      for (let y = 0; y < th; y++) {
        flipped.set(pixels.subarray((th - 1 - y) * row, (th - y) * row), y * row);
      }
      const t = new THREE.DataTexture(flipped, tw, th, THREE.RGBAFormat);
      t.needsUpdate = true;
      return t;
    } catch {
      return null;
    }
  }, [backData]);

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

  // 毎フレーム: フリップ演出 → 慣性 → 姿勢を mesh へ → 表面の向きを外部へ通知
  useFrame((_, dt) => {
    const s = spin.current;
    if (s.animating && s.target) {
      // 目標姿勢へスラープ（フリップの回り込み演出）。近づいたら確定。
      const k = Math.min(1, dt * 9);
      s.q.slerp(s.target, k);
      s.vx = 0;
      s.vy = 0;
      // 従来のフリップにあった「少し浮く」感じ＝回転の中腹でわずかに拡大
      if (meshRef.current) {
        const ang = s.q.angleTo(s.target); // π→0 と減っていく
        meshRef.current.scale.setScalar(1 + 0.09 * Math.sin(Math.min(Math.PI, ang)));
      }
      if (s.q.angleTo(s.target) < 0.02) {
        s.q.copy(s.target);
        s.animating = false;
        s.target = null;
        if (meshRef.current) meshRef.current.scale.setScalar(1);
      }
    } else if (!s.dragging && rotationEnabled) {
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
      {/* 裏: アルミ縦磨き＋刻印（ホームの CardBack と同デザインの焼き込み）。
          文字の判読性を優先しライト非依存。生成失敗時は素のヘアラインへ */}
      {backTex ? (
        <meshBasicMaterial attach="material-5" map={backTex} />
      ) : (
        <meshStandardMaterial attach="material-5" map={brushed} metalness={0.72} roughness={0.4} color="#c9ced6" />
      )}
    </mesh>
  );
};

export type CardGLProps = {
  /** 表面に貼る作品画像URL */
  frontUri: string;
  /** レイアウト上の表示サイズ(px) */
  width: number;
  height: number;
  /** 裏面の刻印内容（コレクションの裏面と同デザイン） */
  backData?: CardBackData;
  /**
   * 'spin' = プレイヤー用（常時360°回転・フリップなし・既定）
   * 'flip' = ホーム用（表面=タップで裏返し／裏面=360°回転・再タップで表面へ）
   */
  mode?: 'spin' | 'flip';
  /**
   * flip モードで表面のあいだ上に重ねる従来デザインの表面
   * （ArtworkCard 等）。タップ判定もこのオーバーレイで受ける。
   */
  frontOverlay?: React.ReactNode;
  /** flip モードで表↔裏が切り替わったとき（親が横スクロール可否を切替える用） */
  onFlipChange?: (flipped: boolean) => void;
  /** 背面レイヤー追従用（任意・度 / px） */
  rotationOut?: SharedValue<number>;
  dragXOut?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
};

export const CardGL: React.FC<CardGLProps> = ({
  frontUri,
  width,
  height,
  backData,
  mode = 'spin',
  frontOverlay,
  onFlipChange,
  rotationOut,
  dragXOut,
  style,
}) => {
  const spin = useRef<SpinState>({
    q: new THREE.Quaternion(),
    vx: 0,
    vy: 0,
    dragging: false,
    target: null,
    animating: false,
  });
  const last = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  // ── フリップ状態は CardGL 内部で完結させる ──
  // 親（FlatList のセル）経由で状態を渡すと、リストのセル再レンダー最適化に
  // 阻まれて反映されないことがあるため、この中で setState → 即座に自分が
  // 再レンダー → スラープ開始、という閉じた経路にする。
  const isFlip = mode === 'flip';
  const [flipped, setFlipped] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(isFlip);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (overlayTimer.current) clearTimeout(overlayTimer.current); }, []);

  const flipToBack = () => {
    if (overlayTimer.current) { clearTimeout(overlayTimer.current); overlayTimer.current = null; }
    setOverlayVisible(false); // 従来の表面を外して GL のフリップを見せる
    setFlipped(true);
    onFlipChange?.(true);
  };
  const flipToFront = () => {
    setFlipped(false);
    onFlipChange?.(false);
    // 表向きへ戻るスラープ（約0.5秒）を見せてから従来の表面へ差し替え
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => setOverlayVisible(true), 550);
  };

  // flipped の変化でフリップ演出を仕込む（表=正面 / 裏=Y軸180°へスラープ）
  useEffect(() => {
    if (!isFlip) return;
    const s = spin.current;
    s.target = (flipped ? Q_BACK : Q_FRONT).clone();
    s.animating = true;
    s.dragging = false;
    s.vx = 0;
    s.vy = 0;
  }, [flipped, isFlip]);

  // spin モード=常時回転可 / flip モード=裏面のときだけ回転可
  const canRotate = isFlip ? flipped : true;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canRotate,
        onMoveShouldSetPanResponder: (_e, g) => canRotate && Math.abs(g.dx) + Math.abs(g.dy) > 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const s = spin.current;
          s.dragging = true;
          s.vx = 0;
          s.vy = 0;
          last.current = { x: 0, y: 0 };
          moved.current = false;
        },
        onPanResponderMove: (_e, g) => {
          if (Math.abs(g.dx) + Math.abs(g.dy) > 4) moved.current = true;
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
          if (!moved.current && isFlip) {
            // ほぼ動いていない＝タップ → 表へ戻す
            flipToFront();
          } else if (moved.current) {
            // 離した瞬間の速度（px/ms → 度/秒）で慣性回転
            s.vx = g.vy * 1000 * SENS;
            s.vy = g.vx * 1000 * SENS;
          }
          if (dragXOut) dragXOut.value = withSpring(0, { damping: 16, stiffness: 120 });
        },
        onPanResponderTerminate: () => {
          spin.current.dragging = false;
          if (dragXOut) dragXOut.value = withSpring(0, { damping: 16, stiffness: 120 });
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canRotate, dragXOut, isFlip],
  );

  // 描画キャンバスはカードの対角線サイズの正方形にし、レイアウト枠から
  // はみ出して重ねる。横長の向き（90°回転など）でもカードの長辺が
  // 収まり、端で切れない。カメラ距離を D/height 倍して見かけの
  // カードサイズは従来と同一に保つ。
  const D = Math.ceil(Math.hypot(width, height)) + 8;
  const camZ = (3.4 * D) / height;

  // ラッパは常に同じ View（要素型を変えると Canvas が再マウントされ
  //   GL 再初期化のちらつきが出るため）。
  // 回転可（プレイヤー / ホーム裏面）＝ View に PanResponder（回転＋タップ）。
  // 回転不可（ホーム表面）＝ 従来デザインのオーバーレイ（Pressable）が
  //   タップのみ受け、ドラッグは親の横スワイプ（曲切替）へ通す。
  const handlers = canRotate ? pan.panHandlers : {};

  return (
    <View style={[{ width, height }, style]} {...handlers}>
      <Canvas
        style={{
          position: 'absolute',
          left: (width - D) / 2,
          top: (height - D) / 2,
          width: D,
          height: D,
          backgroundColor: 'transparent',
        }}
        camera={{ position: [0, 0, camZ], fov: 40 }}
        gl={{ alpha: true }}
      >
        {/* 透明背景（Skia のオーラ/調律陣を透過させる） */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[2.5, 3, 4]} intensity={1.25} />
        <pointLight position={[-3, 1.5, 3]} intensity={0.8} color="#7fdcf0" />
        <CardMesh spin={spin} frontUri={frontUri} backData={backData} rotationEnabled={canRotate} rotationOut={rotationOut} />
      </Canvas>

      {/* flip モードの表面: 従来デザイン（ArtworkCard 等）をタップ受けと兼ねて重ねる */}
      {isFlip && overlayVisible && (
        <Pressable style={styles.frontOverlay} onPress={flipToBack}>
          {frontOverlay}
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  frontOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CardGL;
