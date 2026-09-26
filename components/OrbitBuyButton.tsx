/**
 * OrbitBuyButton.tsx — 購入ボタン／再生ボタン「周回する光」（仕様 v2）
 * ------------------------------------------------------------------
 * 参照: FR_購入ボタン_G周回する光_spec_v2.md（2026-09-25 株式会社ヌメロ.8）と
 *       fr_home_buy_play_common_v2.html。v1（236×52・不透明・価格つき）を置き換える。
 *
 *   ・購入ボタンと再生ボタンは同じ部品。形・大きさ・ガラスの背景・周回する光は共通で、
 *     中身だけが変わる。未購入は「購入する」（価格は出さない）、所有済みは ▶ だけ
 *   ・152×40・角丸 20。タップ領域は上下 2pt ずつ広げて高さ 44
 *   ・縁 1pt の上だけを、光の弧が 6 秒で 1 周する（Skia で縁の形に切り抜いて描く）
 *   ・購入→所有は、「購入する」がフェードアウトして ▶ がフェードイン（450ms）
 *   ・購入処理中・商品情報が取れないときは、不透明度 0.55 で押せない（state で渡す）。
 *     ただし今の購入の流れは、商品情報が取れなかったあとに購入ボタンを押すと取り直す
 *     作り（usePurchaseFlow の start）なので、呼び出し側は「取れない」を渡していない。
 *     押せなくすると、起動時に一度失敗しただけで買えないままになるため
 *   ・視差効果を減らす設定では、光を右上（−45°）で止め、押下の縮みも切り替えの
 *     フェードも出さない
 *
 * ガラスの背景について: 仕様はぼかし（BlurView）だが、ぼかしの部品を入れると
 * ネイティブの作り直しが要り、Android では既定でぼかしが効かない。ホームの発熱対策
 * （2026-09-23）もあるので、まずは仕様の Web 参照実装と同じ色（rgba(14,14,40,.55)
 * ＋上から下への白の光沢）で描く。背景の星と魔法陣は、ぼかさずに透けて見える。
 *
 * 光を止める: active（UI スレッドの値。1=回す）を渡すと、0 の間は止まり、1 に
 * 戻ると止まった角度から続きを回す。ホームではカードが動いている間・裏返している
 * 間に止める（仕様 §7）。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import {
  Canvas,
  FillType,
  Group,
  LinearGradient,
  Path,
  Rect,
  RoundedRect,
  Skia,
  SweepGradient,
  rect,
  rrect,
  vec,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { formatPrice, TRACK_PRICE_JPY } from '../constants/pricing';
import { useT } from '../lib/i18n';

const W = 152;
const H = 40;
const R = 20;
/** 回す弧の正方形の一辺。ボタンの対角線（約 157）より大きくして、どの角度でも縁を覆う */
const SQ = 200;
/** 1 周の時間（魔法陣の呼吸 3 秒 × 2） */
const ORBIT_MS = 6000;
/** 購入→所有の切り替え */
const SWAP_MS = 450;
/**
 * Skia の弧は 3 時の方向から時計回りに始まる。仕様の Web 参照（conic-gradient は
 * 12 時から）と同じ位置から回り始めるよう、−90° ずらす
 */
const BASE_ANGLE = -Math.PI / 2;
/** 視差効果を減らす設定で止める角度（仕様: 右上 −45° ＝ Web の rotate(45deg)） */
const REDUCED_ANGLE = BASE_ANGLE + Math.PI / 4;

const CYAN = '#60CEE0';
const INK = '#ECEEF7';

export type OrbitButtonState = 'idle' | 'pending' | 'unavailable';

type Props = {
  owned?: boolean;
  priceJpy?: number;
  /** ストア取得のローカライズ表示価格。読み上げにだけ使う（ボタンには出さない） */
  priceLabel?: string;
  /** pending=購入シート表示中・決済処理中 / unavailable=商品情報が取れない。どちらも押せない */
  state?: OrbitButtonState;
  /** 1=光を回す / 0=止める（UI スレッドの値）。未指定なら常に回す */
  active?: SharedValue<number> | DerivedValue<number>;
  onPress: () => void;
};

// 縁のリング（外側の角丸から 1pt 内側を抜いた形）。形は固定なので一度だけ作る
const OUTER = rrect(rect(0, 0, W, H), R, R);
const INNER = rrect(rect(1, 1, W - 2, H - 2), R - 1, R - 1);
const RING = (() => {
  const p = Skia.Path.Make();
  p.addRRect(OUTER);
  p.addRRect(INNER);
  p.setFillType(FillType.EvenOdd);
  return p;
})();

