/**
 * CardGL.tsx — 実3D（WebGL）カード（v99-tsubasa 準拠 + シェーダーライティング）
 * ------------------------------------------------------------------
 * react-three-fiber（/native = expo-gl＝実 WebGL）で角丸（0.085w）の薄いカードを描く。
 *   ・表面: 作品画像＋GLSLライティング（拡散・フレネル・リム・傾きで動く光の帯）
 *           ＋ v99-tsubasa の重厚化オーバーレイ（面内減光・金の内枠ヘアライン・
 *           下端の内側シャドウ）。lib/cardShaders.ts の ART_FRAGMENT_SHADER。
 *           静止時は同じ絵を Skia（components/CardSurface.tsx）で重ねている
 *           ——フリップ中は GL 面が見えるので両方に同じ作図が要る
 *   ・側面: 暗色の削り出し金属（edgeLayer #7C889E→#1B2030）・厚み 8.5/188.6
 *   ・裏面: backStyle='aluminum' = GLSLで procedural に描く削り出しアルミ
 *           （ヘアライン異方性・疑似スカイ反射・二段スペキュラ）＋
 *           lib/cardBackTexture.ts の刻印テクスチャ（3層彫り込み陰影）を
 *           アルファ合成。lib/cardShaders.ts の ALUMINUM_FRAGMENT_SHADER
 *           backStyle='story' = 従来のフラットテクスチャ（現状呼び出し元
 *           なし・後方互換のため維持）
 *   ・落影: shadow 指定時に card-aura（v99-tsubasa: 黒3層）を Skia で重ねる
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
 *                 状態は内部完結（FlatList のセル再レンダーに依存しない）。
 *
 * 入力:
 *   ・flip の表面 = 実体のあるオーバーレイ（作品画像＋Pressable）でタップ受け。
 *     GL 上の透明タップ領域は実機で反応しないことがあるため使わない（794793f で実証）。
 *   ・裏面・spin = ラッパー View の PanResponder（タップ＋全方向回転）。
 *   ・ラッパーの PanResponder は常時装着で、オーバーレイ不在時のタップも拾う保険。
 * 注意: expo-gl / three はネイティブ依存。反映には EAS 再ビルドが必要。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Image, Pressable, PanResponder, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import { TextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import Animated, {
  withSpring,
  withTiming,
  useSharedValue,
  useAnimatedStyle,
  SharedValue,
} from 'react-native-reanimated';
import {
  renderStoryBackPixels,
  renderAluminumInkPixels,
  BackPixels,
  CardBackData,
} from '../lib/cardBackTexture';
import { CARD_VERTEX_SHADER, ART_FRAGMENT_SHADER, ALUMINUM_FRAGMENT_SHADER } from '../lib/cardShaders';
import { CardAura } from './CardAura';
import { CardSurface } from './CardSurface';
import { PurchaseGlow } from './PurchaseGlow';

/**
 * カードの縦横比（高さ ÷ 幅）。参照は 1.5（2:3）だが、実機で「もう少し縦長に」
 * との判断で気持ち伸ばしている。レイアウト（DiscoverScreen の cardH）と
 * GL メッシュの両方がこの 1 つの値を見るので、ここを変えれば全部が揃う。
 */
export const CARD_ASPECT = 1.56;

// ワールド単位で W×H×D（D=厚み）。
const W = 1.3;
const H = W * CARD_ASPECT;
// 厚み: v99-tsubasa の確定値 P.thk=8.5 / カード幅188.6 ≈ 0.0451
// （v98 の 6.5 から増量。暗色の側面と合わせて「重い板」の見えを作る）
// 参照 _dv3d のメッシュ実寸（1614/1736行: W=1.0 に対し T=0.02835）。
// 旧値 8.5/188.6(=4.5%) は参照の 1.6 倍厚く、回転中にエッジオンへ近づくと
// 側面が分厚いスラブに見えていた（Pixel 6 実機で指摘）。DOM 版の thk=6.5px
// (3.4%) よりもさらに薄いが、3D ビューの見本はメッシュ側なのでそちらへ合わせる。
const DEPTH_RATIO = 0.02835;
// 角丸: --cr = 0.085 × カード幅（v98・全レイヤー共通）
const CORNER_RATIO = 0.085;
const SENS = 0.55; // 1px ドラッグあたりの回転角（度）
const DECAY = 3.0; // 慣性の指数減衰（大きいほど早く止まる・実機調整ポイント）
const STOP_DEG_PER_SEC = 2; // これ未満の角速度で停止
const FRONT_SCALE = 1;
// 裏面（フリップ後＝3D）の表示倍率の上限。参照 v99 `window.__dvScale` = 1.28。
export const CARD_BACK_SCALE_MAX = 1.28;
// 参照の枠内クランプ（_dv3d.layout 1843行）:
//   S = min(1.28, (枠幅*0.86)/カード幅, (枠高*0.82)/カード高)
// 一時期 0.88（縮小）へ変更していたが、参照どおり拡大へ戻す。参照はこの
// クランプで枠からのはみ出しを防いでいるので、クランプごと移植する。
export function computeBackScale(
  frame: { width: number; height: number } | undefined,
  cardW: number,
  cardH: number,
): number {
  if (!frame || frame.width <= 0 || frame.height <= 0) return CARD_BACK_SCALE_MAX;
  return Math.min(
    CARD_BACK_SCALE_MAX,
    (frame.width * 0.86) / cardW,
    (frame.height * 0.82) / cardH,
  );
}
// フリップ後の持ち上げ量。参照は枠高の 3%（Hc*0.03）を上へ（_dv3d.layout 1844行）。
// キャンバスはカード基準なので「カード高に対する比」へ換算して保持する。
// frame 未指定時は参照のデバイス枠 760px / カード高 283px から 0.03*760/283 = 0.0806。
const BACK_LIFT_RATIO_FALLBACK = 0.0806;
function computeBackLiftRatio(
  frame: { width: number; height: number } | undefined,
  cardH: number,
): number {
  if (!frame || frame.height <= 0 || cardH <= 0) return BACK_LIFT_RATIO_FALLBACK;
  return (frame.height * 0.03) / cardH;
}
// 遠近の強さ。参照 v99 は FOV=28°（1831-1834行）。40° では回転中の歪みが強く出る。
const FOV = 28;
// フリップのスラープ係数。参照は 1-exp(-dt*10)（τ=0.1秒・約300msで95%）。
const FLIP_K = 10;
// 落影が消えきる回転角（度）。これ以上傾いたらカードの影は出さない。
const AURA_HIDE_DEG = 10;
// 1フレームで進める時間の上限（秒）。参照 startLoop(): min(max(dt,0),0.05)。
// これが無いと、テクスチャ生成などで JS が数百 ms 止まった直後の 1 フレームで
// 角速度 6rad/s × dt がそのまま積まれ、一気に 100° 以上回る（＝「回転しすぎる」）。
const DT_MAX = 0.05;
// 2D（表面オーバーレイ）復帰時のクロスフェード（ms）。GL 面との差をならす。
const OVERLAY_FADE_MS = 140;

