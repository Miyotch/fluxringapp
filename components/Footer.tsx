/**
 * Footer.tsx — FLUX RING 共通フッター（4タブ）
 * ------------------------------------------------------------------
 * ホーム / プレイリスト / メディア / 設定（2026-10-14 VIP をフッターから外した）。
 * 型の 'vip' と VipScreen は残してあるので、戻すときは TABS に 1 行足すだけ。
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

export type TabKey = 'home' | 'collection' | 'vip' | 'media' | 'settings';

type TabIcon = React.FC<{ size?: number; color?: string }>;
type TabDef = { key: TabKey; labelKey: string; Icon?: TabIcon; glyph?: string };

// アイコンは assets/icons/tab_*.svg を icons.tsx へ移植したもの。
// VIP は未成約時、他タブと同じ大きさの南京錠1つに差し替える（重ねバッジは廃止）。
// 成約後（vipLocked=false）は従来どおりグリフ（✦）のまま。
const TABS: TabDef[] = [
  { key: 'home',       labelKey: 'tab.home',       Icon: TabHomeIcon },
  { key: 'collection', labelKey: 'tab.collection', Icon: TabCollectionIcon },
  { key: 'media',      labelKey: 'tab.media',      Icon: TabMediaIcon },
  { key: 'settings',   labelKey: 'tab.settings',   Icon: TabSettingsIcon },
];

// タップの余白。iPhone は画面の端（ベゼル／ホームインジケータ）ぎりぎりまで
// 反応して意図せず触れてしまうため、下と左右の余白をなくし上だけ残す。
// Android は従来どおり全方向 8。
const TAB_HIT_SLOP =
  Platform.OS === 'ios'
    ? { top: 6, bottom: 0, left: 0, right: 0 }
    : { top: 8, bottom: 8, left: 8, right: 8 };

type FooterProps = {
  active: TabKey;
  onChange: (key: TabKey) => void;
  /** VIP が未成約のときロックマークを重ねる */
  vipLocked?: boolean;
  /**
   * 薄い下地と境界線にして、背後の星空を透かす。
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
      Animated.timing(pulse, { toValue: 1.10, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 360, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [pulseKey, pulse]);
  // ホームインジケータ（34pt）を避ける。従来の固定値を下回らないようにする。
  const padBottom = useBottomInset(Platform.OS === 'ios' ? 20 : 12);
  return (
    <View style={[styles.bar, transparent && styles.barTransparent, { paddingBottom: padBottom }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const isVip = tab.key === 'vip';
        // A restrained lavender selection; the artwork remains the brightest element.
        const tint = isActive || isVip ? '#BF94FF' : '#85849B';

        // アイコンの発光（.tb.on svg drop-shadow 相当）。RN の View shadow は
        // アルファ形状に沿う影を落とすため、SVG の細線にも馴染む。
        // iOS のみ有効（Android の View shadow は色付き指定に対応しない）。
        const iconGlowStyle =
          isActive && !isVip && Platform.OS === 'ios'
            ? {
                shadowColor: tint,
                shadowOpacity: 0.18,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 0 },
              }
            : null;

        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onChange(tab.key)}
            hitSlop={TAB_HIT_SLOP}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t(tab.labelKey)}
          >
            <Animated.View
              style={[
                styles.glyphWrap,
                isActive && styles.glyphActive,
                iconGlowStyle,
                tab.key === 'collection' && { transform: [{ scale: pulse }] },
              ]}
            >
              {tab.Icon ? (
                <tab.Icon size={22} color={tint} />
              ) : isVip && vipLocked ? (
                <LockIcon size={22} color={tint} />
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
    paddingTop: 10,
    // paddingBottom は SafeArea の bottom を JSX 側で上書き
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLOR.border,
    backgroundColor: 'rgba(11,10,23,0.96)',
  },
  // HOMEの星空を残しながら、ナビゲーションの輪郭を薄く整える
  barTransparent: {
    backgroundColor: 'rgba(7,8,18,0.62)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(168,114,247,0.28)',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 50,
    flex: 1,
  },
  glyphWrap: {
    width: 40,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glyphActive: { backgroundColor: 'rgba(155,94,246,0.22)' },
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
  // .tb: 4 タブになって幅に余裕ができたので 9px → 10px（2026-10-14）。字間 .12em はそのまま
  label: {
    fontSize: 9.5,
    fontWeight: '400',
    letterSpacing: 0.6,
  },
});

export default Footer;
