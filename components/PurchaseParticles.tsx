/**
 * PurchaseParticles.tsx — 購入時の光粒子（パーティクル）エフェクト
 * ------------------------------------------------------------------
 * 「購入する」確定タップの直後、画面下部から天の川のように無数の光の粒が
 * びっしりと舞い上がって消える。旧 RisingBubbles（シャンパンの泡）を
 * 差し替え、以下の仕様に合わせて再実装:
 *   ・粒子数: 180〜250（画面幅いっぱいにランダム配置・高密度）
 *   ・サイズ: 極小1.0-1.5px(60%) / 中小2.0-3.0px(30%) / 大3.5-4.5px(10%)
 *   ・色: 明るいシアン#A0ECF7(50%) / 白#FFFFFF(30%) / シアン#60CEE0(20%)
 *   ・Y: 下から -180〜-320px 上昇 / X: ±20px の揺らぎ
 *   ・不透明度: フェードイン(200ms)→上昇中チラつき→上端でフェードアウト
 *   ・各粒子は 0〜300ms のランダム遅延で発生し、連続感を出す
 * 総尺は約1.6秒（呼び出し側のカード発光・浮遊と同時に開始する想定）。
 */

import React, { useMemo, useEffect } from 'react';
import {
  Canvas,
  Group,
  Circle,
  Paint,
  Blur,
  useClock,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
  SharedValue,
} from 'react-native-reanimated';

const PARTICLE_COUNT = 220;
const RISE_MIN = 180;
const RISE_MAX = 320;
const WOBBLE_MAX = 20;
const DELAY_MAX = 300;
const RISE_DURATION_MIN = 900;
const RISE_DURATION_MAX = 1400;

// 明るいシアン5 : 白3 : シアン2（＝50% / 30% / 20%）
const COLORS = [
  ...Array(5).fill('#A0ECF7'),
  ...Array(3).fill('#FFFFFF'),
  ...Array(2).fill('#60CEE0'),
];

// 半径(px)。極小60% / 中小30% / 大10%（直径ベースの仕様値を半径に換算）
function randomRadius(): number {
  const r = Math.random();
  if (r < 0.6) return 0.5 + Math.random() * 0.25;   // 極小: 直径1.0〜1.5px
  if (r < 0.9) return 1.0 + Math.random() * 0.5;     // 中小: 直径2.0〜3.0px
  return 1.75 + Math.random() * 0.5;                 // 大: 直径3.5〜4.5px
}

type Particle = {
  x0: number;       // 発生X（画面幅いっぱいにランダム）
  y0: number;       // 発生Y（画面下部エリア内でランダム）
  rise: number;      // 上昇距離（-180〜-320px）
  wobble: number;    // 横揺れ振幅（〜±20px）
  wobbleSpeed: number;
  wobblePhase: number;
  size: number;      // 半径
  color: string;
  delay: number;     // 発生遅延（0〜300ms）
  duration: number;  // 上昇にかける時間
  flickerSpeed: number;
};

function makeParticles(n: number, w: number, h: number): Particle[] {
  const arr: Particle[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      x0: Math.random() * w,
      y0: h * (0.72 + Math.random() * 0.26), // 画面下部エリア
      rise: RISE_MIN + Math.random() * (RISE_MAX - RISE_MIN),
      wobble: Math.random() * WOBBLE_MAX,
      wobbleSpeed: 1.5 + Math.random() * 2.5,
      wobblePhase: Math.random() * Math.PI * 2,
      size: randomRadius(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * DELAY_MAX,
      duration: RISE_DURATION_MIN + Math.random() * (RISE_DURATION_MAX - RISE_DURATION_MIN),
      flickerSpeed: 6 + Math.random() * 10,
    });
  }
  return arr;
}

const Spark: React.FC<{
  p: Particle;
  clock: SharedValue<number>;
  master: SharedValue<number>;
}> = ({ p, clock, master }) => {
  // 0..1 の上昇進捗（発生遅延を差し引いた自分だけの経過時間）
  const t = useDerivedValue(() => {
    const elapsed = clock.value - p.delay;
    if (elapsed <= 0) return 0;
    return Math.min(1, elapsed / p.duration);
  });

  const cy = useDerivedValue(() => p.y0 - p.rise * t.value);
  const cx = useDerivedValue(
    () => p.x0 + Math.sin(t.value * Math.PI * 2 * (p.wobbleSpeed / 3) + p.wobblePhase) * p.wobble,
  );
  // フェードイン(先頭200ms相当) → 上昇中チラつき → 上端でフェードアウト
  const opacity = useDerivedValue(() => {
    const inFrac = Math.min(1, t.value / 0.12); // ≒200ms分
    const outFrac = 1 - Math.max(0, (t.value - 0.8) / 0.2); // 終盤20%でフェード
    const flicker = 0.75 + 0.25 * Math.sin(clock.value / 1000 * p.flickerSpeed + p.wobblePhase);
    const started = t.value > 0 ? 1 : 0;
    return master.value * started * inFrac * outFrac * flicker;
  });

  return <Circle cx={cx} cy={cy} r={p.size} color={p.color} opacity={opacity} />;
};

type Props = {
  width: number;
  height: number;
  onDone?: () => void;
};

export const PurchaseParticles: React.FC<Props> = ({ width, height, onDone }) => {
  const clock = useClock();
  const master = useSharedValue(0);
  const particles = useMemo(() => makeParticles(PARTICLE_COUNT, width, height), [width, height]);

  useEffect(() => {
    // フェーズ1(0-400ms)発生・フェーズ2(400-1000ms)拡散ピーク・フェーズ3(1000-1600ms)フェードアウト。
    // 個々の粒子は自前のフェード曲線を持つので、master は全体の立ち上がり/消滅だけを司る。
    master.value = withSequence(
      withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }),
      withDelay(
        600,
        withTiming(0, { duration: 600, easing: Easing.in(Easing.quad) }, (finished) => {
          'worklet';
          if (finished && onDone) runOnJS(onDone)();
        }),
      ),
    );
  }, [master, onDone]);

  return (
    <Canvas style={{ position: 'absolute', width, height }} pointerEvents="none">
      <Group layer={<Paint><Blur blur={1.5} /></Paint>}>
        {particles.map((p, i) => (
          <Spark key={i} p={p} clock={clock} master={master} />
        ))}
      </Group>
    </Canvas>
  );
};

export default PurchaseParticles;
