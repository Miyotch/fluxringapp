/**
 * SettingsScreen.tsx — 設定 P5
 * ------------------------------------------------------------------
 * 確定デザイン: セクション見出しを持たない**カード型の一列リスト**。
 * 1項目 = 角丸の枠 + ラベル（字間広め）+ 右端の控えめな矢印。副文は置かない。
 *
 *   1. アカウント        （メール・パスワード・サインアウト・退会）
 *   2. 購入の復元        （買い切り作品を引き継ぐ）
 *   3. Artistのご紹介    （作家一覧 → 作家 → 楽曲一覧）
 *   4. 言語
 *   5. サポート
 *   6. 情報              （CREDITS / 利用規約 / プライバシー / 特商法 / バージョン）
 *   7. サインアウト
 *
 * CLAUDE.md の遷移図「アカウント / 購入の復元 → Artistのご紹介 → 言語 / サポート / 情報」
 * と同じ粒度。規約類の4点は 6.情報 の下にまとめ、退会は 1.アカウント の中に置く。
 *
 *   ※ 再生設定・通知設定・テーマ切替・カスタマイズ・EQ は置かない。
 *   ※ 通知は設定に入れず、ホーム右上のベルへ。
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';
import { JP_SERIF_FONT } from '../constants/fonts';
import { useT } from '../lib/i18n';
import { useTopInset } from '../lib/safeArea';

export type SettingsKey =
  | 'account'
  | 'restore'
  | 'artist'
  | 'language'
  | 'support'
  | 'info'
  | 'thanks'
  | 'terms'
  | 'privacy'
  | 'tokushoho';

type Props = {
  onSelect: (key: SettingsKey) => void;
  onSignOut: () => void;
};

type Row = { key: SettingsKey | 'signout'; label: string };

export const SettingsScreen: React.FC<Props> = ({ onSelect, onSignOut }) => {
  const t = useT();
  const scrollTop = useTopInset(12); // 従来 56px（=44+12）

  const rows: Row[] = [
    { key: 'account', label: t('settings.account') },
    { key: 'restore', label: t('settings.restore') },
    { key: 'artist', label: t('settings.artist') },
    { key: 'language', label: t('settings.language') },
    { key: 'support', label: t('settings.support') },
    { key: 'info', label: t('settings.info') },
    { key: 'signout', label: t('settings.signout') },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: scrollTop }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>{t('settings.title')}</Text>

        <View style={styles.list}>
          {rows.map((row) => (
            <Pressable
              key={row.key}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => (row.key === 'signout' ? onSignOut() : onSelect(row.key))}
              accessibilityRole="button"
            >
              <Text style={styles.cardLabel}>{row.label}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  scroll: {
    // 既定値。実機では SafeArea の top を加味して JSX 側で上書き
    paddingTop: 56,
    paddingHorizontal: SPACE.lg,
    paddingBottom: 48,
  },
  // 和文＝明朝（OS標準）/ letterSpacing = fontSize×0.02
  h1: { color: COLOR.textPrimary, fontSize: 18, letterSpacing: 0.36, marginBottom: SPACE.lg, fontFamily: JP_SERIF_FONT },

  // カード型の一列リスト。区切り線ではなく、角丸の枠と余白で1項目ずつ独立させる
  list: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 17,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: 'rgba(34,36,69,0.30)',
  },
  cardPressed: { opacity: 0.7 },
  cardLabel: { color: COLOR.textPrimary, fontSize: 14, letterSpacing: 0.28, fontFamily: JP_SERIF_FONT },
  chevron: { color: COLOR.textSecondary, fontSize: 16 },
});

export default SettingsScreen;
