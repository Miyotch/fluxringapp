/**
 * PurchaseModal.tsx — 購入確認ポップアップ
 * ------------------------------------------------------------------
 * ホーム（ディスカバー）の「購入する」／コレクションのウィッシュリストの
 * 「購入する」から開く共通の購入確認モーダル。
 *   ・作品サムネ＋曲名＋価格を確認して「購入する / キャンセル」
 *   ・金額と確定ボタンはどちらも同じ購入確定（OS 課金シート起動）へ繋ぐ。
 *     最終確認は OS のシートに委ね、アプリ側で確認を二重に挟まない。
 *
 * 確認モーダルを追加で挟まない理由（金額タップ → 別確認、を作らない理由）:
 *   (a) 最終確認は OS の課金シートが担うため、アプリ側の二重確認は冗長。
 *   (b) App Review Guidelines 3.1.1 は購入導線の明瞭さを求めるが、
 *       確認画面の追加までは要求していない。
 *   (c) 確認を重ねるほど購入が重い決断に見え、「煽らない／静か」という
 *       トンマナに反する。
 *
 * 導線は BuyButton（ホーム/コレクション）→ 本モーダル（確認1枚）→
 * 金額 or 確定ボタン → OS 課金シート、で確定。
 *
 * 表示価格は props の priceLabel（ストア取得の displayPrice）を正とし、
 * 未取得のときだけ呼び出し側が pricing.ts の formatPrice(TRACK_PRICE_JPY) に
 * フォールバックする。2500 は社内の価格定義、displayPrice は実際に課金される額で
 * 役割が違う（審査上も後者の表示が安全）。
 *
 * ■ 本環境で確認できていないこと
 *   実機 GPU での藤色・シアン枠・待機呼吸の見え方、および OS 課金シートの
 *   dismiss 実測時間（PURCHASE.sheetSettleMs は推定値）。EAS 開発ビルド＋
 *   サンドボックスでの確認が必要。
 */

import React, { useEffect } from 'react';
import { View, Text, Image, Pressable, Modal, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLOR, SPACE, ANIM } from '../constants/design-tokens';
import { useT } from '../lib/i18n';

export type PurchaseTarget = {
  id: string;
  title: string;
  /** 金額のみ（例: '¥2,500'）。ボタン全体のラベルではない */
  priceLabel?: string;
  artworkUrl?: string;
};

/** lib/usePurchaseFlow.ts の PurchaseUiState と 1:1 */
export type PurchaseModalState = 'idle' | 'busy' | 'failed' | 'cancelled' | 'pending';
/** lib/iap.ts の PurchaseFailReason と 1:1 */
export type PurchaseModalReason = 'unavailable' | 'not_registered' | 'failed';

type Props = {
  visible: boolean;
  target: PurchaseTarget | null;
  state?: PurchaseModalState;
  reason?: PurchaseModalReason;
  onConfirm: () => void;
  onCancel: () => void;
};

// ── 色（このモーダルだけで閉じる値） ──
const CYAN_RGB = '96,206,224';
const FUJI = '#C9A8D8';            // 失敗の藤色。COLOR.badge #FF3B30 は未読バッジ専用で購入導線では使わない
const CARD_BORDER = `rgba(${CYAN_RGB},0.22)`;
const CARD_BORDER_FAILED = 'rgba(201,168,216,0.26)';
const HAIRLINE = `rgba(${CYAN_RGB},0.30)`;
const HAIRLINE_ON = `rgba(${CYAN_RGB},0.55)`;
const DIM = 'rgba(148,152,190,0.62)'; // LaunchFlow の C.dim と同値
const BUSY_LABEL = 'rgba(236,238,247,0.55)';
const BUSY_CANCEL = 'rgba(148,152,190,0.42)';
const PRICE_SUB = '#8FD4DE';         // BuyButton の price と同色

// 待機呼吸の枠 alpha（idle は auraCyan 実線 = alpha 1）
const BORDER_ALPHA_IDLE = 1;
const BORDER_ALPHA_BUSY_MIN = 0.30;
const BORDER_ALPHA_BUSY_MAX = 0.58;

