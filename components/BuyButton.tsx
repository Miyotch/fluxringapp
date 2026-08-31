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
import { NUM_FONT, JP_SERIF_FONT } from '../constants/fonts';

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
      style={styles.btn}
    >
      {({ pressed }) =>
        owned ? (
          <PlayMark size={24} />
        ) : (
          <View style={styles.labelRow}>
            <Text style={[styles.label, pressed && styles.labelPressed]}>{t('buy.label')}</Text>
            <Text style={[styles.price, pressed && styles.pricePressed]}>{price}</Text>
          </View>
        )
      }
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    // モック比で小さすぎたため拡大（128×44 → 176×56）
    width: 176,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
    // 枠・塗りなし
  },
  // 押下時に文字が縮む挙動は不要（発光だけを強める）
  pressed: {},
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: {
    // 芯を半透明にして輪郭を隠し、textShadow（同形状のぼかし）だけを見せることで
    // 「文字自体が光る」見え方にする。芯を不透明のままにすると輪郭が固く残ってしまう。
    color: 'rgba(244,254,255,0.62)',
    fontSize: 18,
    letterSpacing: 3.2, // .2em（tonmana_typography_reference .buy 準拠）
    fontFamily: JP_SERIF_FONT, // 和文＝明朝（ゴシックで出ていたのを修正）
    textShadowColor: 'rgba(96,206,224,1)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 11, // 実機調整ポイント: 大きいほどぼやける（文字の後ろを少しだけぼかす指定で9→11）
  },
  // 押下時は芯を明るく・グローを強めて「押した」ことを伝える
  labelPressed: {
    color: 'rgba(250,255,255,0.95)',
    textShadowRadius: 16,
  },
  price: {
    color: '#8FD4DE',
    fontSize: 13,
    letterSpacing: 1.2,
    fontFamily: NUM_FONT, // 価格＝数字表記
    marginLeft: 7, // .buy small { margin-left:6px }（.buy の gap に加算）
    textShadowColor: 'rgba(96,206,224,0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  pricePressed: { textShadowRadius: 10 },
});

export default BuyButton;
