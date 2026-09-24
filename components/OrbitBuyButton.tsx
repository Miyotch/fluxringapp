/**
 * OrbitBuyButton.tsx — HOME の購入ボタン「周回する光」
 * ------------------------------------------------------------------
 * 参照: 岡さんの試作 fr_home_fav_orbitstar_v3.html（2026-09-24 の打ち合わせで採用）の
 *       `.orbit`。
 *
 *   未所有: 濃紺のピルの縁を、明るい弧が 6 秒で 1 周する。左に「購入する」、右に価格。
 *   所有済: 「再生」だけ。光は回さず、縁を少し明るくする（試作の `.owned`）。
 *
 * 縁の光は、弧を一度だけ描いた正方形（Skia の SweepGradient）を、ピルの後ろで
 * **ネイティブの回転**で回して作る。試作は CSS の conic-gradient を回しているが、
 * Skia で角度を毎フレーム描き直すと全画面ではなくても毎秒 60 回の描き直しになる。
 * 絵は固定のまま View ごと回せば描き直しは 0 回で、ホームの発熱対策
 * （2026-09-23）と矛盾しない。回転は RN の Animated を native driver で
 * 回しているので、JS も UI スレッドの worklet も毎フレームは動かない。
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  AccessibilityInfo,
} from 'react-native';
import { Canvas, Rect, SweepGradient, vec } from '@shopify/react-native-skia';
import { formatPrice, TRACK_PRICE_JPY } from '../constants/pricing';
import { NUM_FONT } from '../constants/fonts';
import { useT } from '../lib/i18n';

const W = 236;
const H = 52;
/** 回す正方形の一辺。ピルの対角線（約 241）より大きくして、どの角度でも縁を覆う */
const SQ = 300;
/** 1 周の時間（試作どおり） */
const ORBIT_MS = 6000;

const CYAN = '#60CEE0';
const INK = '#ECEEF7';

type Props = {
  owned?: boolean;
  priceJpy?: number;
  /** ストア取得のローカライズ表示価格。未取得のときだけ priceJpy から作る */
  priceLabel?: string;
  onPress: () => void;
};

/** 弧の絵（試作の conic-gradient: 透明 0〜78% → 淡いシアン 86% → 白く 92% → 透明 96%） */
const OrbitArc: React.FC = React.memo(() => (
  <Canvas style={styles.arcCanvas} pointerEvents="none">
    <Rect x={0} y={0} width={SQ} height={SQ}>
      <SweepGradient
        c={vec(SQ / 2, SQ / 2)}
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
  </Canvas>
));

export const OrbitBuyButton: React.FC<Props> = ({
  owned = false,
  priceJpy = TRACK_PRICE_JPY,
  priceLabel,
  onPress,
}) => {
  const t = useT();
  const price = priceLabel ?? formatPrice(priceJpy);
  const spin = useRef(new Animated.Value(0)).current;

  // 未所有のときだけ回す。視差を減らす設定では止める
  useEffect(() => {
    if (owned) return;
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (cancelled || reduced) return;
        spin.setValue(0);
        loop = Animated.loop(
          Animated.timing(spin, {
            toValue: 1,
            duration: ORBIT_MS,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        );
        loop.start();
      });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [owned, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={owned ? t('buy.play') : t('buy.a11yPrice', { price })}
      style={({ pressed }) => [
        styles.pill,
        owned && styles.pillOwned,
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      {!owned && (
        <Animated.View style={[styles.arcWrap, { transform: [{ rotate }] }]} pointerEvents="none">
          <OrbitArc />
        </Animated.View>
      )}
      <View style={styles.inner}>
        <View style={styles.sheen} pointerEvents="none" />
        <Text style={styles.label} numberOfLines={1}>
          {owned ? t('buy.play') : t('buy.label')}
        </Text>
        {!owned && (
          <Text style={styles.price} numberOfLines={1}>
            {price}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // 試作 .orbit: 外形 236×52・角丸 26・内側 1px が縁になる
  pill: {
    width: W,
    height: H,
    borderRadius: H / 2,
    overflow: 'hidden',
    padding: 1,
    backgroundColor: 'rgba(96,206,224,0.18)',
  },
  pillOwned: { backgroundColor: 'rgba(96,206,224,0.45)' },
  arcWrap: {
    position: 'absolute',
    left: (W - SQ) / 2,
    top: (H - SQ) / 2,
    width: SQ,
    height: SQ,
  },
  arcCanvas: { width: SQ, height: SQ },
  // 試作 .orbit>span: 濃紺（#141634）に上から薄い光・下へ薄い影
  inner: {
    flex: 1,
    borderRadius: H / 2 - 1,
    backgroundColor: '#141634',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: (H - 2) / 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  // 試作 .l: 12px・字間 .28em・細字
  label: { fontSize: 12, letterSpacing: 3.4, fontWeight: '300', color: INK },
  // 試作 .p: 細いセリフ体 21px・シアン（Spectral の代わりに同梱の EB Garamond）
  price: { fontFamily: NUM_FONT, fontSize: 21, letterSpacing: 1.2, color: CYAN },
});

export default OrbitBuyButton;
