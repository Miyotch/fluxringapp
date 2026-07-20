/**
 * PurchaseModal.tsx — 購入確認ポップアップ
 * ------------------------------------------------------------------
 * ホーム（ディスカバー）の「購入する」／コレクションのウィッシュリストの
 * 「購入する」から開く共通の購入確認モーダル。
 *   ・作品サムネ＋曲名＋価格を確認して「購入する / キャンセル」
 *   ・審査対応: 金額タップ購入ではなく、明示ボタンから確定する導線
 *   ・実決済（StoreKit / Billing）への接続はここで onConfirm に差し替える
 */

import React from 'react';
import { View, Text, Image, Pressable, Modal, StyleSheet } from 'react-native';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';

export type PurchaseTarget = {
  id: string;
  title: string;
  priceLabel?: string;
  artworkUrl?: string;
};

type Props = {
  visible: boolean;
  target: PurchaseTarget | null;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const PurchaseModal: React.FC<Props> = ({ visible, target, busy = false, onConfirm, onCancel }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {/* 背景の暗幕（タップでキャンセル） */}
      <Pressable style={styles.scrim} onPress={onCancel}>
        {/* カード本体（内側タップは伝播させない） */}
        <Pressable style={styles.card} onPress={() => {}}>
          {target?.artworkUrl && (
            <Image source={{ uri: target.artworkUrl }} style={styles.art} resizeMode="cover" />
          )}

          <Text style={styles.heading}>この作品を購入しますか？</Text>
          <Text style={styles.title} numberOfLines={1}>{target?.title ?? ''}</Text>
          <Text style={styles.price}>{target?.priceLabel ?? '¥2,500'}</Text>
          <Text style={styles.note}>買い切り・追加課金はありません</Text>

          <Pressable
            style={({ pressed }) => [styles.confirmBtn, (pressed || busy) && { opacity: 0.7 }]}
            onPress={onConfirm}
            disabled={busy}
          >
            <Text style={styles.confirmLabel}>{busy ? '処理中…' : '購入する'}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
            onPress={onCancel}
            disabled={busy}
          >
            <Text style={styles.cancelLabel}>キャンセル</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(8,7,20,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.22)',
    backgroundColor: '#1B1838',
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.md,
    alignItems: 'center',
    gap: SPACE.xs,
  },
  art: {
    width: 96,
    height: 144,
    borderRadius: 10,
    marginBottom: SPACE.sm,
  },
  heading: { color: COLOR.textSecondary, fontSize: 12, letterSpacing: 0.5 },
  title: { color: COLOR.textPrimary, fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
  price: { color: COLOR.auraCyan, fontSize: 22, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  note: { color: COLOR.textSecondary, fontSize: 11, marginBottom: SPACE.sm },
  confirmBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.auraCyan,
    backgroundColor: 'rgba(96,206,224,0.12)',
    alignItems: 'center',
  },
  confirmLabel: { color: COLOR.textPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  cancelBtn: { width: '100%', paddingVertical: 12, alignItems: 'center' },
  cancelLabel: { color: COLOR.textSecondary, fontSize: 13, letterSpacing: 0.5 },
});

export default PurchaseModal;
