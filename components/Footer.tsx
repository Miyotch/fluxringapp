/**
 * Footer.tsx — FLUX RING 共通フッター（5タブ）
 * ------------------------------------------------------------------
 * ワイヤーフレーム: ホーム / コレ / VIP / メディア / 設定
 *   ・4タブ（ホーム/コレクション/メディア/設定）はいつでも相互遷移
 *   ・VIP はシアン強調＋ロックマーク（未成約時）
 *   ・プレイヤー / ストーリー / 購入完了画面では非表示（呼び出し側で出し分け）
 *
 * 縦スワイプ中のフェード（退場160ms / 復帰500ms）は呼び出し側で
 * opacity を制御する想定。本コンポーネントは静的なタブ行のみ。
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
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
};

export const Footer: React.FC<FooterProps> = ({ active, onChange, vipLocked = true }) => {
  const t = useT();
  // ホームインジケータ（34pt）を避ける。従来の固定値を下回らないようにする。
  const padBottom = useBottomInset(Platform.OS === 'ios' ? 20 : 12);
  return (
    <View style={[styles.bar, { paddingBottom: padBottom }]}>
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
        // .tb: OFF #9498BE / ON #E9C879（金）/ VIP #60CEE0（常時）。
        // シアンは「不変の規律」どおり VIP 一点だけの装飾。VIP はアクティブでも
        // 金には染めず、上端インジケータ（TabTopIndicator）だけで選択中を示す。
        const tint = isVip
          ? COLOR.auraCyan
          : isActive
          ? COLOR.tabActiveGold
          : COLOR.textSecondary;

        // アイコンの金の発光（.tb.on svg drop-shadow(0 0 6px rgba(233,200,121,.45)) 相当）。
        // RN の View shadow はアルファ形状に沿う影を落とすため、SVG の細線にも馴染む。
        // iOS のみ有効（Android の View shadow は色付き指定に対応しない）。
        const iconGlowStyle =
          isActive && !isVip && Platform.OS === 'ios'
            ? {
                shadowColor: COLOR.tabActiveGold,
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
            <View style={[styles.glyphWrap, iconGlowStyle]}>
              {tab.Icon ? (
                <tab.Icon size={20} color={tint} />
              ) : isVip && vipLocked ? (
                <LockIcon size={20} color={tint} />
              ) : (
                <Text style={[styles.glyph, { color: tint }]}>{tab.glyph}</Text>
              )}
            </View>
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
  },
  glyph: {
    fontSize: 18,
    lineHeight: 20,
  },
  // .tb: 9px / weight 500 / letter-spacing .12em
  label: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.08,
  },
});

export default Footer;
