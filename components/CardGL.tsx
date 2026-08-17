/**
 * CardGL.tsx — 実3D（WebGL）カード（card_parts v98 準拠 + シェーダーライティング）
 * ------------------------------------------------------------------
 * react-three-fiber（/native = expo-gl＝実 WebGL）で角丸（0.085w）の薄いカードを描く。
 *   ・表面: 作品画像＋GLSLライティング（拡散・フレネル・リム・傾きで動く光の帯）。
 *           lib/cardShaders.ts の ART_FRAGMENT_SHADER（Web版リファレンス移植）
 *   ・側面: 明色スチール（edgeLayer #D8E2F1→#9AA8BE 系）・厚み 6.5/188.6
 *   ・裏面: backStyle='aluminum' = GLSLで procedural に描く削り出しアルミ
 *           （ヘアライン異方性・疑似スカイ反射・二段スペキュラ）＋
 *           lib/cardBackTexture.ts の刻印テクスチャ（3層彫り込み陰影）を
 *           アルファ合成。lib/cardShaders.ts の ALUMINUM_FRAGMENT_SHADER
 *           backStyle='story' = 従来のフラットテクスチャ（現状呼び出し元
 *           なし・後方互換のため維持）
 *   ・オーラ: aura 指定時に card-aura（2層グロー＋落影）を Skia で重ねる
 * ジオメトリは 角丸Shape の表裏プレート＋ExtrudeGeometry の側面リング。
 *
 * 回転（トラックボール方式）:
 *   指の移動ベクトル (ddx, ddy) から回転軸 (ddy, ddx, 0) を毎フレーム求め、
 *   クォータニオンを世界座標系で前乗算。離すと慣性回転→指数減衰。
 *
 * 2つの使い方:
 *   ・プレイヤー: mode='spin'（常時回転・フリップなし・既定）
 *   ・ホーム    : mode='flip'。表面=タップで裏返し（回転不可・横ドラッグは
 *                 親の曲切替へ）、裏面=全方向回転可・再タップで表面へ。
 *                 フリップは quaternion のスラープ＋「少し浮く」スケール演出。
 *                 補間は経過時間駆動（constants/design-tokens.ts の FLIP_*）。
 *                 フレーム数に依存させると、タップ直後のヒッチ1回で 180° を
 *                 1フレームで飛び越して演出が消える（実測 dt≧111ms で発生）。
 *                 状態は内部完結（FlatList のセル再レンダーに依存しない）。
 *                 裏面の自由回転は、指を離すと重力オートリターン
 *                 （spin モードと同じ CARD_RETURN_STIFFNESS・約3秒）で
 *                 裏の定位置（Q_BACK）へ戻る。
 *
 * 入力:
 *   ・flip の表面 = 実体のあるオーバーレイ（作品画像＋Pressable）でタップ受け。
 *     GL 上の透明タップ領域は実機で反応しないことがあるため使わない（794793f で実証）。
 *   ・裏面・spin = ラッパー View の PanResponder（タップ＋全方向回転）。
 *   ・ラッパーの PanResponder は常時装着で、オーバーレイ不在時のタップも拾う保険。
 * 注意: expo-gl / three はネイティブ依存。反映には EAS 再ビルドが必要。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Image, Pressable, PanResponder, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import { withSpring, SharedValue } from 'react-native-reanimated';
import {
  renderStoryBackPixels,
  renderAluminumInkPixels,
  BackPixels,
} from '../lib/cardBackTexture';
import { CARD_VERTEX_SHADER, ART_FRAGMENT_SHADER, ALUMINUM_FRAGMENT_SHADER } from '../lib/cardShaders';
import {
  FLIP_DURATION_MS,
  FLIP_MAX_STEP_MS,
  FLIP_EASING,
  FLIP_BACK_SCALE,
  FLIP_LIFT,
  FLIP_OVERLAY_RESTORE_MS,
  FLIP_OVERLAY_RECHECK_MS,
  FLIP_OVERLAY_MAX_WAIT_MS,
} from '../constants/design-tokens';
import { CardAura } from './CardAura';
import type { CardBackData } from './CardBack';

// カードの見かけ比率は 2:3。ワールド単位で W×H×D（D=厚み）。
const W = 1.3;
const H = W * 1.5;
// 厚み: card_parts v98 の確定値 thk=6.5 / カード幅188.6 ≈ 0.0345
const DEPTH_RATIO = 6.5 / 188.6;
// 角丸: --cr = 0.085 × カード幅（v98・全レイヤー共通）
const CORNER_RATIO = 0.085;
const SENS = 0.55; // 1px ドラッグあたりの回転角（度・flip モードのトラックボール用）
const DECAY = 3.0; // 慣性の指数減衰（大きいほど早く止まる・実機調整ポイント）
const STOP_DEG_PER_SEC = 2; // これ未満の角速度で停止
const FRONT_SCALE = 1;
// 裏面倍率・浮き量・回転時間・オーバーレイ復帰時間は constants/design-tokens.ts
// （FLIP_BACK_SCALE / FLIP_LIFT / FLIP_DURATION_MS / FLIP_OVERLAY_RESTORE_MS）に集約。
// 1フレームで進める dt の上限（秒）。flip の補間と spin の物理の両方に掛ける。
const FRAME_MAX_DT = FLIP_MAX_STEP_MS / 1000;

// ── spin モード（プレイヤー）の回転物理: webgl_card_standalone.html verbatim ──
//   angX/angY(現在角)・tAngX/tAngY(目標角)・velX/velY(角速度)。
//   感度 0.008 rad/px・縦クランプ ±1.25rad・慣性 VMAX=6.0・減衰 pow(0.94,dt*60)・
//   スムージング sm=1-exp(-dt*14)・モデル行列 RotY(angY)*RotX(angX)・初期姿勢 (-0.05,0.20)。
// 感度は 0.008 だと過敏で扱いづらかったため半分へ（FPS のセンシ設定と同じ考え方）
// 横（左右スワイプ＝Y軸回転）はこちらを使う。
const CARD_DRAG_SENS = 0.004; // rad/px
// 縦（上下ドラッグ＝X軸回転）専用の感度。実機調整ポイント。
const CARD_DRAG_SENS_VERT = 0.006; // rad/px
// 縦回転クランプ。1.25rad(≈71.6°) はひっくり返って見えるため ±22° に制限する
const CARD_ANG_CLAMP = 0.384; // 22° = 22*π/180 ≒ 0.384 rad
const CARD_VMAX = 6.0;        // 横フリックの慣性・角速度上限（rad/s）
const CARD_VMAX_VERT = 2.0;   // 縦フリックの慣性・角速度上限（横より抑える）
const CARD_INIT_ANGX = -0.05; // 初期姿勢（正面やや傾き）
const CARD_INIT_ANGY = 0.20;
// 重力オートリターン: 手を離すと弱いバネで静止姿勢へ戻す。
// カード下部が重い（＝下を向きたがる）ように、慣性が収まると立った姿勢へ落ち着く。
// 残差は exp(-K*T)。95%戻るまでの時間 T ≒ ln(20)/K なので、
//   K=2.0 → 約1.5秒（指定値）／ K=1.0 → 約3秒 ／ K=0.15 → 約20秒
// 小さいほど戻りが遅い。ドラッグ中は無効。
const CARD_RETURN_STIFFNESS = 2.0;
// 復帰先の姿勢。裏面を見ているときは「裏面のまま」立った姿勢（Y+180°）へ戻す。
// 表向きの初期姿勢へ引き戻すと、裏を眺めている最中に勝手に表返ってしまう。
const CARD_BACK_ANGY = Math.PI + CARD_INIT_ANGY;
// タップ判定のしきい値（|dx|+|dy| px）。これ以下の移動はタップ扱いにして
//   ・flip（ホーム）: 表⇔裏のトグルを確実に拾う（4px では指の微動でドラッグ扱いになり
//                     タップで戻れないことがあった。12px でも再発報告があり16pxへ）
//   ・spin（プレイヤー）: 離した瞬間の慣性を与えない（軽いタップで card が
//                     大きく回り、裏返ったように見えるのを防ぐ）
const TAP_SLOP = 16;
// 素早いフリックと判定する横速度（px/ms）。これを超え、かつ横優位のときは
// 縦の回転成分を与えず「水平回転をキープ」する（斜めに転ばないようにする）。
// ゆっくりした長押しスワイプはこの条件を満たさないので従来どおり自由に回せる。
const FLICK_VX = 0.5;
// 2回目のタップをダブルタップとみなす間隔（ms）
const DOUBLE_TAP_MS = 300;

// ── トラックボール回転の状態（JS スレッドで共有する ref） ──
export type SpinState = {
  q: THREE.Quaternion;   // 現在の姿勢
  vx: number;            // X軸まわり角速度（度/秒・縦なぞり由来）
  vy: number;            // Y軸まわり角速度（度/秒・横なぞり由来）
  dragging: boolean;
  target: THREE.Quaternion | null; // フリップ等のスラープ目標（null=なし）
  from: THREE.Quaternion;  // フリップ開始時点の姿勢（毎フレーム from→target を作り直す）
  elapsed: number;         // フリップ開始からの経過時間(ms)。dt を上限クランプして積む
  animating: boolean;    // フリップ演出中（この間ドラッグ無効）
  scale: number;         // 現在の表示倍率（フリップ完了時に確定する値）
  startScale: number;    // フリップ開始時点の倍率（スラープ元）
  finalScale: number;    // フリップ完了後に確定させる倍率（表=1 / 裏=1.1）
  // spin モード（オイラー物理）専用
  angX: number; angY: number;     // 現在角（rad）
  tAngX: number; tAngY: number;   // 目標角（rad）
  velX: number; velY: number;     // 角速度（rad/s）
  /**
   * 縦ドラッグの符号。裏面を見ているあいだは -1。
   * 裏を向いていると同じ world X 回転で「見えている面」は逆向きに動くため、
   * 補正しないと指とカードの動きが上下逆になる。
   * ドラッグ開始時に確定し、そのジェスチャ中は変えない（途中で反転すると
   * 指を動かしている最中に挙動が飛ぶ）。
   */
  vSign: number;
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

