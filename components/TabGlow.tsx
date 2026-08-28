/**
 * TabGlow.tsx — フッターのアクティブタブに添える金色のグロー（v99 fr_v99_tsubasa 準拠）
 * ------------------------------------------------------------------
 * モックの CSS:
 *   .tb.on svg{filter:drop-shadow(0 0 6px rgba(233,200,121,.45))}
 *   .tb.on::before{
 *     top:-1px; left:50%; transform:translateX(-50%);
 *     width:26px; height:2px;
 *     background:linear-gradient(90deg,transparent,var(--gold),transparent);
 *     box-shadow:0 0 8px rgba(233,200,121,.55)
 *   }
 * RN に CSS の filter/box-shadow/::before は無いため、Skia の Blur で2つを再現する。
 *   ・TabIconGlow     : アイコン背後に淡い金の丸ぼかし（drop-shadow 相当）
 *   ・TabTopIndicator : タブ上端の金グラデーションの棒＋その光暈（::before 相当）
 * どちらも isActive の切り替えで 250ms（CSS の transition と同じ長さ）フェードする。
 *
 * VIP タブは常時シアン（Footer.tsx 側の既存仕様）で、この金グローとは無関係。
 * アクティブになったときは TabTopIndicator（上端インジケータ）だけ表示し、
 * アイコン自体の金グロー（TabIconGlow）は非VIPタブにのみ使う想定。
 */

import React, { useEffect } from 'react';
import {
  Canvas,
  Circle,
  Rect,
  RadialGradient,
  LinearGradient,
  Blur,
  vec,
} from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withTiming, Easing } from 'react-native-reanimated';

const GOLD = '#e9c879';
const GOLD_ZERO = 'rgba(233,200,121,0)';
const FADE_MS = 250;

function useActiveFade(active: boolean) {
  const t = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    t.value = withTiming(active ? 1 : 0, { duration: FADE_MS, easing: Easing.out(Easing.quad) });
  }, [active, t]);
  return t;
}

/**
 * アイコン背後の淡い金ぼかし。glyphWrap 内で、アイコンより前（下）に
 * 絶対配置で重ねる想定（このコンポーネント自体には position 系は付けない
 * ので、呼び出し側の View に position:'relative' 相当＝RNの既定値があれば足りる）。
 */
export const TabIconGlow: React.FC<{ active: boolean; size?: number }> = ({
  active,
  size = 20,
}) => {
  const t = useActiveFade(active);
  const opacity = useDerivedValue(() => t.value * 0.45); // rgba(...,.45)

  // CSS blur-radius 6px 相当 → Skia sigma ≒ 3（PurchaseCardGlow と同じ σ≒radius/2 換算）
  const R = size * 0.55;
  const M = 14; // にじみの余白
  const c = vec(M + R, M + R);

  return (
    <Canvas
      style={{
        position: 'absolute',
        top: -M,
        left: -M,
        width: R * 2 + M * 2,
        height: R * 2 + M * 2,
      }}
      pointerEvents="none"
    >
      <Circle c={c} r={R} opacity={opacity}>
        <RadialGradient c={c} r={R} colors={[GOLD, GOLD_ZERO]} />
        <Blur blur={3} />
      </Circle>
    </Canvas>
  );
};

/**
 * タブ上端の金インジケータ（棒＋光暈）。タブ本体（Pressable）の直下の子として
 * 絶対配置する想定。left/right を指定しないので、親の alignItems（Footer.tsx
 * の styles.tab は alignItems:'center'）にそのまま従って水平中央に来る。
 */
export const TabTopIndicator: React.FC<{ active: boolean }> = ({ active }) => {
  const t = useActiveFade(active);
  const barOpacity = useDerivedValue(() => t.value);
  const glowOpacity = useDerivedValue(() => t.value * 0.55); // rgba(...,.55)

  const W = 26;
  const H = 2;
  const M = 10; // にじみの余白
  const canvasW = W + M * 2;
  const canvasH = H + M * 2;

  return (
    <Canvas
      style={{
        position: 'absolute',
        top: -1 - M,
        width: canvasW,
        height: canvasH,
      }}
      pointerEvents="none"
    >
      {/* 光暈: box-shadow 0 0 8px rgba(233,200,121,.55) 相当（Skia sigma≒4） */}
      <Rect x={M} y={M} width={W} height={H} opacity={glowOpacity}>
        <LinearGradient start={vec(M, 0)} end={vec(M + W, 0)} colors={[GOLD_ZERO, GOLD, GOLD_ZERO]} />
        <Blur blur={4} />
      </Rect>
      {/* 芯の棒: linear-gradient(90deg,transparent,gold,transparent) */}
      <Rect x={M} y={M} width={W} height={H} opacity={barOpacity}>
        <LinearGradient start={vec(M, 0)} end={vec(M + W, 0)} colors={[GOLD_ZERO, GOLD, GOLD_ZERO]} />
      </Rect>
    </Canvas>
  );
};

export default TabTopIndicator;
