/**
 * PurchaseTransition.tsx — FLUX RING 購入トランジションの統括（参照実装）
 * ------------------------------------------------------------------
 * 何を: 「購入する」を押した瞬間の一連の演出をまとめる司令塔。
 *   起点の小さい矩形(from)から、目標サイズ(to)まで作品カードが拡大しながら立ち上がり、
 *   ふっと呼吸し、星が一斉点火し(StarBurst)、最後に下部のトランスポート(children)が現れる。
 *
 * 使い方: 全画面オーバーレイ。ref.start() で再生する。
 *   const ref = useRef<PurchaseTransitionHandle>(null);
 *   <PurchaseTransition ref={ref} deviceW={W} deviceH={H}
 *     from={{x,y,w}} to={{x,y,w}} imageUri={url}>
 *     <Transport ... />
 *   </PurchaseTransition>
 *   ref.current?.start();
 *
 * 実装方針: カードの拡大は reanimated の transform(translate+scale, 原点=左上)で行う。
 *   ArtworkCard は to.w 基準で 1度だけ描き、scale で from→to に補間するので再描画が起きない。
 *   from/to は「見かけのカード矩形」。ArtworkCard はオーラ用に PAD ぶん大きいので、
 *   その分だけ左上に逃がして見かけの矩形を from/to に合わせる。
 *
 * 実機調整ポイント:
 *   - expandMs / breath / revealDelay でテンポを調整。
 *   - 星点火は to の中心から。reach は画面に合わせて調整。
 *
 * 依存: @shopify/react-native-skia, react-native-reanimated
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { ArtworkCard } from './ArtworkCard';
import { StarBurst, StarBurstHandle } from './StarBurst';

export type PurchaseTransitionHandle = {
  /** 演出を最初から再生する */
  start: () => void;
};

/** 見かけのカード矩形（左上座標 x,y と 幅 w）。高さは 2:3 で自動。 */
type Box = { x: number; y: number; w: number };

export type PurchaseTransitionProps = {
  /** 端末（オーバーレイ）の幅/高さ */
  deviceW: number;
  deviceH: number;
  /** 起点（小さい矩形） */
  from: Box;
  /** 着地（拡大後の矩形） */
  to: Box;
  /** 作品画像URL */
  imageUri: string;
  /** 拡大の長さ ms（既定 620） */
  expandMs?: number;
  /** トランスポート(children)が現れるまでの遅延 ms（既定 720） */
  revealDelay?: number;
  /** 下部に差し込むトランスポート等 */
  children?: React.ReactNode;
};

export const PurchaseTransition = forwardRef<
  PurchaseTransitionHandle,
  PurchaseTransitionProps
>(
  (
    {
      deviceW,
      deviceH,
      from,
      to,
      imageUri,
      expandMs = 620,
      revealDelay = 720,
      children,
    },
    ref
  ) => {
    // ArtworkCard が作るオーラ余白。to.w 基準で 1度だけ描くので PAD も to 基準。
    const PAD = Math.round(to.w * 0.6);
    const startScale = from.w / to.w;

    const progress = useSharedValue(0); // 拡大 0→1
    const breath = useSharedValue(0); // 呼吸 0..1（拡大後にループ）
    const reveal = useSharedValue(0); // トランスポート出現 0→1
    const fired = useSharedValue(false);

    const starRef = useRef<StarBurstHandle>(null);

    const igniteStars = () => starRef.current?.trigger();

    useImperativeHandle(
      ref,
      () => ({
        start: () => {
          // リセット
          progress.value = 0;
          breath.value = 0;
          reveal.value = 0;
          fired.value = false;

          // ① 拡大（左上原点で from→to）。完了時に星を点火。
          progress.value = withTiming(
            1,
            { duration: expandMs, easing: Easing.out(Easing.cubic) },
            (finished) => {
              'worklet';
              if (finished && !fired.value) {
                fired.value = true;
                runOnJS(igniteStars)();
              }
            }
          );

          // ② 呼吸（拡大の終わり際から、ゆっくり往復）
          breath.value = withDelay(
            expandMs,
            withRepeat(
              withTiming(1, {
                duration: 1800,
                easing: Easing.inOut(Easing.sin),
              }),
              -1,
              true
            )
          );

          // ③ トランスポートをふわっと出す
          reveal.value = withDelay(
            revealDelay,
            withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) })
          );
        },
      }),
      [progress, breath, reveal, fired, expandMs, revealDelay]
    );

    // カード本体（左上原点で translate + scale）。
    const cardStyle = useAnimatedStyle(() => {
      const p = progress.value;
      const x = from.x + (to.x - from.x) * p;
      const y = from.y + (to.y - from.y) * p;
      const s = startScale + (1 - startScale) * p;
      // 拡大後の微小な呼吸（±1.5%）
      const breathS = 1 + 0.015 * breath.value;
      return {
        transform: [
          { translateX: x - PAD },
          { translateY: y - PAD },
          { scale: s * breathS },
        ],
      };
    });

    // トランスポート（下からふわっと）
    const transportStyle = useAnimatedStyle(() => ({
      opacity: reveal.value,
      transform: [{ translateY: (1 - reveal.value) * 24 }],
    }));

    // 星の起点＝着地カードの中心
    const cardH = to.w * 1.5;
    const originX = to.x + to.w / 2;
    const originY = to.y + cardH / 2;

    return (
      <View
        style={[styles.overlay, { width: deviceW, height: deviceH }]}
        pointerEvents="box-none"
      >
        {/* 拡大するカード（原点=左上） */}
        <Animated.View
          style={[styles.card, { transformOrigin: 'top left' }, cardStyle]}
        >
          <ArtworkCard width={to.w} imageUri={imageUri} hero={{ enabled: true }} />
        </Animated.View>

        {/* 星の一斉点火（拡大完了で trigger） */}
        <StarBurst
          ref={starRef}
          width={deviceW}
          height={deviceH}
          originX={originX}
          originY={originY}
          edgeRadius={to.w / 2}
        />

        {/* トランスポート（差し込み・下部） */}
        {children != null && (
          <Animated.View style={[styles.transport, transportStyle]}>
            {children}
          </Animated.View>
        )}
      </View>
    );
  }
);

PurchaseTransition.displayName = 'PurchaseTransition';

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  card: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  transport: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 130,
  },
});