// ── 購入トランジション「シアンの呼吸」（DESIGN.md PURCHASE） ──
// box-shadow: 0 0 66px 16px rgba(120,232,255,.78)
//             0 0 124px 34px rgba(96,206,224,.5)
//             inset 0 0 0 1px rgba(120,232,255,.5)
// 立ち上がり約0.6秒 → 約700ms で戻す
export const PURCHASE_RISE_MS = 600;
export const PURCHASE_FALL_MS = 700;

// ── flip モードの角度駆動パラメータ（参照 _dv3d 1849-1892行の値そのまま） ──
// 参照値は 0.012 rad/px・慣性 ±6rad/s・減衰 0.94 だが、実機で「アルミの板に
// しては軽すぎる」との判断で全体に感度を落としている。指の移動に対する
// 回り方を鈍くし、慣性も早めに減衰させると「質量のある板を回している」
// 手応えになる。
const FLIP_DRAG_SENS = 0.006; // rad/px（参照 0.012 → 0.008 → さらに減感）
const FLIP_PITCH_MAX = 0.22;  // ピッチ上限（±12.6°。参照 v101 の ±22° から縮小）
const FLIP_VEL_MAX = 3;       // ヨーのフリック角速度上限（rad/s）
const FLIP_VEL_DECAY = 0.92;  // 慣性減衰（参照 0.94 より早く止まる＝重い）
// ── ピッチ（縦なぞり）だけ弱める。参照 v101 ──
// 旧値は ±1.25 rad（±71.6°）まで倒れてカードがエッジオンになり、絵柄も
// 裏面テキストも読めない姿勢で止まっていた。上限・感度・慣性を抑え、指を
// 離したらゆっくり正面へ戻す。ヨー（横スピン＝裏返し）は従来どおり無制限。
// 裏面は文字を読ませる面なので、縦の傾きはヨーよりさらに不利にする。
// 斜めに払ったときに「足を向けた」ように傾いて文字が正面を向かなくなるのを
// 防ぐため、感度・上限・慣性を下げ、復帰を速める。
const FLIP_PITCH_SENS = 0.0018;  // rad/px（ヨーの 0.006 に対し約 1/3）
const FLIP_PITCH_VEL_MAX = 0.6;  // ピッチのフリック角速度上限（rad/s）
const FLIP_PITCH_RECENTER = 3.5; // 正面への復帰レート（exp(-dt*3.5)・参照 2.0 より速い）
// 閉じアニメの強制終了（参照 close(): now-closeT0>1500）
const CLOSE_TIMEOUT_S = 1.5;
// フリック速度のサンプル窓(ms)。参照 move(): while(tn-samples[0].t>120) shift()
// PanResponder の g.vx/g.vy は直近1イベントの瞬時値でばらつくため使わない
const VEL_WINDOW_MS = 120;
// ── トラックボール回転の状態（JS スレッドで共有する ref） ──
export type SpinState = {
  q: THREE.Quaternion;   // 現在の姿勢
  vx: number;            // X軸まわり角速度（度/秒・縦なぞり由来）
  vy: number;            // Y軸まわり角速度（度/秒・横なぞり由来）
  dragging: boolean;
  target: THREE.Quaternion | null; // フリップ等のスラープ目標（null=なし）
  animating: boolean;    // フリップ演出中（この間ドラッグ無効）
  scale: number;         // 現在の表示倍率（フリップ完了時に確定する値）
  startScale: number;    // フリップ開始時点の倍率（スラープ元）
  finalScale: number;    // フリップ完了後に確定させる倍率（表=1 / 裏=1.28）
  lift: number;          // 現在の持ち上げ量（world 単位・上が正）
  startLift: number;     // フリップ開始時点の持ち上げ量
  finalLift: number;     // フリップ完了後に確定させる持ち上げ量（表=0 / 裏=上へ）

  // ── flip モード専用（参照 _dv3d と同じヨー/ピッチの2角度駆動） ──
  // クォータニオンの slerp は正面→真後ろ(180°)の回転軸が不定で、開くたびに
  // 違う回り込み方をして不安定に見える。参照は angY/angX の2角度を明示的に
  // 動かすので毎回同じ回り方になる。flip モードでは q をこの2角度から合成する。
  fy: number;       // ヨー angY（ラジアン・0=表 / π=裏）
  fx: number;       // ピッチ angX（ラジアン・±0.38 clamp）
  tfy: number;      // ヨー目標
  tfx: number;      // ピッチ目標
  fvy: number;      // ヨー角速度（rad/s・フリック慣性）
  fvx: number;      // ピッチ角速度
  qq: number;       // 開閉進捗 q（0=表 / 1=裏。拡大・持ち上げの補間に使う）
  tqq: number;      // 進捗目標

  // ── 参照 _dv3d の mode（1849-1894行）──
  // bool 1つでは「閉じアニメ中」を表現できず、その間のタップが再オープンに
  // 化けていた。参照は tapDist<10 && mode==='open' でしか反応しないので、
  // closing 中のタップは完全に無視される。3状態にして同じ挙動へ揃える。
  mode: FlipMode;
  /** closing に入ってからの経過秒。参照 close() の 1500ms 強制終了用 */
  closeElapsed: number;
};

