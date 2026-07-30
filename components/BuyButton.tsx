/**
 * BuyButton.tsx — 購入ボタン（component_catalog v50 確定）
 * ------------------------------------------------------------------
 * 128×44px, radius 22, 枠・塗り・背景の角丸矩形なし・**発光テキストのみ**。
 *   未所有: 「購入する ¥2,500」（¥は小さくシアン #8FD4DE・グローなし）
 *          「購入する」は芯の不透明度を落として輪郭を少しぼかす（textShadowで代用）
 *   所有済: 再生マーク（PLAY_HTML）＝「再生」表現に統一
 *   押下時: scale(.97)・グロー強度アップ
 *
 * RN の Text は textShadow を1層しか持てないため、シアングローは
 * textShadow（芯の輪郭をぼかす）のみで表現する。
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { PlayMark } from './icons';
import { formatPrice, TRACK_PRICE_JPY } from '../constants/pricing';
import { useT } from '../lib/i18n';
import { NUM_FONT } from '../constants/fonts';

type Props = {
  owned?: boolean;
  priceJpy?: number;
  /**
   * ストア取得のローカライズ表示価格（displayPrice）。未取得のときだけ
   * priceJpy から formatPrice() で作る。日本以外のストアフロントで
   * モーダルの金額とここの金額が食い違わないようにするため。
   */
  priceLabel?: string;
  onPress: () => void;
};

export const BuyButton: React.FC<Props> = ({
  owned = false,
  priceJpy = TRACK_PRICE_JPY,
  priceLabel,
  onPress,
}) => {
  const t = useT();
  const price = priceLabel ?? formatPrice(priceJpy);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={owned ? t('buy.play') : `${t('buy.label')} ${price}`}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      {owned ? (
        <PlayMark size={19} />
      ) : (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{t('buy.label')}</Text>
          <Text style={styles.price}>{price}</Text>
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
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: {
    // 芯を半透明にして輪郭を隠し、textShadow（同形状のぼかし）だけを見せることで
    // 「少しぼやけた」見え方にする。芯を不透明のままにすると輪郭が固く残ってしまう。
    color: 'rgba(244,254,255,0.55)',
    fontSize: 13,
    letterSpacing: 3, // .2em 相当
    textShadowColor: 'rgba(96,206,224,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4, // 実機調整ポイント: 大きいほどぼやける
  },
  price: {
    color: '#8FD4DE',
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: NUM_FONT, // 価格＝数字表記
    marginLeft: 6, // .buy small { margin-left:6px }（.buy の gap:7px に加算）
    // グローなし
  },
});

export default BuyButton;
