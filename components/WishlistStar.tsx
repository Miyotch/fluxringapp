/**
 * WishlistStar.tsx — ウィッシュリスト星（component_catalog v50 確定）
 * ------------------------------------------------------------------
 * 44×44px タップ領域・アイコン19×19px。
 *   未追加: 線画（シアン枠）
 *   追加済: 塗り（シアン）
 *   所有済みでは非表示（呼び出し側で owned のとき描画しない）。
 */

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { StarIcon } from './icons';

type Props = {
  inWishlist: boolean;
  onToggle: () => void;
};

export const WishlistStar: React.FC<Props> = ({ inWishlist, onToggle }) => (
  <Pressable
    onPress={onToggle}
    hitSlop={6}
    accessibilityRole="button"
    accessibilityLabel={inWishlist ? 'ウィッシュリストから削除' : 'ウィッシュリストに追加'}
    style={styles.tap}
  >
    <StarIcon size={19} filled={inWishlist} />
  </Pressable>
);

const styles = StyleSheet.create({
  tap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

export default WishlistStar;
