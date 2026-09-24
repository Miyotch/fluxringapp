/**
 * Footer.tsx — FLUX RING 共通フッター（5タブ）
 * ------------------------------------------------------------------
 * ワイヤーフレーム: ホーム / コレ / VIP / メディア / 設定
 *   ・4タブ（ホーム/プレイリスト/メディア/設定）はいつでも相互遷移（プレイリストは 2026-09-24 にコレクションから改称。キーは collection のまま）
 *   ・VIP はシアン強調＋ロックマーク（未成約時）
 *   ・プレイヤー / ストーリー / 購入完了画面では非表示（呼び出し側で出し分け）
 *
 * 縦スワイプ中のフェード（退場160ms / 復帰500ms）は呼び出し側で
 * opacity を制御する想定。本コンポーネントは静的なタブ行のみ。
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Animated, Easing } from 'react-native';
import { COLOR } from '../constants/design-tokens';
import { useT } from '../lib/i18n';
import { useBottomInset } from '../lib/safeArea';
import {
  TabHomeIcon,
  TabCollectionIcon,
  TabMediaIcon,
  TabSettingsIcon,
  LockIcon,
} from './icons';
import { TabTopIndicator } from './TabGlow';

export type TabKey = 'home' | 'collection' | 'vip' | 'media' | 'settings';

type TabIcon = React.FC<{ size?: number; color?: string }>;
type TabDef = { key: TabKey; labelKey: string; Icon?: TabIcon; glyph?: string };

// アイコンは assets/icons/tab_*.svg を icons.tsx へ移植したもの。
// VIP は未成約時、他タブと同じ大きさの南京錠1つに差し替える（重ねバッジは廃止）。
// 成約後（vipLocked=false）は従来どおりグリフ（✦）のまま。
const TABS: TabDef[] = [
  { key: 'home',       labelKey: 'tab.home',       Icon: TabHomeIcon },
  { key: 'collection', labelKey: 'tab.collection', Icon: TabCollectionIcon },
  { key: 'vip',        labelKey: 'tab.vip',        glyph: '✦' },
  { key: 'media',      labelKey: 'tab.media',      Icon: TabMediaIcon },
  { key: 'settings',   labelKey: 'tab.settings',   Icon: TabSettingsIcon },
];

type FooterProps = {
  active: TabKey;
  onChange: (key: TabKey) => void;
  /** VIP が未成約のときロックマークを重ねる */
  vipLocked?: boolean;
  /**
   * 下地と境界線を外して、背後の画面をそのまま透かす。
   * ホームでだけ true にして、星空がフッターの裏まで続いて見えるようにする
   * （呼び出し側はこのときフッターを絶対配置で画面へかぶせること）。
   */
  transparent?: boolean;
  /** メディア（あなた宛）に未読のお知らせがあるとき、タブの右上へ赤バッジを出す */
  mediaUnread?: boolean;
  /**
   * 数が増えるたびに、プレイリスト（collection）タブの絵を一度脈打たせる。
   * HOME のカードの★でウィッシュリストに入れ、光の粒がこのタブに着いた合図
   * （2026-09-24 岡さんの試作 `.nav .col.pulse`）。
   */
  pulseKey?: number;
};

export const Footer: React.FC<FooterProps> = ({
  active,
  onChange,
  vipLocked = true,
  transparent = false,
  mediaUnread = false,
  pulseKey = 0,
}) => {
  const t = useT();
  // プレイリストタブの脈打ち（試作: .6s で 1.25 倍 → 戻す）
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulseKey) return;
    pulse.setValue(1);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.25, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 360, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [pulseKey, pulse]);
  // ホームインジケータ（34pt）を避ける。従来の固定値を下回らないようにする。
  const padBottom = useBottomInset(Platform.OS === 'ios' ? 20 : 12);
  return (
    <View style={[styles.bar, transparent && styles.barTransparent, { paddingBottom: padBottom }]}>
      {/* タブ上端の金インジケータ（v99 fr_v99_tsubasa .tb.on::before 相当）。
          各タブ Pressable は bar 内で縦中央寄せ（高さがコンテンツ依存）のため、
          インジケータはタブの内側ではなく bar 直下の専用オーバーレイ行に、
          タブと同じ 5 分割（flex:1 ×5・paddingHorizontal 8）で重ねる。
          こうすることで、タブの内容量に関係なく必ず bar の最上端に揃う。 */}
      <View style={styles.indicatorRow} pointerEvents="none">
        {TABS.map((tab) => (
          <View key={tab.key} style={styles.indicatorSlot}>
            <TabTopIndicator active={tab.key === active} />
          </View>
        ))}
      </View>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const isVip = tab.key === 'vip';
        // .tb: OFF #9498BE / ON・VIP #60CEE0（星雲の縁取りと同じシアン、常時）。
        const tint = isActive || isVip ? COLOR.auraCyan : COLOR.textSecondary;

        // アイコンの発光（.tb.on svg drop-shadow 相当）。RN の View shadow は
        // アルファ形状に沿う影を落とすため、SVG の細線にも馴染む。
        // iOS のみ有効（Android の View shadow は色付き指定に対応しない）。
        const iconGlowStyle =
          isActive && !isVip && Platform.OS === 'ios'
            ? {
                shadowColor: COLOR.auraCyan,
                shadowOpacity: 0.45,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              }
            : null;

        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onChange(tab.key)}
            hitSlop={8}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t(tab.labelKey)}
          >
            <Animated.View
              style={[
                styles.glyphWrap,
                iconGlowStyle,
                tab.key === 'collection' && { transform: [{ scale: pulse }] },
              ]}
            >
              {tab.Icon ? (
                <tab.Icon size={20} color={tint} />
              ) : isVip && vipLocked ? (
                <LockIcon size={20} color={tint} />
              ) : (
                <Text style={[styles.glyph, { color: tint }]}>{tab.glyph}</Text>
              )}
              {/* 未読のお知らせがあるあいだだけ出す赤バッジ。メディア画面の
                  「あなた宛」タブが持つ未読ドット（NotificationsScreen 由来）と
                  同じ COLOR.badge。既読になれば消える。 */}
              {tab.key === 'media' && mediaUnread && <View style={styles.unreadBadge} />}
            </Animated.View>
            <Text
              style={[styles.label, { color: tint }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
    // paddingBottom は SafeArea の bottom を JSX 側で上書き
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLOR.border,
    backgroundColor: 'rgba(23,20,48,0.92)',
  },
  // 透明フッター（ホーム）。下地も境界線も消して、背後の空をそのまま出す
  barTransparent: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
  // bar の最上端（paddingTop の外側）に重ねる、タブと同じ5分割のオーバーレイ行。
  indicatorRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  indicatorSlot: {
    flex: 1,
    alignItems: 'center',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    flex: 1,
  },
  glyphWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glyph: {
    fontSize: 18,
    lineHeight: 20,
  },
  // 未読バッジ（メディアタブ右上の赤丸）。数字は出さない（NotificationsScreen の
  // 未読ドットと同じ、あるかないかだけを伝える控えめな表現）。
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLOR.badge,
  },
  // .tb: 9px / weight 500 / letter-spacing .12em
  label: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.08,
  },
});

export default Footer;
