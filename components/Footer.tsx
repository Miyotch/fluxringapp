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

export type TabKey = 'home' | 'collection' | 'vip' | 'media' | 'settings';

type TabIcon = React.FC<{ size?: number; color?: string }>;
type TabDef = { key: TabKey; labelKey: string; Icon?: TabIcon; glyph?: string };

// アイコンは assets/icons/tab_*.svg を icons.tsx へ移植したもの。
// VIP のみ原本に対応する svg が無いため、従来のグリフ（✦）を維持する。
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
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const isVip = tab.key === 'vip';
        // VIP は常時シアン寄り。それ以外はアクティブ時のみシアン。
        const tint = isVip
          ? COLOR.auraCyan
          : isActive
          ? COLOR.auraCyan
          : COLOR.textSecondary;

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
            <View style={styles.glyphWrap}>
              {tab.Icon ? (
                <tab.Icon size={20} color={tint} />
              ) : (
                <Text style={[styles.glyph, { color: tint }]}>{tab.glyph}</Text>
              )}
              {isVip && vipLocked && (
                <View style={styles.lock} accessibilityLabel="ロック">
                  <LockIcon size={11} color={COLOR.auraCyan} />
                </View>
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
  lock: {
    position: 'absolute',
    top: -4,
    right: -10,
  },
  label: {
    fontSize: 9.5,
    letterSpacing: 0.2,
  },
});

export default Footer;