/** 'idle'=表で静止 / 'open'=裏（回転可） / 'closing'=表へ戻り中（入力を受けない） */
export type FlipMode = 'idle' | 'open' | 'closing';

/**
 * 高分解能の現在時刻(ms)。Date.now() は分解能 1ms しかなく、120ms 窓の両端が
 * 同じミリ秒に入ると dt=0.001 に落ちて速度が 1000 倍に見え、clamp 上限へ
 * 張り付く（＝軽く弾いただけで回りすぎる）。参照は performance.now()。
 */
const nowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const TMP_Q = new THREE.Quaternion();
const TMP_AXIS = new THREE.Vector3();
const TMP_FRONT = new THREE.Vector3();
// 参照の回転行列 mRotY(angY)·mRotX(angX) と同じ合成順（Y が外側 = 'YXZ'）
const TMP_EULER = new THREE.Euler(0, 0, 0, 'YXZ');

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

/**
 * 側面（edgeLayer）の縦グラデーション（v99-tsubasa・参照 37-39行）:
 *   #7C889E 0% → #4A5266 34% → #2C3244 62% → #1B2030 100%
 *   + inset 0  1px 0 rgba(255,255,255,.55)  ← 上辺の白ヘアライン反射
 *   + inset 0 -1px 0 rgba(0,0,0,.35)        ← 下辺の陰り
 *
 * v98 の明色スチール（#D8E2F1→#9AA8BE）から暗色へ反転させている。
 * 明るい側面は「光る板」に見えてしまい、暗くすると「透けない重い素材＝
 * 削り出し金属」になる。角から明色が覗く問題もこれで消える。
 *
 * 1×N の DataTexture（行0 = v0 = カード下端）。上下 1px 相当のヘアラインを
 * 焼き込むため N=256（カード高 283px ≒ 1.1px/texel）。
 */
