/**
 * BuyButton.tsx — 購入ボタン
 * ------------------------------------------------------------------
 *   未所有: シアンの塗りピル＋濃色の「購入する ¥2,500」。
 *          コレクションの作品詳細（CollectionScreen の workBtn/workBtnSolid）と
 *          同じ寸法・字組にして、ホームと作品詳細で購入ボタンの見た目を揃える。
 *   所有済: 再生マーク（枠・塗りなし）＝従来どおり「再生」表現。
 */

import React from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { PlayMark } from './icons';
import { formatPrice, TRACK_PRICE_JPY } from '../constants/pricing';
import { useT } from '../lib/i18n';

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
      style={({ pressed }) => [
        owned ? styles.playBtn : styles.btn,
        pressed && { opacity: 0.85 },
      ]}
    >
      {owned ? (
        <PlayMark size={24} />
      ) : (
        <Text style={styles.label} numberOfLines={1}>{`${t('buy.label')} ${price}`}</Text>
      )}
    </Pressable>
  );
};

const CYAN = '#60CEE0';

const styles = StyleSheet.create({
  // 未所有: 塗りのピル（CollectionScreen の workBtn + workBtnSolid と同値）
  btn: {
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CYAN,
    backgroundColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 10.5, letterSpacing: 1.26, color: '#06121a' },
  // 所有済み: 枠・塗りなしで再生マークだけを置く（従来の見た目のまま）
  playBtn: {
    width: 176,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
});

export default BuyButton;