export const PurchaseModal: React.FC<Props> = ({
  visible,
  target,
  state = 'idle',
  reason,
  onConfirm,
  onCancel,
}) => {
  const t = useT();
  const busy = state === 'busy';
  const failed = state === 'failed';
  // 再試行しても結果が変わらない状態では確定ボタン自体を出さない。
  // not_registered = ストア未登録／審査未通過、pending = 承認待ち（ユーザーに打つ手がない）。
  const hideConfirm = (failed && reason === 'not_registered') || state === 'pending';

  // 枠の呼吸（ActivityIndicator は灰色スピナーがダークトンマナから浮くため使わない）
  const borderAlpha = useSharedValue(BORDER_ALPHA_IDLE);
  // 押下の減光。再レンダーを起こさないよう SharedValue で持つ
  const pressOpacity = useSharedValue(1);

  useEffect(() => {
    if (busy) {
      borderAlpha.value = BORDER_ALPHA_BUSY_MIN;
      borderAlpha.value = withRepeat(
        // 片道 = 周期の半分。ANIM.buyBusyPulseMs = 2400 → 1200ms
        withTiming(BORDER_ALPHA_BUSY_MAX, {
          duration: ANIM.buyBusyPulseMs / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      );
      pressOpacity.value = 1; // busy の 0.42 系と pressed の 0.7 を混ぜない
    } else {
      borderAlpha.value = withTiming(BORDER_ALPHA_IDLE, { duration: 180 });
    }
  }, [busy, borderAlpha, pressOpacity]);

  const confirmAnim = useAnimatedStyle(() => ({
    borderColor: `rgba(${CYAN_RGB},${borderAlpha.value})`,
    opacity: pressOpacity.value,
  }));

  // エラー行の文言と色。失敗3種だけ藤色、cancelled / pending は
  // ユーザー操作の結果・待ち状態であって異常ではないので通常の副文字色。
  let message = '';
  let messageColor: string = COLOR.textSecondary;
  if (failed) {
    messageColor = FUJI;
    message =
      reason === 'unavailable'
        ? t('buy.err.unavailable')
        : reason === 'not_registered'
          ? t('buy.err.notRegistered')
          : t('buy.err.failed');
  } else if (state === 'cancelled') {
    message = t('buy.cancelled');
  } else if (state === 'pending') {
    message = t('buy.pending');
  }

  // 確定ボタンのラベル。失敗（再試行可）は「もう一度試す」に差し替えるが、
  // 枠はシアンのまま——押させるボタンに藤色を乗せると警告に見えて押せなくなる。
  const confirmLabel = busy
    ? t('buy.busy')
    : failed
      ? t('buy.retry')
      : t('buy.label');

  // 閉じる側の文言。エラー／承認待ちでは「キャンセル」ではなく「閉じる」
  const cancelLabel =
    failed || state === 'pending' ? t('common.close') : t('common.cancel');

  const priceLabel = target?.priceLabel ?? '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // 課金シート起動中に Android の戻るでモーダルだけ消えるのを防ぐ
      onRequestClose={busy ? () => {} : onCancel}
    >
      {/* 背景の暗幕（タップでキャンセル。busy 中は無効） */}
      <Pressable style={styles.scrim} onPress={busy ? undefined : onCancel}>
        {/* カード本体（内側タップは伝播させない） */}
        <Pressable
          style={[styles.card, failed && { borderColor: CARD_BORDER_FAILED }]}
          onPress={() => {}}
        >
          {target?.artworkUrl && (
            <Image source={{ uri: target.artworkUrl }} style={styles.art} resizeMode="cover" />
          )}

          <Text style={styles.heading}>{t('buy.heading')}</Text>
          <Text style={styles.title} numberOfLines={1}>{target?.title ?? ''}</Text>

          {/* 金額。確定ボタンと同一の onConfirm を呼ぶ（金額だけ別動線は作らない）。
              タップ可能のシグナルは下線ではなくヘアライン1本——下線は Web リンク的で
              世界観に合わず、文字幅いっぱいに伸びて主張が強すぎる。 */}
          <Pressable
            onPress={onConfirm}
            disabled={busy}
            hitSlop={{ top: 6, bottom: 10, left: 24, right: 24 }}
            accessibilityRole="button"
            accessibilityLabel={t('buy.a11yPrice', { price: priceLabel })}
            style={({ pressed }) => [
              styles.priceHit,
              busy && { opacity: 0.42 },
              !busy && pressed && styles.pricePressed,
            ]}
          >
            {({ pressed }) => (
              <>
                <Text style={styles.price}>{priceLabel}</Text>
                {/* 34px は「¥2,500」の文字幅より短く、下線に見せないための値 */}
                {!busy && (
                  <View
                    style={[styles.hairline, pressed && { backgroundColor: HAIRLINE_ON }]}
                  />
                )}
              </>
            )}
          </Pressable>

          <Text style={styles.note}>{t('buy.note')}</Text>

          {/* エラー行の器。idle でも minHeight を確保して、状態が変わっても
              確定ボタンの縦位置が動かないようにする（動くと画面が跳ねて見える）。 */}
          <View style={styles.errSlot}>
            {!!message && (
              <Text style={[styles.errText, { color: messageColor }]}>{message}</Text>
            )}
          </View>

          {!hideConfirm && (
            <Animated.View
              style={[
                styles.confirmBtn,
                busy && styles.confirmBtnBusy,
                confirmAnim,
              ]}
            >
              <Pressable
                style={styles.confirmHit}
                onPress={onConfirm}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
                // 二重タップ防止は disabled が正。opacity で「押した風」に見せない
                onPressIn={() => { pressOpacity.value = 0.7; }}
                onPressOut={() => { pressOpacity.value = 1; }}
              >
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, busy && { color: BUSY_LABEL }]}>
                    {confirmLabel}
                  </Text>
                  {/* BuyButton の label(13/ls3) + price(11/#8FD4DE) の関係を踏襲。
                      busy と再試行では金額の副 Text を出さない。 */}
                  {!busy && !failed && !!priceLabel && (
                    <Text style={styles.confirmPrice}>{priceLabel}</Text>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          )}

          <Pressable
            style={({ pressed }) => [styles.cancelBtn, !busy && pressed && { opacity: 0.7 }]}
            onPress={onCancel}
            disabled={busy}
          >
            <Text style={[styles.cancelLabel, busy && { color: BUSY_CANCEL }]}>
              {cancelLabel}
            </Text>
          </Pressable>

          {/* 復元導線は案内文のみ（タップ可能にしない）。購入確認の場から他画面へ
              遷移させると購入意図が途切れるため。復元導線が見当たらないことは
              審査の定番指摘なので、文言としては常設する。 */}
          <Text style={styles.restoreHint}>{t('buy.restoreHint')}</Text>
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
    // 340 だと iPhone SE(幅375) で左右 SPACE.xl=32 を引いた 311 に収まらず
    // maxWidth が効かない。全端末で同じ見え方になる 320 にする。
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: '#1B1838',
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.md,
    alignItems: 'center',
    gap: SPACE.xs,
  },
  // 96×144 は CARD.small と一致するので維持
  art: {
    width: 96,
    height: 144,
    borderRadius: 10,
    marginBottom: 12,
  },
  heading: { color: COLOR.textSecondary, fontSize: 12, letterSpacing: 0.5 },
  // 金額(22)との差を保ちつつ、この画面内で fontWeight 700 を1箇所も使わない（静かなトンマナ）
  title: { color: COLOR.textPrimary, fontSize: 17, fontWeight: '600', letterSpacing: 0.8 },

  priceHit: { alignItems: 'center', marginTop: 2 },
  pricePressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  price: {
    color: COLOR.auraCyan,
    fontSize: 22,
    // 太らせず大きさだけで主役にする（煽らない）
    fontWeight: '600',
    // BuyButton の price は 11px/ls1。モーダル内の金額は「読ませる値」なので字間で階層差をつける
    letterSpacing: 1.6,
  },
  hairline: {
    width: 34,
    height: 1,
    borderRadius: 0.5,
    backgroundColor: HAIRLINE,
    marginTop: 5,
    alignSelf: 'center',
    // グロー（shadowRadius）は付けない。BuyButton が発光テキストで主役なので、
    // モーダル内の金額まで光らせると画面内に光源が2つできる。
  },
  note: { color: DIM, fontSize: 10.5, marginBottom: 10 },

  // 値は LaunchFlow.tsx の errText に揃える（11.5 / lineHeight 18 / 中央）
  errSlot: { minHeight: 34, width: '100%', justifyContent: 'center' },
  errText: { fontSize: 11.5, lineHeight: 18, textAlign: 'center', paddingHorizontal: 4 },

  confirmBtn: {
    width: '100%',
    borderRadius: 22, // BuyButton の radius 22 と揃え、同じ「購入」の器であることを形で示す
    borderWidth: 1,
    borderColor: COLOR.auraCyan,
    backgroundColor: `rgba(${CYAN_RGB},0.12)`,
    overflow: 'hidden',
  },
  confirmBtnBusy: { backgroundColor: `rgba(${CYAN_RGB},0.05)` },
  confirmHit: { paddingVertical: 14, alignItems: 'center' },
  confirmRow: { flexDirection: 'row', alignItems: 'center' },
  confirmLabel: { color: COLOR.textPrimary, fontSize: 15, letterSpacing: 1 },
  confirmPrice: { color: PRICE_SUB, fontSize: 12.5, letterSpacing: 1, marginLeft: 8 },

  cancelBtn: { width: '100%', paddingVertical: 11, alignItems: 'center' },
  cancelLabel: { color: COLOR.textSecondary, fontSize: 12.5, letterSpacing: 0.8 },

  restoreHint: {
    fontSize: 10.5,
    lineHeight: 16,
    color: DIM,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 8,
  },
});

export default PurchaseModal;