/** ▶（16pt 角・視覚中心を右へ補正） */
const PlayGlyph: React.FC = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" style={{ marginLeft: 2 }}>
    <SvgPath d="M8 5.5v13l11-6.5z" fill={CYAN} />
  </Svg>
);

export const OrbitBuyButton: React.FC<Props> = ({
  owned = false,
  priceJpy = TRACK_PRICE_JPY,
  priceLabel,
  state = 'idle',
  active,
  onPress,
}) => {
  const t = useT();
  const price = priceLabel ?? formatPrice(priceJpy);
  const disabled = state !== 'idle';

  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduced(v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // ── 周回する光（UI スレッドで角度を進める。止まった角度から続きを回す） ──
  const angle = useSharedValue(BASE_ANGLE);
  const reducedSV = useSharedValue(0);
  useEffect(() => {
    reducedSV.value = reduced ? 1 : 0;
  }, [reduced, reducedSV]);
  useFrameCallback((f) => {
    'worklet';
    if (reducedSV.value > 0.5) {
      angle.value = REDUCED_ANGLE;
      return;
    }
    if (active && active.value < 0.5) return;
    const dt = f.timeSincePreviousFrame ?? 16;
    angle.value = (angle.value + (dt / ORBIT_MS) * 2 * Math.PI) % (2 * Math.PI);
  });
  const orbitTransform = useDerivedValue(() => [{ rotate: angle.value }]);

  // ── 購入→所有の切り替え（「購入する」がフェードアウトし、▶ がフェードイン） ──
  const swap = useRef(new Animated.Value(owned ? 1 : 0)).current;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reduced) {
      swap.setValue(owned ? 1 : 0);
      return;
    }
    Animated.timing(swap, {
      toValue: owned ? 1 : 0,
      duration: SWAP_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [owned, reduced, swap]);
  const labelOpacity = swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  // ── 押下（0.97 倍・150ms） ──
  const press = useRef(new Animated.Value(1)).current;
  const pressTo = (v: number) => {
    if (reduced) return;
    Animated.timing(press, { toValue: v, duration: 150, useNativeDriver: true }).start();
  };

  const canvas = useMemo(
    () => (
      <Canvas style={styles.canvas} pointerEvents="none">
        {/* ガラスの色味と光沢（上から下へ白を薄く） */}
        <RoundedRect rect={OUTER} color="rgba(14,14,40,0.55)" />
        <RoundedRect rect={OUTER}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, H)}
            colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)']}
          />
        </RoundedRect>
        {/* 縁の下地（購入・再生とも同じ） */}
        <Path path={RING} color="rgba(96,206,224,0.18)" />
        {/* 縁の上だけを走る光 */}
        <Group clip={RING}>
          <Group transform={orbitTransform} origin={vec(W / 2, H / 2)}>
            <Rect x={W / 2 - SQ / 2} y={H / 2 - SQ / 2} width={SQ} height={SQ}>
              <SweepGradient
                c={vec(W / 2, H / 2)}
                colors={[
                  'rgba(96,206,224,0)',
                  'rgba(96,206,224,0)',
                  'rgba(96,206,224,0.2)',
                  '#BFF4FB',
                  'rgba(96,206,224,0)',
                  'rgba(96,206,224,0)',
                ]}
                positions={[0, 0.78, 0.86, 0.92, 0.96, 1]}
              />
            </Rect>
          </Group>
        </Group>
      </Canvas>
    ),
    [orbitTransform],
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => pressTo(0.97)}
      onPressOut={() => pressTo(1)}
      disabled={disabled}
      hitSlop={{ top: 2, bottom: 2 }}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: state === 'pending' }}
      accessibilityLabel={owned ? t('buy.play') : t('buy.a11yPrice', { price })}
    >
      <Animated.View
        style={[styles.pill, disabled && styles.dim, { transform: [{ scale: press }] }]}
      >
        {canvas}
        <Animated.View style={[styles.center, { opacity: labelOpacity }]} pointerEvents="none">
          <Text style={styles.label} numberOfLines={1}>
            {t('buy.label')}
          </Text>
        </Animated.View>
        <Animated.View style={[styles.center, { opacity: swap }]} pointerEvents="none">
          <PlayGlyph />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pill: { width: W, height: H, borderRadius: R, overflow: 'hidden' },
  dim: { opacity: 0.55 },
  canvas: { position: 'absolute', left: 0, top: 0, width: W, height: H },
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 11pt・細字・字間 0.28em。末尾の字間ぶん左にも同じ余白を置いて中央に見せる
  label: {
    fontSize: 11,
    fontWeight: '300',
    letterSpacing: 3.08,
    paddingLeft: 3.08,
    color: INK,
  },
});

export default OrbitBuyButton;