const TMP_Q2 = new THREE.Quaternion();

/**
 * flip モード裏面のトラックボール回転を、Q_BACK（真裏向き）から
 * CARD_ANG_CLAMP（±22°）以上は傾かないように抑える。
 * どの方向にドラッグしても、絵柄・刻印テキストが読める角度で止まる
 * （spin モードの縦クランプと同じ 22° を、こちらは全方向に適用する）。
 */
function clampTiltFromBack(q: THREE.Quaternion) {
  const dot = Math.max(-1, Math.min(1, Math.abs(q.dot(Q_BACK))));
  const angle = 2 * Math.acos(dot);
  if (angle > CARD_ANG_CLAMP) {
    TMP_Q2.copy(q);
    q.copy(Q_BACK).slerp(TMP_Q2, CARD_ANG_CLAMP / angle);
  }
}

// 決定論ハッシュ（0..1）
function hash(x: number): number {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * 側面（edgeLayer）の縦グラデーション: #D8E2F1 0% → #BCC9DC 55% → #9AA8BE 100%
 * （v98 verbatim）。1×64 の DataTexture（行0 = v0 = カード下端）。
 */
function makeEdgeGradientTexture(): THREE.DataTexture {
  const N = 64;
  const c1 = [0xd8, 0xe2, 0xf1]; // 上端
  const c2 = [0xbc, 0xc9, 0xdc]; // 55%
  const c3 = [0x9a, 0xa8, 0xbe]; // 下端
  const data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const v = i / (N - 1);      // 0=下端(v0) → 1=上端
    const t = 1 - v;            // CSS 180deg（上→下）に合わせる
    let c: number[];
    if (t <= 0.55) {
      const k = t / 0.55;
      c = c1.map((a, j) => a + (c2[j] - a) * k);
    } else {
      const k = (t - 0.55) / 0.45;
      c = c2.map((a, j) => a + (c3[j] - a) * k);
    }
    data[i * 4] = c[0];
    data[i * 4 + 1] = c[1];
    data[i * 4 + 2] = c[2];
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 1, N, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
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

// 角丸長方形の THREE.Shape（中心原点）
function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

// ShapeGeometry の UV を 0..1 に正規化（頂点座標→カード全面マッピング）
function remapUV(geo: THREE.BufferGeometry, w: number, h: number) {
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  }
  uv.needsUpdate = true;
}

// Skia の RGBA ピクセル → three の DataTexture（行順を反転）
function pixelsToTexture(res: BackPixels): THREE.DataTexture {
  const { pixels, width: tw, height: th } = res;
  const flipped = new Uint8Array(pixels.length);
  const row = tw * 4;
  for (let y = 0; y < th; y++) {
    flipped.set(pixels.subarray((th - 1 - y) * row, (th - y) * row), y * row);
  }
  const t = new THREE.DataTexture(flipped, tw, th, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

const CardMesh: React.FC<{
  spin: React.MutableRefObject<SpinState>;
  frontUri: string;
  backData?: CardBackData;
  backStyle: 'aluminum' | 'story';
  depthRatio: number;
  rotationEnabled: boolean;
  isFlip: boolean;
  rotationOut?: SharedValue<number>;
  onFrontLoaded?: () => void;
}> = ({ spin, frontUri, backData, backStyle, depthRatio, rotationEnabled, isFlip, rotationOut, onFrontLoaded }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [frontTex, setFrontTex] = useState<THREE.Texture | null>(null);
  const [backTex, setBackTex] = useState<THREE.DataTexture | null>(null); // backStyle='story' 用
  const [inkTex, setInkTex] = useState<THREE.DataTexture | null>(null);  // backStyle='aluminum' の刻印
  const brushed = useMemo(makeBrushedTexture, []); // 'story' のテクスチャ読込待ちフォールバック

  // ── シェーダーマテリアル（Web版リファレンス移植・lib/cardShaders.ts） ──
  // 表面: ライティング＋傾きで動く光の帯（優先項目①）。spin/flip 両モード共通。
  const uLightVec = useMemo(() => new THREE.Vector3(0.45, -0.55, -0.8), []);
  const frontMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CARD_VERTEX_SHADER,
        fragmentShader: ART_FRAGMENT_SHADER,
        uniforms: { map: { value: null }, uHasMap: { value: 0 }, uLight: { value: uLightVec } },
      }),
    [uLightVec],
  );
  useEffect(() => {
    frontMaterial.uniforms.map.value = frontTex;
    frontMaterial.uniforms.uHasMap.value = frontTex ? 1 : 0;
    frontMaterial.uniformsNeedUpdate = true;
  }, [frontTex, frontMaterial]);

  // 裏面（aluminum）: procedural金属＋ヘアライン＋スカイ反射（優先項目②）
  //   ＋刻印テクスチャのアルファ合成（優先項目③）。'story' は従来どおり
  //   flatテクスチャ（meshBasicMaterial）のまま（利用箇所なし・後方互換で維持）。
  const aluminumMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CARD_VERTEX_SHADER,
        fragmentShader: ALUMINUM_FRAGMENT_SHADER,
        uniforms: { inkMap: { value: null }, uHasInk: { value: 0 }, uLight: { value: uLightVec } },
      }),
    [uLightVec],
  );
  useEffect(() => {
    aluminumMaterial.uniforms.inkMap.value = inkTex;
    aluminumMaterial.uniforms.uHasInk.value = inkTex ? 1 : 0;
    aluminumMaterial.uniformsNeedUpdate = true;
  }, [inkTex, aluminumMaterial]);

  useEffect(
    () => () => {
      frontMaterial.dispose();
      aluminumMaterial.dispose();
    },
    [frontMaterial, aluminumMaterial],
  );

  const T = W * depthRatio;

  // 角丸カードのジオメトリ（表・裏の面＋側面リング）
  const geos = useMemo(() => {
    const shape = roundedRectShape(W, H, CORNER_RATIO * W);
    const front = new THREE.ShapeGeometry(shape, 12);
    remapUV(front, W, H);
    const back = front.clone();
    back.rotateY(Math.PI); // 裏向き（フリップ後に正しく読める向き）
    const side = new THREE.ExtrudeGeometry(shape, {
      depth: T,
      bevelEnabled: false,
      curveSegments: 12,
    });
    side.translate(0, 0, -T / 2);
    // 側面の UV をカード高さ方向へ貼り直し（edgeLayer の縦グラデ用）
    {
      const pos = side.getAttribute('position');
      const uv = side.getAttribute('uv');
      for (let i = 0; i < pos.count; i++) {
        uv.setXY(i, 0.5, pos.getY(i) / H + 0.5);
      }
      uv.needsUpdate = true;
    }
    return { front, back, side };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [T]);

  // 側面: edgeLayer の縦グラデーション（#D8E2F1→55% #BCC9DC→#9AA8BE・非ライティング=CSSと同じ）
  const sideMats = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ map: makeEdgeGradientTexture() });
    return [m, m]; // [キャップ, 側面] — キャップは面プレートの背後で見えない
  }, []);

  // 裏面テクスチャ:
  //   aluminum = 刻印のみ（透明背景・金属地はシェーダー側）を同期生成
  //   story    = 従来どおりフロストのストーリー面テクスチャを非同期生成
  useEffect(() => {
    if (!backData) return;
    if (backStyle === 'aluminum') {
      try {
        const res = renderAluminumInkPixels(backData);
        if (res) setInkTex(pixelsToTexture(res));
      } catch {}
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await renderStoryBackPixels(backData, frontUri, 512, 768);
        if (res && alive) setBackTex(pixelsToTexture(res));
      } catch {}
    })();
    return () => { alive = false; };
  }, [backData, backStyle, frontUri]);

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
        if (alive) {
          setFrontTex(tex);
          onFrontLoaded?.();
        }
      } catch {
        // 読み込み失敗時はプレースホルダ色のまま
      }
    })();
    return () => { alive = false; };
  }, [frontUri]);

  // 毎フレーム: フリップ演出 → 慣性 → 姿勢を mesh へ → 表面の向きを外部へ通知
  useFrame((_, rawDt) => {
    const s = spin.current;
    // dt の上限クランプ。バックグラウンド復帰や一時的なヒッチで巨大な dt が来ると、
    // 慣性・減衰・重力復帰・フリップ補間がまとめて先へ飛び、「カードが突然回っている」
    // 「演出が一瞬で終わる」状態になる。FRAME_MAX_DT=50ms(20fps相当)で頭打ちにする。
    // 掛かるのは frame 落ち時だけなので、通常時（30〜60fps）の挙動は一切変わらない。
    const dt = Math.min(rawDt, FRAME_MAX_DT);
    // ── spin モード（プレイヤー）: webgl_card_standalone.html の render を verbatim ──
    //   慣性→クランプ→指数スムージング→モデル行列 RotY(angY)*RotX(angX)。
    if (!isFlip) {
      if (!s.dragging) {
        s.tAngY += s.velY * dt;
        s.tAngX += s.velX * dt;
        s.tAngX = Math.max(-CARD_ANG_CLAMP, Math.min(CARD_ANG_CLAMP, s.tAngX));
        const df = Math.pow(0.94, dt * 60);
        s.velX *= df;
        s.velY *= df;
        // 重力オートリターン: 目標角を静止姿勢へ弱いバネで引き戻す。
        // 慣性が乗っているあいだは慣性が勝ち、慣性が減衰するとこの項が効いて、
        // 最終的に「下が重い＝立った姿勢」へ落ち着く。ドラッグ中は無効。
        //
        // 復帰先の向きは “いま見えている面” で決める。裏を見ているなら裏のまま
        // （Y+180°）立たせる。常に表向きへ戻すと、裏を眺めている最中に勝手に
        // 表返ってしまう。
        // |angX| は ±1.25rad(<90°) クランプなので cos(angX)>0 ＝ 表裏は
        // cos(angY) の符号だけで決まる。
        const backFacing = Math.cos(s.angY) < 0;
        const baseY = backFacing ? CARD_BACK_ANGY : CARD_INIT_ANGY;
        // 何周も巻き戻さないよう、現在角に最も近い等価角（±2π の倍数）を狙う。
        const TAU = Math.PI * 2;
        const targetY = baseY + Math.round((s.tAngY - baseY) / TAU) * TAU;
        const kRet = 1 - Math.exp(-dt * CARD_RETURN_STIFFNESS);
        s.tAngX += (CARD_INIT_ANGX - s.tAngX) * kRet;
        s.tAngY += (targetY - s.tAngY) * kRet;
      }
      const sm = 1 - Math.exp(-dt * 14);
      s.angX += (s.tAngX - s.angX) * sm;
      s.angY += (s.tAngY - s.angY) * sm;
      if (groupRef.current) {
        // Euler order 'YXZ' → 回転行列 = RotY(angY)*RotX(angX)（参照 mMul と一致）
        groupRef.current.rotation.set(s.angX, s.angY, 0, 'YXZ');
        groupRef.current.scale.setScalar(1);
      }
      if (rotationOut) {
        // 表面法線と視線のなす角（度）。front.z = cos(angX)*cos(angY)
        const z = Math.max(-1, Math.min(1, Math.cos(s.angX) * Math.cos(s.angY)));
        rotationOut.value = (Math.acos(z) * 180) / Math.PI;
      }
      return;
    }
    if (s.animating && s.target) {
      // ── フリップの回り込み演出: 経過時間で進める（フレーム数に依存させない） ──
      // 旧実装は k=min(1, dt*9) を毎フレーム現在姿勢へ積む方式だった。この k は
      // dt=1/9秒(111ms)で 1 に飽和し、k=1 の slerp は目標の丸コピー＝そのフレームで
      // 180°到達＋終了判定(ang<0.02)まで同時に成立するため、ヒッチが1回あるだけで
      // 中間姿勢を1枚も描かずに裏面へ飛んでいた（＝「一瞬で切り替わる」の実体）。
      // ここでは進捗 t を経過時間から出し、開始姿勢 from → 目標 target を毎フレーム
      // 作り直す。dt は上で FRAME_MAX_DT にクランプ済みなので、フレームが飛んでも
      // 1フレームあたりの進みは 50/520 が上限＝必ず11フレーム前後は中間姿勢を通る。
      s.elapsed += dt * 1000;
      // 起点と目標がほぼ同じ場合（初回マウントの flipped=false など）は演出せず即確定。
      // 進捗を回すと「浮き」だけが出てしまうため。
      const degenerate = s.from.angleTo(s.target) < 0.02;
      const t = degenerate ? 1 : Math.min(1, s.elapsed / FLIP_DURATION_MS);
      const e = FLIP_EASING(t);
      s.q.slerpQuaternions(s.from, s.target, e);
      s.vx = 0;
      s.vy = 0;
      // 開始→完了倍率を同じ進捗で補間しつつ、中腹で「少し浮く」ぶんだけ加算
      // （表→裏: 1 → FLIP_BACK_SCALE / 裏→表: FLIP_BACK_SCALE → 1）。
      // 浮きは sin(π*e) なので回転が最も横を向く中腹でピークになる。
      const lerped = s.startScale + (s.finalScale - s.startScale) * e;
      const scaleVal = lerped + FLIP_LIFT * Math.sin(Math.PI * e);
      if (groupRef.current) groupRef.current.scale.setScalar(scaleVal);
      s.scale = scaleVal;
      // 終了判定は進捗だけで行う（旧: 残り角 ang<0.02。回転と終了が同じフレームで
      // 成立しうるため、演出が1フレームで終わる原因になっていた）
      if (t >= 1) {
        s.q.copy(s.target);
        s.animating = false;
        s.target = null;
        if (groupRef.current) groupRef.current.scale.setScalar(s.finalScale);
        s.scale = s.finalScale;
      }
    } else if (!s.dragging && rotationEnabled) {
      const speed = Math.hypot(s.vx, s.vy);
      if (speed > STOP_DEG_PER_SEC) {
        applySpin(s.q, s.vx * dt, s.vy * dt);
        clampTiltFromBack(s.q);
        const f = Math.exp(-DECAY * dt);
        s.vx *= f;
        s.vy *= f;
      } else {
        s.vx = 0;
        s.vy = 0;
      }
      // 重力オートリターン（コレクション/プレイヤーの spin モードと同じ仕様・
      // 同じ時定数）: 指を離すと弱いバネで静止姿勢へ戻す。
      // この分岐は isFlip かつ rotationEnabled（=flipped）のときだけ通るので、
      // 自由回転できるのは常に「裏面から」——表面はタップ以外で動かないため
      // ここには来ない。ただし裏面のまま自由回転している間に表向きまで
      // 回した場合、常に Q_BACK 固定で戻すと表を向いた直後にまた裏へ
      // 引き戻ってしまう（spin モードには無い挙動）。spin モードと同じく
      // 「いま見えている面」で戻り先を決め、表向きなら Q_FRONT・裏向きなら
      // Q_BACK に収束させる（表面法線の world Z 成分の符号で判定）。
      // 慣性が乗っているあいだは speed 側が優勢、慣性が減衰するとこの項が
      // 効いて最終的にどちらかの定位置へ収束する（残差 exp(-K*T)・95%収束 ≒3秒）。
      TMP_FRONT.set(0, 0, 1).applyQuaternion(s.q);
      const target = TMP_FRONT.z >= 0 ? Q_FRONT : Q_BACK;
      const kRet = 1 - Math.exp(-dt * CARD_RETURN_STIFFNESS);
      s.q.slerp(target, kRet);
    }
    if (groupRef.current) groupRef.current.quaternion.copy(s.q);
    if (rotationOut) {
      // 表面法線と視線のなす角（度）。cos(rotationOut)=表面度 になり
      // 既存の aProg / fore の導出式がそのまま使える。
      TMP_FRONT.set(0, 0, 1).applyQuaternion(s.q);
      const z = Math.max(-1, Math.min(1, TMP_FRONT.z));
      rotationOut.value = (Math.acos(z) * 180) / Math.PI;
    }
  });

  return (
    <group ref={groupRef}>
      {/* 側面リング（角丸の厚み・明色スチール） */}
      <mesh geometry={geos.side} material={sideMats} />
      {/* 表: アート面（ライティング＋傾きで動く光の帯・優先項目①） */}
      <mesh geometry={geos.front} position={[0, 0, T / 2 + 0.002]} material={frontMaterial} />
      {/* 裏: aluminum=procedural金属＋ヘアライン＋スカイ反射＋刻印合成（優先項目②③）
             story  =従来のフラットテクスチャ（現状呼び出し元なし・後方互換で維持） */}
      {backStyle === 'aluminum' ? (
        <mesh geometry={geos.back} position={[0, 0, -T / 2 - 0.002]} material={aluminumMaterial} />
      ) : (
        <mesh geometry={geos.back} position={[0, 0, -T / 2 - 0.002]}>
          {backTex ? (
            <meshBasicMaterial map={backTex} />
          ) : (
            <meshStandardMaterial map={brushed} metalness={0.72} roughness={0.4} color="#c9ced6" />
          )}
        </mesh>
      )}
    </group>
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
  /** 裏面デザイン。aluminum=アルミ刻印（既定・ホーム / プレイヤー） / story=フロストのストーリー面（v98） */
  backStyle?: 'aluminum' | 'story';
  /**
   * flip モードの裏面倍率の上書き（既定は design-tokens.ts の FLIP_BACK_SCALE）。
   * ホームとプレイヤーのように width/height（表面サイズ）が画面ごとに異なる
   * 呼び出し元同士で、裏面の**見かけ上の絶対サイズ**を揃えたいときに使う
   * （表面サイズが違えば同じ倍率でも裏面の絶対サイズは変わってしまうため）。
   */
  backScale?: number;
  /** カード周囲のオーラ（card-aura）。指定時のみ描画（プレイヤーはカードの縁を
      くっきり見せる方針のため未指定＝靄なし） */
  aura?: { a?: string; b?: string };
  /** 厚み比（対カード幅）。既定は v98 の 6.5/188.6。プレイヤーは 1mm 相当 0.016 を指定 */
  depthRatio?: number;
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
  backStyle = 'aluminum',
  backScale = FLIP_BACK_SCALE,
  aura,
  depthRatio = DEPTH_RATIO,
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
    from: new THREE.Quaternion(),
    elapsed: 0,
    animating: false,
    scale: FRONT_SCALE,
    startScale: FRONT_SCALE,
    finalScale: FRONT_SCALE,
    angX: CARD_INIT_ANGX,
    angY: CARD_INIT_ANGY,
    tAngX: CARD_INIT_ANGX,
    tAngY: CARD_INIT_ANGY,
    velX: 0,
    velY: 0,
    vSign: 1,
  });
  const last = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  // ── フリップ状態は CardGL 内部で完結させる ──
  // 親（FlatList のセル）経由で状態を渡すと、リストのセル再レンダー最適化に
  // 阻まれて反映されないことがあるため、この中で setState → 即座に自分が
  // 再レンダー → スラープ開始、という閉じた経路にする。
  const isFlip = mode === 'flip';
  const [flipped, setFlipped] = useState(false);

  // ── 表面オーバーレイ（実機でタップが確実に反応する方式・794793f で実証済み）──
  // GL キャンバス上の「透明タップ領域」は実機で反応しないことがあるため、
  // 表面のあいだは実体のあるオーバーレイ（作品画像そのもの＝v98の表面と同一の
  // 見た目）を Pressable で重ね、これをタップ受けにする。
  //   タップ → オーバーレイを外して GL のフリップ（表→裏）を見せる
  //   裏面タップ → GL が表向きへ戻るアニメーション（約0.5秒）後に復帰
  const [overlayVisible, setOverlayVisible] = useState(isFlip);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (overlayTimer.current) clearTimeout(overlayTimer.current); }, []);

  const flipToBack = () => {
    if (overlayTimer.current) { clearTimeout(overlayTimer.current); overlayTimer.current = null; }
    setOverlayVisible(false); // 実体オーバーレイを外して GL のフリップを見せる
    setFlipped(true);
    onFlipChange?.(true);
  };
  const flipToFront = () => {
    setFlipped(false);
    onFlipChange?.(false);
    // 表向きへ戻るアニメーションが「実際に終わってから」オーバーレイ復帰。
    // FLIP_OVERLAY_RESTORE_MS（= FLIP_DURATION_MS + 30ms）待ったうえで、その時点で
    // まだ回っていたら FLIP_OVERLAY_RECHECK_MS ごとに再確認する。
    //   固定 setTimeout 一発では足りない: useFrame の dt を FLIP_MAX_STEP_MS で
    //   頭打ちにしている都合上、20fps を割る／途中で 250ms 級のヒッチが1回でも入ると
    //   回転の所要が実時間で 550ms を超え、まだ横を向いているカードの上に
    //   表の作品画像が突然現れる。通常時は1回目の判定で必ず抜けるので従来と同じ。
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    const deadline = Date.now() + FLIP_OVERLAY_MAX_WAIT_MS;
    const restoreOverlay = () => {
      // 打ち切りを併用するのは、useFrame が止まる状況（Canvas 一時停止・
      // GL コンテキスト喪失）で animating が true のまま残ったときに
      // 再確認が永久に続いて表面が戻らなくなるのを防ぐため。
      if (spin.current.animating && Date.now() < deadline) {
        overlayTimer.current = setTimeout(restoreOverlay, FLIP_OVERLAY_RECHECK_MS);
        return;
      }
      overlayTimer.current = null;
      setOverlayVisible(true);
    };
    overlayTimer.current = setTimeout(restoreOverlay, FLIP_OVERLAY_RESTORE_MS);
  };

  // spin モード: 曲送り（frontUri 変化）で必ず正面（初期姿勢）から始める。
  // 参照 frShow3d の「前カードの回転姿勢・慣性を持ち越さない」を再現。
  // 一時停止→再開は同一マウント・同一 frontUri なので姿勢は維持される。
  useEffect(() => {
    if (isFlip) return;
    const s = spin.current;
    s.angX = CARD_INIT_ANGX;
    s.angY = CARD_INIT_ANGY;
    s.tAngX = CARD_INIT_ANGX;
    s.tAngY = CARD_INIT_ANGY;
    s.velX = 0;
    s.velY = 0;
    s.dragging = false;
  }, [frontUri, isFlip]);

  // flip モード: 再生画面の曲送り／戻しは CardGL を再マウントせず frontUri だけ
  // 差し替えるため、前の曲を裏返したまま次の曲へ進むと、新しい曲の裏面が
  // アニメーションなしでいきなり出てしまう。曲が変わったときに裏面だったら
  // 表へ戻す（初回マウントでは何もしない）。
  const prevFrontUriRef = useRef(frontUri);
  useEffect(() => {
    if (!isFlip) return;
    if (prevFrontUriRef.current === frontUri) return;
    prevFrontUriRef.current = frontUri;
    if (flipped) flipToFront();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frontUri, isFlip]);

  // flipped の変化でフリップ演出を仕込む（表=正面 / 裏=Y軸180°へスラープ）。
  // 倍率も表(1.0)⇔裏(FLIP_BACK_SCALE=1.1)の間で進捗に合わせて補間する。
  useEffect(() => {
    if (!isFlip) return;
    const s = spin.current;
    s.target = (flipped ? Q_BACK : Q_FRONT).clone();
    // 起点は「いま」の姿勢。裏面で自由回転してから表に戻す場合も、その姿勢から
    // 目標へ一本の補間になる（毎フレーム from→target を作り直すので必須）。
    s.from.copy(s.q);
    s.elapsed = 0;
    s.animating = true;
    s.dragging = false;
    s.vx = 0;
    s.vy = 0;
    s.startScale = s.scale ?? FRONT_SCALE;
    s.finalScale = flipped ? backScale : FRONT_SCALE;
  }, [flipped, isFlip, backScale]);

  // spin モード=常時回転可 / flip モード=裏面のときだけ回転可
  const canRotate = isFlip ? flipped : true;

  // タップ（フリップ）と回転を1つの PanResponder で受ける。
  // 以前は表面のタップを「GL キャンバスに重ねた透明 Pressable」で受けていたが、
  // 実機で R3F Canvas 側のタッチ処理と競合してタップが落ちる事象があったため、
  // 再生画面で実績のあるラッパー View への直接装着方式に統一した。
  //   表面: 開始のみ主張（タップ検出）。移動は主張しない＝横スワイプは
  //         FlatList（曲切替）が奪える（terminationRequest も許可）。
  //   裏面: 移動も主張して全方向回転。スクロールへは明け渡さない。
  // 直前のタップ時刻（ダブルタップ判定用）
  const lastTapAt = useRef(0);

  /**
   * カードを定位置へ戻す（ダブルタップ）。回転してどこを向いていても、
   * flip モードは表向きへ、spin モードは初期姿勢へ収束させる。
   */
  const recenterCard = useCallback(() => {
    const s = spin.current;
    s.vx = 0;
    s.vy = 0;
    s.velX = 0;
    s.velY = 0;
    if (isFlip) {
      // flipped=false にすると下の effect が s.target=Q_FRONT を張って戻り始める
      flipToFront();
    } else {
      s.tAngX = CARD_INIT_ANGX;
      s.tAngY = CARD_INIT_ANGY;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlip]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => canRotate && Math.abs(g.dx) + Math.abs(g.dy) > 2,
        onPanResponderTerminationRequest: () => !canRotate,
        onPanResponderGrant: () => {
          const s = spin.current;
          s.dragging = canRotate;
          s.vx = 0;
          s.vy = 0;
          // 縦ドラッグの符号をこのジェスチャの分だけ確定させる。
          // |angX| は ±1.25rad(<90°) にクランプされているので cos(angX)>0。
          // つまり表裏は cos(angY) の符号だけで決まる。
          s.vSign = Math.cos(s.angY) < 0 ? -1 : 1;
          last.current = { x: 0, y: 0 };
          moved.current = false;
        },
        onPanResponderMove: (_e, g) => {
          if (Math.abs(g.dx) + Math.abs(g.dy) > TAP_SLOP) moved.current = true;
          if (!canRotate) return; // 表面: ドラッグは親の曲切替に任せる
          const ddx = g.dx - last.current.x;
          const ddy = g.dy - last.current.y;
          last.current = { x: g.dx, y: g.dy };
          // TAP_SLOP を超えて「ドラッグ」と確定するまでは回転を適用しない
          // （デッドゾーン）。裏面はここが常時回転可なので、以前はタップの
          // つもりの指の微動でも毎フレーム回っており、それ自体が「タップした
          // 感覚と実際の見た目が合わない」原因になっていた。last.current は
          // 上で毎回更新しているので、しきい値を超えた瞬間の ddx/ddy は
          // 直前フレームからの増分のみ＝回転が飛ばない。
          if (!moved.current) return;
          const s = spin.current;
          if (isFlip) {
            // flip モード（裏面）: 従来のトラックボール（横=Y軸 / 縦=X軸 / 斜め=合成軸）。
            // Q_BACK から±22°以上は傾かないようクランプし、絵柄・テキストが
            // 読めなくなるほど回してしまわないようにする。
            applySpin(s.q, ddy * SENS, ddx * SENS);
            clampTiltFromBack(s.q);
          } else {
            // spin モード（プレイヤー）: 参照 move の verbatim
            //   tAngY+=dx*0.008 / tAngX+=dy*0.008（縦のみ±1.25rad クランプ）
            s.tAngY += ddx * CARD_DRAG_SENS;
            // 縦は vSign を掛ける。裏向きでは同じ world X 回転で見えている面が
            // 逆に動くため、掛けないと指と上下が逆になる。
            s.tAngX += ddy * CARD_DRAG_SENS_VERT * s.vSign;
            s.tAngX = Math.max(-CARD_ANG_CLAMP, Math.min(CARD_ANG_CLAMP, s.tAngX));
          }
          if (dragXOut) dragXOut.value = g.dx;
        },
        onPanResponderRelease: (_e, g) => {
          const s = spin.current;
          s.dragging = false;
          if (!moved.current) {
            // ほぼ動いていない＝タップ。
            //   ダブルタップ: どの向きからでも定位置へ戻す
            //   シングルタップ: 従来どおり flip モードだけ表⇔裏をトグル
            const now = Date.now();
            const isDouble = now - lastTapAt.current < DOUBLE_TAP_MS;
            lastTapAt.current = isDouble ? 0 : now; // 3回目以降が連鎖しないよう畳む
            if (isDouble) {
              recenterCard();
            } else if (isFlip) {
              if (flipped) flipToFront();
              else flipToBack();
            }
          } else if (moved.current && canRotate) {
            // 素早い横フリックは水平回転だけを残す（縦成分を与えない）。
            // 長押しスワイプ相当のゆっくりした操作は従来の自由回転のまま。
            const isFlick = Math.abs(g.vx) >= FLICK_VX && Math.abs(g.vx) > Math.abs(g.vy);
            if (isFlip) {
              // 離した瞬間の速度（px/ms → 度/秒）で慣性回転（トラックボール）
              s.vx = isFlick ? 0 : g.vy * 1000 * SENS;
              s.vy = g.vx * 1000 * SENS;
            } else {
              // spin モード: 参照 up の verbatim（px/ms → rad/s・VMAX クランプ）
              //   velY=dx速度*sens / velX=dy速度*sens
              s.velY = Math.max(-CARD_VMAX, Math.min(CARD_VMAX, g.vx * 1000 * CARD_DRAG_SENS));
              // 慣性の縦成分もドラッグと同じ符号にする（離した瞬間に逆へ跳ねないように）。
              // 縦フリックは横より弱く抑える（CARD_VMAX_VERT）。
              s.velX = isFlick
                ? 0
                : Math.max(
                    -CARD_VMAX_VERT,
                    Math.min(CARD_VMAX_VERT, g.vy * 1000 * CARD_DRAG_SENS_VERT * s.vSign),
                  );
              // フリック中は縦の目標角も直立へ寄せて、斜めに転んだまま回らないようにする
              if (isFlick) s.tAngX = CARD_INIT_ANGX;
            }
          }
          if (dragXOut) dragXOut.value = withSpring(0, { damping: 16, stiffness: 120 });
        },
        onPanResponderTerminate: () => {
          spin.current.dragging = false;
          if (dragXOut) dragXOut.value = withSpring(0, { damping: 16, stiffness: 120 });
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canRotate, dragXOut, isFlip, flipped, recenterCard],
  );

  // 描画キャンバスはカードの対角線サイズの正方形にし、レイアウト枠から
  // はみ出して重ねる。横長の向き（90°回転など）でもカードの長辺が
  // 収まり、端で切れない。カメラ距離を D/height 倍して見かけの
  // カードサイズは従来と同一に保つ。
  //
  // 対角線には**最大表示倍率**を掛ける。flip は裏面で FLIP_BACK_SCALE まで
  // 拡大し、回転の中腹ではさらに FLIP_LIFT ぶん浮くため、倍率1のままの
  // キャンバスだと拡大後のカードが収まらず四隅が切れる
  // （裏面1.75倍の対角は枠189×284pt に対して 471pt。倍率1基準の D=350 では
  //   確実に欠ける）。camZ が D に比例するので、D を増やしても倍率1での
  // 見かけのサイズ（px/world = height/2.475）は変わらず、余白だけが増える。
  const maxScale = isFlip ? backScale + FLIP_LIFT : 1;
  const D = Math.ceil(Math.hypot(width, height) * maxScale) + 8;
  const camZ = (3.4 * D) / height;

  // ラッパは常に同じ View（要素型を変えると Canvas が再マウントされ
  //   GL 再初期化のちらつきが出るため）。PanResponder は表裏とも常時装着
  //   （表面はタップのみ拾い、ドラッグは親の横スワイプへ明け渡す）。
  const handlers = pan.panHandlers;

  // GL テクスチャ生成完了までのつなぎ表示（表面の作品画像を RN Image で即時に出す）
  const [frontReady, setFrontReady] = useState(false);

  return (
    <View style={[{ width, height }, style]} {...handlers}>
      {/* card-aura（box-shadow 2層＋落影）。指定時のみ */}
      {aura && <CardAura width={width} height={height} auraA={aura.a} auraB={aura.b} />}

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
        <CardMesh
          spin={spin}
          frontUri={frontUri}
          backData={backData}
          backStyle={backStyle}
          depthRatio={depthRatio}
          rotationEnabled={canRotate}
          isFlip={isFlip}
          rotationOut={rotationOut}
          onFrontLoaded={() => setFrontReady(true)}
        />
      </Canvas>

      {/* flip モードの表面: 実体のあるオーバーレイ（v98 表面と同一の作品画像）が
          タップ受けを兼ねる。透明ビューや GL レイヤーのタップ判定に依存しない
          ＝実機で確実に反応する（794793f で実証済みの方式）。
          RN Image は即時表示されるため、GL テクスチャ生成待ちの無地も隠れる */}
      {isFlip && overlayVisible && (
        <Pressable style={StyleSheet.absoluteFill} onPress={flipToBack}>
          <Image
            source={{ uri: frontUri }}
            style={{ width, height, borderRadius: CORNER_RATIO * width }}
            resizeMode="cover"
          />
        </Pressable>
      )}

      {/* spin モード（プレイヤー）: GL テクスチャの読込・アップロード完了までは
          RN Image を重ねて作品画像を即時表示（GL 側はプレースホルダ色のため） */}
      {!isFlip && !frontReady && (
        <Image
          source={{ uri: frontUri }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width,
            height,
            borderRadius: CORNER_RATIO * width,
          }}
          resizeMode="cover"
        />
      )}
    </View>
  );
};

export default CardGL;
