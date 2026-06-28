/**
 * SettingsScreen.tsx — 設定 P5
 * ------------------------------------------------------------------
 * ワイヤーフレーム 04 / 設定画面（P5）確定リスト:
 *   静かなリスト（ラベル＋控えめな矢印のみ・アイコンは並べない）。
 *   セクションで小さなまとまりに分け、余白で静かに区切る。
 *
 *   【アカウント】
 *     1. アカウント（メール・サインアウト）   naoki@example.com
 *     2. 購入の復元（買い切り作品を引き継ぐ）
 *   【CREATOR】
 *     3. Artistのご紹介（作家一覧 → 作家 → 楽曲一覧）
 *   【一般】
 *     4. 言語（日本語）
 *     5. サポート（お問い合わせ）
 *   【情報】
 *     6. Special Thanks（スタッフクレジット・協力者）
 *     7. 利用規約
 *     8. プライバシーポリシー
 *     9. 特定商取引法に基づく表記
 *   ─ サインアウト（枠線ボタン）
 *   ─ FLUX RING バージョン 1.0.0
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

const APP_VERSION = '1.0.0';

export type SettingsKey =
  | 'account'
  | 'restore'
  | 'artist'
  | 'language'
  | 'support'
  | 'thanks'
  | 'terms'
  | 'privacy'
  | 'tokushoho';

type Props = {
  email?: string;
  language?: string;
  onSelect: (key: SettingsKey) => void;
  onSignOut: () => void;
};

type Row = { key: SettingsKey; label: string; sub?: string; value?: string };
type Section = { title: string; rows: Row[] };

export const SettingsScreen: React.FC<Props> = ({
  email = 'naoki@example.com',
  language = '日本語',
  onSelect,
  onSignOut,
}) => {
  const sections: Section[] = [
    {
      title: 'アカウント',
      rows: [
        { key: 'account', label: 'アカウント', sub: email },
        { key: 'restore', label: '購入の復元', sub: '買い切り作品を引き継ぐ' },
      ],
    },
    {
      title: 'CREATOR',
      rows: [
        { key: 'artist', label: 'Artist のご紹介', sub: '作家一覧 → 作家 → 楽曲一覧' },
      ],
    },
    {
      title: '一般',
      rows: [
        { key: 'language', label: '言語', value: language },
        { key: 'support', label: 'サポート', sub: 'お問い合わせ' },
      ],
    },
    {
      title: '情報',
      rows: [
        { key: 'thanks', label: 'Special Thanks', sub: 'スタッフクレジット・協力者' },
        { key: 'terms', label: '利用規約' },
        { key: 'privacy', label: 'プライバシーポリシー' },
        { key: 'tokushoho', label: '特定商取引法に基づく表記' },
      ],
    },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>設定</Text>

        {sections.map((sec) => (
          <View key={sec.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{sec.title}</Text>
            {sec.rows.map((row) => (
              <Pressable
                key={row.key}
                style={styles.row}
                onPress={() => onSelect(row.key)}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  {row.sub && <Text style={styles.rowSub}>{row.sub}</Text>}
                </View>
                <View style={styles.rowRight}>
                  {row.value && <Text style={styles.rowValue}>{row.value}</Text>}
                  <Text style={styles.chevron}>›</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))}

        {/* サインアウト（枠線ボタン） */}
        <Pressable
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}
          onPress={onSignOut}
        >
          <Text style={styles.signOutText}>サインアウト</Text>
        </Pressable>

        {/* アプリ情報 */}
        <Text style={styles.version}>FLUX RING　バージョン {APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  scroll: {
    // TODO: SafeAreaInsets.top を加算
    paddingTop: 56,
    paddingHorizontal: SPACE.lg,
    paddingBottom: 48,
  },
  h1: { color: COLOR.textPrimary, fontSize: 24, fontWeight: '700', letterSpacing: 0.5, marginBottom: SPACE.lg },
  section: { marginBottom: SPACE.lg },
  sectionTitle: {
    color: COLOR.textSecondary,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: SPACE.xs,
    paddingHorizontal: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
  },
  rowText: { flex: 1, gap: 3 },
  rowLabel: { color: COLOR.textPrimary, fontSize: 15, letterSpacing: 0.3 },
  rowSub: { color: COLOR.textSecondary, fontSize: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  rowValue: { color: COLOR.textSecondary, fontSize: 13 },
  chevron: { color: COLOR.textSecondary, fontSize: 18 },
  signOut: {
    marginTop: SPACE.md,
    paddingVertical: 15,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.border,
    alignItems: 'center',
  },
  signOutText: { color: COLOR.textSecondary, fontSize: 14, letterSpacing: 1 },
  version: {
    marginTop: SPACE.lg,
    color: COLOR.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
});

export default SettingsScreen;
