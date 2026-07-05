/**
 * BuyButton.tsx — 購入ボタン（component_catalog v50 確定）
 * ------------------------------------------------------------------
 * 128×44px, radius 22, 枠・塗りなし・**発光テキストのみ**。
 *   未所有: 「購入する ¥2,500」（¥は小さくシアン #8FD4DE・グローなし）
 *   所有済: 再生マーク（PLAY_HTML）＝「再生」表現に統一
 *   押下時: scale(.97)・グロー強度アップ
 *
 * RN の Text は textShadow を1層しか持てないため、3層シアングローは
 * textShadow（芯）＋ 背後の薄いシアン発光 View で近似する。
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { PlayMark } from './icons';
import { formatPrice, TRACK_PRICE_JPY } from '../constants/pricing';

type Props = {
  owned?: boolean;
  priceJpy?: number;
  onPress: () => void;
};

export const BuyButton: React.FC<Props> = ({ owned = false, priceJpy = TRACK_PRICE_JPY, onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={owned ? '再生' : `購入する ${formatPrice(priceJpy)}`}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      {/* 背後の薄いシアン発光（3層グローの近似） */}
      <View style={styles.glow} pointerEvents="none" />

      {owned ? (
        <PlayMark size={19} />
      ) : (
        <View style={styles.labelRow}>
          <Text style={styles.label}>購入する</Text>
          <Text style={styles.price}>{formatPrice(priceJpy)}</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    width: 128,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    // 枠・塗りなし
  },
  pressed: { transform: [{ scale: 0.97 }] },
  glow: {
    position: 'absolute',
    width: 108,
    height: 30,
    borderRadius: 22,
    backgroundColor: 'rgba(96,206,224,0.10)',
    // シアンの淡い暈
    shadowColor: '#60CEE0',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: {
    color: '#F4FEFF',
    fontSize: 13,
    letterSpacing: 3, // .2em 相当
    // 発光テキスト（芯）
    textShadowColor: 'rgba(96,206,224,1)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  price: {
    color: '#8FD4DE',
    fontSize: 11,
    letterSpacing: 1,
    // グローなし
  },
});

export default BuyButton;