function makeEdgeGradientTexture(): THREE.DataTexture {
  const N = 256;
  // [位置, RGB] — CSS 180deg（0=上端 → 1=下端）
  const stops: [number, number[]][] = [
    [0.0, [0x7c, 0x88, 0x9e]],
    [0.34, [0x4a, 0x52, 0x66]],
    [0.62, [0x2c, 0x32, 0x44]],
    [1.0, [0x1b, 0x20, 0x30]],
  ];
  const data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const v = i / (N - 1); // 0=下端(v0) → 1=上端
    const t = 1 - v;       // CSS 180deg（上→下）に合わせる
    let c = stops[stops.length - 1][1];
    for (let k = 0; k < stops.length - 1; k++) {
      const [p0, c0] = stops[k];
      const [p1, c1] = stops[k + 1];
      if (t <= p1) {
        const m = (t - p0) / (p1 - p0);
        c = c0.map((a, j) => a + (c1[j] - a) * m);
        break;
      }
    }
    // 上辺 1px の白ヘアライン反射 / 下辺 1px の陰り（inset box-shadow 相当）
    if (i === N - 1) c = c.map((a) => a + (255 - a) * 0.55);
    else if (i === 0) c = c.map((a) => a * (1 - 0.35));

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
  /** 親（ジェスチャ側）が GL の再描画ループを起こすための invalidate 窓口 */
  kick: React.MutableRefObject<() => void>;
  frontUri: string;
  backData?: CardBackData;
  backStyle: 'aluminum' | 'story';
  depthRatio: number;
  rotationEnabled: boolean;
  /** カードの見かけ寸法(px)。表面オーバーレイを px 基準で描くため */
  cardPx: { width: number; height: number };
  /** true = flip モード（参照 _dv3d の角度駆動）/ false = spin モード（トラックボール） */
  flipDrive?: boolean;
  /** 裏面の表示倍率（参照 S）。枠内クランプ済みの値を親が計算して渡す */
  backScale: number;
  /** 裏面の持ち上げ量（カード高比。参照 枠高の3%） */
  backLiftRatio: number;
  /** 表面からの回転角（度）。落影もこの値から UI スレッド側で導出する */
  rotationOut: SharedValue<number>;
  flipProgressOut?: SharedValue<number>;
  onFrontLoaded?: () => void;
  /** flip モードで「表へ戻り切った」瞬間（closing のスナップ成立時）に一度だけ呼ぶ */
  onClosed?: () => void;
}> = ({ spin, kick, frontUri, backData, backStyle, depthRatio, rotationEnabled, cardPx, flipDrive, backScale, backLiftRatio, rotationOut, flipProgressOut, onFrontLoaded, onClosed }) => {
  const groupRef = useRef<THREE.Group>(null);
  // frameloop="demand" の再描画要求。ジェスチャ開始（親）とテクスチャ到着で起こし、
  // 動いている間は useFrame 自身が次のフレームを要求し続ける（自走）。
  const invalidate = useThree((st) => st.invalidate);
  kick.current = invalidate;
  // useFrame の中から最新のコールバックを呼ぶ（依存で useFrame を張り直さない）
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const [frontTex, setFrontTex] = useState<THREE.Texture | null>(null);
  const [backTex, setBackTex] = useState<THREE.DataTexture | null>(null); // backStyle='story' 用
  const [inkTex, setInkTex] = useState<THREE.DataTexture | null>(null);  // backStyle='aluminum' の刻印
  const brushed = useMemo(makeBrushedTexture, []); // 'story' のテクスチャ読込待ちフォールバック

  // テクスチャ更新をコミット後に 1 フレーム描いて反映する。
  // 依存配列なしだと毎レンダー発火し、再レンダーのたびに GL を起こしていた。
  useEffect(() => {
    invalidate();
  }, [invalidate, frontTex, backTex, inkTex, backScale, backLiftRatio]);

  // ── シェーダーマテリアル（Web版リファレンス移植・lib/cardShaders.ts） ──
  // 表面: ライティング＋傾きで動く光の帯（優先項目①）。spin/flip 両モード共通。
  const uLightVec = useMemo(() => new THREE.Vector3(0.45, -0.55, -0.8), []);
  const frontMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CARD_VERTEX_SHADER,
        fragmentShader: ART_FRAGMENT_SHADER,
        uniforms: {
          map: { value: null },
          uHasMap: { value: 0 },
          uLight: { value: uLightVec },
          // 表面オーバーレイ（金の内枠・下端シャドウ）を px 基準で描くための実寸
          uCardPx: { value: new THREE.Vector2(cardPx.width, cardPx.height) },
        },
      }),
    [uLightVec, cardPx.width, cardPx.height],
  );
  useEffect(() => {
    frontMaterial.uniforms.map.value = frontTex;
    frontMaterial.uniforms.uHasMap.value = frontTex ? 1 : 0;
    frontMaterial.uniforms.uCardPx.value.set(cardPx.width, cardPx.height);
    frontMaterial.uniformsNeedUpdate = true;
  }, [frontTex, frontMaterial, cardPx.width, cardPx.height]);

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
        // 差し替え前のテクスチャは GPU 側を明示的に解放する。放置すると
        // 1024x1536 RGBA（約6MB）がフリップのたび積み上がる。
        if (res) setInkTex((prev) => { prev?.dispose(); return pixelsToTexture(res); });
      } catch {}
      return;
    }
    let alive = true;
    (async () => {
      try {
        // 裏面の刻印テクスチャ。参照 __dvMakeInk は 2048x4096 だが、実機では
        // 開いたカードの実表示が最大 ~364pt(=DPR3 で ~1092px) なので 1024x1536
        // で 4 倍以上の余裕がある。2048x4096 は RGBA で 32MB 使うため採らない。
        const res = await renderStoryBackPixels(backData, frontUri, 1024, 1536);
        if (res && alive) setBackTex((prev) => { prev?.dispose(); return pixelsToTexture(res); });
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
  useFrame((_, dtRaw) => {
    // 参照と同じく 50ms で頭打ちにする（フレーム落ち後の角度暴走を防ぐ）
    const dt = Math.min(dtRaw, DT_MAX);
    const s = spin.current;
    if (flipDrive) {
      // ── flip モード: 参照 _dv3d の startLoop()（1889-1897行）を移植 ──
      // ドラッグ中でなければフリック慣性を目標角へ積み、指数減衰させる
      if (!s.dragging) {
        s.tfy += s.fvy * dt;
        s.tfx = Math.max(-FLIP_PITCH_MAX, Math.min(FLIP_PITCH_MAX, s.tfx + s.fvx * dt));
        const df = Math.pow(FLIP_VEL_DECAY, dt * 60);
        s.fvx *= df;
        s.fvy *= df;
        // 指を離したらピッチだけ正面へ戻す（参照 v101）。倒れたまま止まらない
        s.tfx *= Math.exp(-dt * FLIP_PITCH_RECENTER);
      }
      // 参照と同じ平滑化 sm = 1 - exp(-dt·10)
      const sm = 1 - Math.exp(-dt * FLIP_K);
      s.fy += (s.tfy - s.fy) * sm;
      s.fx += (s.tfx - s.fx) * sm;
      s.qq += (s.tqq - s.qq) * sm;
      // 表へ戻り切ったらスナップ（参照: |ΔangY|<0.06 && |angX|<0.06 && q<0.04
      //   || now-closeT0>1500）。後者の保険が無いと、着地条件を満たせない姿勢で
      //   止まったときに closing のまま入力を受け付けなくなる。
      if (s.mode === 'closing') {
        s.closeElapsed += dt;
        const landed =
          Math.abs(s.fy - s.tfy) < 0.06 && Math.abs(s.fx) < 0.06 && s.qq < 0.04;
        if (landed || s.closeElapsed > CLOSE_TIMEOUT_S) {
        s.fy = s.tfy;
        s.fx = 0;
        s.qq = 0;
        s.mode = 'idle';
        // 2D（表面オーバーレイ）への復帰は「見た目が正面に戻り切った瞬間」に行う。
        // 固定 550ms タイマーだと復帰がアニメの途中／終了後に飛び込んで
        // カードが一段跳ねて見えるため、実際の着地でのみ通知する。
        onClosedRef.current?.();
        }
      }
      // 姿勢 = RotY(angY)·RotX(angX)。拡大・持ち上げは進捗 q で補間（参照 1895-1897行）
      TMP_EULER.set(s.fx, s.fy, 0, 'YXZ');
      s.q.setFromEuler(TMP_EULER);
      const scaleVal = 1 + (backScale - 1) * s.qq;
      const liftVal = H * backLiftRatio * s.qq;
      if (groupRef.current) {
        groupRef.current.scale.setScalar(scaleVal);
        groupRef.current.position.y = liftVal;
      }
      s.scale = scaleVal;
      s.lift = liftVal;
      // 接地影など外側のレイヤーが同じ縮小へ追従できるよう進捗を流す
      if (flipProgressOut) flipProgressOut.value = s.qq;
    } else if (s.animating && s.target) {
      // 目標姿勢へスラープ（フリップの回り込み演出）。近づいたら確定。
      const k = Math.min(1, dt * FLIP_K);
      s.q.slerp(s.target, k);
      s.vx = 0;
      s.vy = 0;
      // 回転・倍率・持ち上げを同じ進捗で補間して同時に着地させる（参照 _dv3d は
      // rot / scale / offset を共通の平滑化係数 sm で動かし、途中の跳ねは無い）。
      // （表→裏: 1 → BACK_SCALE / 裏→表: BACK_SCALE → 1）
      const ang = s.q.angleTo(s.target); // π→0 と減っていく
      const progress = 1 - Math.min(1, ang / Math.PI);
      const scaleVal = s.startScale + (s.finalScale - s.startScale) * progress;
      const liftVal = s.startLift + (s.finalLift - s.startLift) * progress;
      if (groupRef.current) {
        groupRef.current.scale.setScalar(scaleVal);
        groupRef.current.position.y = liftVal;
      }
      s.scale = scaleVal;
      s.lift = liftVal;
      if (ang < 0.02) {
        s.q.copy(s.target);
        s.animating = false;
        s.target = null;
        if (groupRef.current) {
          groupRef.current.scale.setScalar(s.finalScale);
          groupRef.current.position.y = s.finalLift;
        }
        s.scale = s.finalScale;
        s.lift = s.finalLift;
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
    if (groupRef.current) groupRef.current.quaternion.copy(s.q);
    // 表面法線と視線のなす角。cos = 表向き度（参照の fore）
    TMP_FRONT.set(0, 0, 1).applyQuaternion(s.q);
    const z = Math.max(-1, Math.min(1, TMP_FRONT.z));
    // JS スレッドから SharedValue へ書くと、1本ごとにクロージャを
    // createSerializable して UI スレッドへスケジュールする。毎フレームの
    // コストなので本数を絞る。落影も接地影も、この回転角ひとつから
    // UI スレッド側の derived で出せる。
    rotationOut.value = (Math.acos(z) * 180) / Math.PI;
    // ── frameloop="demand" の自走判定 ──
    // 動きが残っている間だけ次フレームを要求する。静止したら要求が止まり、
    // GL は 1 フレームも描かない（Pixel 6 で「常時 60fps で GL が回り続けて
    // 重い」の対策。C/D ブロックの「止まっている時計は回さない」と同じ規律）。
    const moving =
      s.dragging ||
      s.animating ||
      s.mode === 'closing' ||
      Math.abs(s.tfy - s.fy) > 1e-4 ||
      Math.abs(s.tfx - s.fx) > 1e-4 ||
      Math.abs(s.tqq - s.qq) > 1e-4 ||
      Math.abs(s.fvx) + Math.abs(s.fvy) > 1e-3 ||
      Math.abs(s.vx) + Math.abs(s.vy) > 0;
    if (moving) invalidate();
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
   * カード背後の落影（card-aura）を描くか。
   * プレイヤーは CardBackdrop 側で描くため false（既定）。
   * v99-tsubasa で色指定は廃止（黒3層固定）。光は面側 CardSurface が担う。
   */
  shadow?: boolean;
  /** 厚み比（対カード幅）。既定は v99-tsubasa の 8.5/188.6。プレイヤーは 1mm 相当 0.016 を指定 */
  depthRatio?: number;
  /**
   * カードを収める枠（＝参照のデバイス枠）の実寸(px)。
   * 裏面の拡大率 S と持ち上げ量を参照どおり枠基準で決めるために使う。
   * 未指定なら参照の既定値（S=1.28 / 持ち上げ 0.0806）へフォールバック。
   * ※毎レンダーで新しいオブジェクトを渡さないこと（useMemo 推奨）
   */
  frame?: { width: number; height: number };
  /** flip モードで表↔裏が切り替わったとき（親が横スクロール可否を切替える用） */
  onFlipChange?: (flipped: boolean) => void;
  /** 背面レイヤー追従用（任意・度 / px） */
  rotationOut?: SharedValue<number>;
  /** フリップ進捗 0=表(2D) / 1=裏(3D)。接地影の縮小追従などに使う */
  flipProgressOut?: SharedValue<number>;
  dragXOut?: SharedValue<number>;
  /**
   * 購入トランジションの「シアンの呼吸」進捗（0=平常 / 1=ピーク）。
   * カード枠（内側1pxのシアン）と靄（外周のシアングロー2層）が同時に灯る。
   */
  purchaseGlow?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
};

export const CardGL: React.FC<CardGLProps> = ({
  frontUri,
  width,
  height,
  backData,
  mode = 'spin',
  backStyle = 'aluminum',
  shadow = false,
  depthRatio = DEPTH_RATIO,
  frame,
  onFlipChange,
  rotationOut,
  flipProgressOut,
  dragXOut,
  purchaseGlow,
  style,
}) => {
  const spin = useRef<SpinState>({
    q: new THREE.Quaternion(),
    vx: 0,
    vy: 0,
    dragging: false,
    target: null,
    animating: false,
    scale: FRONT_SCALE,
    startScale: FRONT_SCALE,
    finalScale: FRONT_SCALE,
    lift: 0,
    startLift: 0,
    finalLift: 0,
    fy: 0,
    fx: 0,
    tfy: 0,
    tfx: 0,
    fvy: 0,
    fvx: 0,
    qq: 0,
    tqq: 0,
    mode: 'idle',
    closeElapsed: 0,
  });
  const last = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  // 参照 move() と同じ 120ms のローリング窓。PanResponder の g.vx/g.vy は
  // 直近1イベントの瞬時速度でばらつきが大きく、同じフリックでも回転量が
  // 揃わなかった。窓で平均した速度を使う。
  const samples = useRef<{ t: number; x: number; y: number }[]>([]);
  const pushSample = (dx: number, dy: number) => {
    const tn = nowMs();
    const arr = samples.current;
    arr.push({ t: tn, x: dx, y: dy });
    while (arr.length && tn - arr[0].t > VEL_WINDOW_MS) arr.shift();
  };
  /** 窓の両端から px/ms を出す。サンプルが足りなければ null（＝慣性なし） */
  const windowVelocity = (): { vx: number; vy: number } | null => {
    const arr = samples.current;
    if (arr.length < 2) return null;
    const a0 = arr[0];
    const a1 = arr[arr.length - 1];
    const dt = Math.max((a1.t - a0.t) / 1000, 0.001);
    return { vx: (a1.x - a0.x) / dt, vy: (a1.y - a0.y) / dt };
  };

  // GL 再描画の起こし役（CardMesh が invalidate を差し込む）
  const glKick = useRef<() => void>(() => {});

  // タップ位置（ラッパー View 左上基準）。作家名の当たり判定に使う。
  // locationX は「触れた最深の View」基準になりうるので pageXY - 実測原点で出す。
  const wrapRef = useRef<View>(null);
  const wrapOrigin = useRef({ x: 0, y: 0 });
  const tapPos = useRef({ x: 0, y: 0 });
  const measureWrap = () => {
    wrapRef.current?.measureInWindow((x, y) => {
      wrapOrigin.current = { x, y };
    });
  };

  // オーラの明滅（裏返しと同時にフェードアウト・参照 fadeAura）
  // 回転角の出力先。呼び出し側が受け取らない場合（プレイヤーの spin モード）は
  // 内部の SharedValue を使い、CardMesh からの書き込みは常に 1 本で済ませる。
  const rotInternal = useSharedValue(0);
  const rotSV = rotationOut ?? rotInternal;
  // 落影は回り始めたら消す。cos(回転角) で落とすと、45° あたりでもまだ 0.7 残り、
  // 「細くなったカードの後ろにカード型の黒い影が出ている」状態になっていた
  // （実機で指摘）。影はカードと違って回らない板なので、少しでも残ると必ず
  // ズレて見える。参照も開いた瞬間にフェードアウトさせて回転には連動させない。
  const auraStyle = useAnimatedStyle(
    () => ({ opacity: Math.max(0, 1 - Math.abs(rotSV.value) / AURA_HIDE_DEG) }),
    [rotSV],
  );

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
  //   裏面タップ → GL が正面へ戻り切った瞬間（CardMesh の onClosed）に復帰
  //
  // 復帰タイミングを固定タイマー（旧 550ms）から実測の着地へ変えている。
  // タイマーだと端末の描画速度で早すぎ／遅すぎが起き、GL カードと
  // オーバーレイの二重表示や一瞬の抜けが「戻りのガタつき」に見えていた。
  // タイマーは着地イベントが来なかった場合の保険としてのみ残す。
  const [overlayVisible, setOverlayVisible] = useState(isFlip);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (overlayTimer.current) clearTimeout(overlayTimer.current); }, []);

  // 復帰時の短いクロスフェード（GL 面 → オーバーレイの差をならす）
  const overlayOpacity = useSharedValue(1);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  const clearOverlayTimer = () => {
    if (overlayTimer.current) { clearTimeout(overlayTimer.current); overlayTimer.current = null; }
  };

  // 着地イベントと保険タイマーの二重発火を防ぐ（フェードのやり直しを起こさない）
  const overlayShown = useRef(isFlip);
  const showOverlay = () => {
    clearOverlayTimer();
    if (overlayShown.current) return;
    overlayShown.current = true;
    overlayOpacity.value = withTiming(1, { duration: OVERLAY_FADE_MS });
    setOverlayVisible(true);
  };

  // 参照 _dv3d は mode を同期に持つため、開いた直後の2打目も確実に close へ届く。
  // アプリ側は flipped(state) 頼みだったので、React のコミット前に来た2打目が
  // まだ表面の Pressable に吸われて消えていた。mode を ref で先に確定させる。
  const flipToBack = () => {
    const s = spin.current;
    if (s.mode !== 'idle') return; // 参照: open は idle からのみ
    glKick.current();
    s.mode = 'open';
    clearOverlayTimer();
    overlayOpacity.value = 1; // 次回の復帰に備えて初期値へ
    overlayShown.current = false;
    setOverlayVisible(false); // 実体オーバーレイを外して GL のフリップを見せる
    setFlipped(true);
    onFlipChange?.(true);
  };
  const flipToFront = () => {
    const s = spin.current;
    if (s.mode !== 'open') return; // 参照: closing 中のタップは無視される
    glKick.current();
    s.mode = 'closing';
    s.closeElapsed = 0;
    setFlipped(false);
    // 横スワイプ（曲切替）は戻り始めた時点で解禁する。戻り切るまで待つと
    // 「2Dに戻ったのにスワイプが効かない」空白が出る。
    onFlipChange?.(false);
    overlayOpacity.value = 0;
    // 保険: 着地イベントが来ないまま 900ms 経ったら強制復帰
    clearOverlayTimer();
    overlayTimer.current = setTimeout(showOverlay, 900);
  };

  // flipped の変化でフリップ演出を仕込む（参照 _dv3d の open() / close() 移植）。
  //   開く: 姿勢を毎回 0 にリセットしてから 0→π へ（参照 1913行
  //         angX=0;tAngX=0;angY=0;tAngY=π;vel=0;q=0;tq=1）。リセットするから
  //         何度開いても同じ回り方になる＝「不安定」の解消。
  //   戻す: ヨーを最寄りの全回転 k·2π へスナップして戻す（参照 close() 1881行）。
  //         裏面で何周回していても最短の正面へ着地する。
  useEffect(() => {
    if (!isFlip) return;
    const s = spin.current;
    if (flipped) {
      s.fy = 0;
      s.tfy = Math.PI;
      s.fx = 0;
      s.tfx = 0;
      s.qq = 0;
      s.tqq = 1;
    } else {
      s.tfy = Math.round(s.fy / (2 * Math.PI)) * 2 * Math.PI;
      s.tfx = 0;
      s.tqq = 0;
    }
    s.fvx = 0;
    s.fvy = 0;
    s.dragging = false;
    // 落影は useFrame が表向き度から毎フレーム決める（ここでは触らない）
  }, [flipped, isFlip]);

  // spin モード=常時回転可 / flip モード=裏面のときだけ回転可
  const canRotate = isFlip ? flipped : true;

  // タップ（フリップ）と回転を1つの PanResponder で受ける。
  // 以前は表面のタップを「GL キャンバスに重ねた透明 Pressable」で受けていたが、
  // 実機で R3F Canvas 側のタッチ処理と競合してタップが落ちる事象があったため、
  // 再生画面で実績のあるラッパー View への直接装着方式に統一した。
  //   表面: 開始のみ主張（タップ検出）。移動は主張しない＝横スワイプは
  //         FlatList（曲切替）が奪える（terminationRequest も許可）。
  //   裏面: 移動も主張して全方向回転。スクロールへは明け渡さない。
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => canRotate && Math.abs(g.dx) + Math.abs(g.dy) > 2,
        onPanResponderTerminationRequest: () => !canRotate,
        onPanResponderGrant: (e) => {
          glKick.current(); // demand ループを起こす（以後は useFrame が自走）
          const s = spin.current;
          s.dragging = canRotate;
          s.vx = 0;
          s.vy = 0;
          // 参照 down() は慣性を必ず 0 にする。flip 用も消さないと、回っている
          // カードを指で押さえても前のフリックの勢いが生き残る。
          s.fvx = 0;
          s.fvy = 0;
          last.current = { x: 0, y: 0 };
          moved.current = false;
          samples.current = [];
          pushSample(0, 0);
          // タップ位置はラッパー左上基準へ直す（作家名の当たり判定に使う）
          tapPos.current = {
            x: e.nativeEvent.pageX - wrapOrigin.current.x,
            y: e.nativeEvent.pageY - wrapOrigin.current.y,
          };
        },
        onPanResponderMove: (_e, g) => {
          if (Math.abs(g.dx) + Math.abs(g.dy) > 4) moved.current = true;
          if (!canRotate) return; // 表面: ドラッグは親の曲切替に任せる
          const ddx = g.dx - last.current.x;
          const ddy = g.dy - last.current.y;
          last.current = { x: g.dx, y: g.dy };
          if (isFlip) {
            // flip モード: 参照 move()。横=ヨー / 縦=ピッチ(±0.38・感度は横の半分)
            const s = spin.current;
            s.tfy += ddx * FLIP_DRAG_SENS;
            // 横の動きが勝っている間は縦の傾きを与えない（重み = |dy|/(|dx|+|dy|)）。
            // 参照のカルーセルが |ax|>=|ay| で軸を決めているのと同じ考え方を、
            // 段差の出ない連続値にしたもの。真横に払えば 0、真下へ引けば 1。
            const ax = Math.abs(ddx);
            const ay = Math.abs(ddy);
            const pitchW = ax + ay > 0 ? ay / (ax + ay) : 0;
            // 符号は反転させる。回すのは常に裏面（ヨー≒180°）なので、
            // 姿勢が Ry(π)·Rx(θ) となり X 回転の見え方が鏡像になる。素直に
            // ddy を足すと「上へスワイプ＝上端が手前」と逆に倒れていた。
            // 望みの対応は 上スワイプ→上端が奥 / 下スワイプ→上端が手前。
            s.tfx = Math.max(
              -FLIP_PITCH_MAX,
              Math.min(FLIP_PITCH_MAX, s.tfx - ddy * FLIP_PITCH_SENS * pitchW),
            );
          } else {
            // spin モード: 指の移動ベクトルどおりに回す（横=Y軸 / 縦=X軸 / 斜め=合成軸）
            applySpin(spin.current.q, ddy * SENS, ddx * SENS);
          }
          pushSample(g.dx, g.dy);
          if (dragXOut) dragXOut.value = g.dx;
        },
        onPanResponderRelease: (_e, g) => {
          const s = spin.current;
          s.dragging = false;
          // タップ判定は参照 up() と同じユークリッド距離 <10px（1877行 tapDist<10）。
          // 以前の |dx|+|dy|>4 は実機の指ブレで超えやすく、裏面で「タップしたのに
          // ドラッグ扱いになり正面へ戻れない」原因だった。
          const isTap = Math.hypot(g.dx, g.dy) < 10;
          if (isTap && isFlip) {
            // 参照 up(): tapDist<10 かつ mode==='open' のときだけ反応する。
            // closing 中とカルーセル整定中は無視（＝再オープンに化けない）。
            if (s.mode === 'open') {
              // 裏面はどこを突いても表へ戻すだけ（作家一覧への遷移は廃止）
              flipToFront();
            } else if (s.mode === 'idle') {
              flipToBack();
            }
          } else if (!isTap && canRotate) {
            // 参照 up(): 直近 120ms の窓から px/s を出す（g.vx は瞬時値なので使わない）
            const v = windowVelocity();
            if (!v) {
              // サンプルが足りない（＝ほぼ動いていない）。前のフリック値を
              // 残さず 0 にする。残すと「ゆっくり動かして離したのに前の勢いで
              // 回り続ける」状態になる。
              s.fvy = 0;
              s.fvx = 0;
              s.vx = 0;
              s.vy = 0;
            } else {
              if (isFlip) {
                // px/s → rad/s。ピッチは感度半減＋±2 clamp（参照 v101）
                s.fvy = Math.max(-FLIP_VEL_MAX, Math.min(FLIP_VEL_MAX, v.vx * FLIP_DRAG_SENS));
                // ドラッグ中と同じ軸重み。横へ払った勢いが縦の傾きに化けない
                const avx = Math.abs(v.vx);
                const avy = Math.abs(v.vy);
                const pw = avx + avy > 0 ? avy / (avx + avy) : 0;
                // ドラッグと同じく符号を反転（裏面での鏡像ぶん）
                s.fvx = Math.max(
                  -FLIP_PITCH_VEL_MAX,
                  Math.min(FLIP_PITCH_VEL_MAX, -v.vy * FLIP_PITCH_SENS * pw),
                );
              } else {
                // spin モード: px/s → 度/秒 で慣性回転
                s.vx = v.vy * SENS;
                s.vy = v.vx * SENS;
              }
            }
          }
          samples.current = [];
          if (dragXOut) dragXOut.value = withSpring(0, { damping: 16, stiffness: 120 });
        },
        onPanResponderTerminate: () => {
          spin.current.dragging = false;
          if (dragXOut) dragXOut.value = withSpring(0, { damping: 16, stiffness: 120 });
        },
      }),
    // タップの分岐は spin.current.mode（ref）を見るので flipped の再生成は不要だが、
    // canRotate は onMoveShouldSetPanResponder で参照するため依存に残す。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canRotate, dragXOut, isFlip],
  );

  // 描画キャンバスはカードの対角線サイズの正方形にし、レイアウト枠から
  // はみ出して重ねる。横長の向き（90°回転など）でもカードの長辺が
  // 収まり、端で切れない。カメラ距離を D/height 倍して見かけの
  // カードサイズは従来と同一に保つ。
  // 拡大（backScale）と持ち上げを含めて、回転中の対角線が切れないだけの
  // 正方形キャンバスを確保する。
  // 参照どおり枠基準でクランプした拡大率・持ち上げ量（未指定時は参照既定値）
  const backScale = useMemo(() => computeBackScale(frame, width, height), [frame, width, height]);
  const backLiftRatio = useMemo(() => computeBackLiftRatio(frame, height), [frame, height]);
  const liftPx = height * backLiftRatio;
  // backScale<1 でも回転時の対角線は縮まないので 1 を下回らせない
  const D = Math.ceil(Math.hypot(width, height) * Math.max(1, backScale) + liftPx * 2) + 8;
  // 対角線の正方形が要るのは spin モード（トラックボール自由回転）だけ。
  // flip はヨー回転なので横幅は詰められる（投影幅は最大でもカード幅どまり）。
  //
  // ただし縦は詰めてはいけない。ヨーで手前に来た辺は遠近で拡大され（camZ と
  // カード半幅から最大 1.17 倍）、さらに裏面は 1.28 倍＋持ち上げが乗る。
  // 実測で上辺が水平に切れていた（Pixel 6・キャンバス上辺 202dp で clip）。
  // 縦は元の安全な値をそのまま使い、横だけ削る。
  const CW = isFlip ? Math.ceil(width * Math.max(1, backScale) * 1.25) + 16 : D;
  const CH = D;

  // カメラ距離は幾何から逆算する。
  //   見かけのカード高(px) = D * (H_world / 可視world高)、可視world高 = 2*camZ*tan(FOV/2)
  //   これを height に一致させる camZ = D * H_world / (height * 2*tan(FOV/2))
  // 旧実装は係数 3.4 の決め打ちで、FOV=40 の正解 2.6788 とずれていたため
  // GL カードがレイアウト枠の 78.8% でしか描かれず、表面オーバーレイ(RN Image)
  // からフリップへ移る瞬間にカードが縮んで見えていた。
  // FOV は垂直画角なので、キャンバスの「高さ」で逆算する
  const camZ = (CH * H) / (height * 2 * Math.tan((FOV * Math.PI) / 180 / 2));

  // ── A-3: Canvas へ渡すオブジェクトを固定する ──
  // インラインのリテラルだと毎レンダーで別物になり、R3F の CanvasImpl が
  // configure() + root.render() でツリーを丸ごと再 reconcile していた。
  const canvasStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: (width - CW) / 2,
      top: (height - CH) / 2,
      width: CW,
      height: CH,
      backgroundColor: 'transparent',
    }),
    [width, height, CW, CH],
  );
  const cameraCfg = useMemo(
    () => ({ position: [0, 0, camZ] as [number, number, number], fov: FOV }),
    [camZ],
  );
  const glCfg = useMemo(() => ({ alpha: true }), []);

  // ラッパは常に同じ View（要素型を変えると Canvas が再マウントされ
  //   GL 再初期化のちらつきが出るため）。PanResponder は表裏とも常時装着
  //   （表面はタップのみ拾い、ドラッグは親の横スワイプへ明け渡す）。
  const handlers = pan.panHandlers;

  // GL テクスチャ生成完了までのつなぎ表示（表面の作品画像を RN Image で即時に出す）
  const [frontReady, setFrontReady] = useState(false);

  // 表面オーバーレイ（金の内枠・下端シャドウ）を px 基準で描くための実寸
  const cardPx = useMemo(() => ({ width, height }), [width, height]);

  return (
    <View ref={wrapRef} onLayout={measureWrap} style={[{ width, height }, style]} {...handlers}>
      {/* card-aura（v99-tsubasa: 黒3層の落影）。指定時のみ */}
      {shadow && (
        <Animated.View style={[StyleSheet.absoluteFill, auraStyle]} pointerEvents="none">
          <CardAura width={width} height={height} />
        </Animated.View>
      )}

      {/* 購入時の靄（外周シアングロー2層）。カードより背面 */}
      {purchaseGlow && (
        <PurchaseGlow layer="haze" width={width} height={height} progress={purchaseGlow} />
      )}

      {/* pointerEvents="none" は必須。R3F の Canvas は内部で
          onMoveShouldSetPanResponderCapture:()=>true の PanResponder を全面に
          張っており、capture 段階でタッチを奪う。するとラッパー View の
          PanResponder は onMoveShouldSetPanResponder（2px 動いた時）でしか
          responder を取り返せず、指がブレない綺麗なタップは Release まで
          届かない ＝ 裏面をタップしても表へ戻らない事故になる。 */}
      <Canvas
        pointerEvents="none"
        frameloop="demand"
        style={canvasStyle}
        camera={cameraCfg}
        gl={glCfg}
      >
        {/* 透明背景（Skia のオーラ/調律陣を透過させる） */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[2.5, 3, 4]} intensity={1.25} />
        <pointLight position={[-3, 1.5, 3]} intensity={0.8} color="#7fdcf0" />
        <CardMesh
          spin={spin}
          kick={glKick}
          frontUri={frontUri}
          backData={backData}
          backStyle={backStyle}
          depthRatio={depthRatio}
          rotationEnabled={canRotate}
          cardPx={cardPx}
          flipDrive={isFlip}
          backScale={backScale}
          backLiftRatio={backLiftRatio}
          rotationOut={rotSV}
          flipProgressOut={flipProgressOut}
          onFrontLoaded={() => setFrontReady(true)}
          onClosed={showOverlay}
        />
      </Canvas>

      {/* flip モードの表面: 実体のあるオーバーレイ（v98 表面と同一の作品画像）が
          タップ受けを兼ねる。透明ビューや GL レイヤーのタップ判定に依存しない
          ＝実機で確実に反応する（794793f で実証済みの方式）。
          RN Image は即時表示されるため、GL テクスチャ生成待ちの無地も隠れる */}
      {isFlip && overlayVisible && (
        <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={flipToBack}>
            <Image
              source={{ uri: frontUri }}
              style={{ width, height, borderRadius: CORNER_RATIO * width }}
              resizeMode="cover"
            />
            {/* v99-tsubasa の表面オーバーレイ（面内減光・金の内枠・下端の内側シャドウ） */}
            <CardSurface width={width} height={height} />
          </Pressable>
        </Animated.View>
      )}

      {/* 購入時のカード枠（内側1pxのシアン）。カード面・オーバーレイより前面 */}
      {purchaseGlow && (
        <PurchaseGlow layer="frame" width={width} height={height} progress={purchaseGlow} />
      )}

      {/* spin モード（プレイヤー）: GL テクスチャの読込・アップロード完了までは
          RN Image を重ねて作品画像を即時表示（GL 側はプレースホルダ色のため） */}
      {!isFlip && !frontReady && (
        <>
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
          <CardSurface width={width} height={height} />
        </>
      )}
    </View>
  );
};

export default CardGL;
