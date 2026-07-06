/**
 * SettingsDetailScreens.tsx — 設定 各項目の遷移先
 * ------------------------------------------------------------------
 * 設定 P5 の確定リストから辿る末端画面群:
 *   ・AccountScreen   … アカウント（メール・サインアウト・削除）
 *   ・RestoreScreen   … 購入の復元（買い切り作品を引き継ぐ）
 *   ・LanguageScreen  … 言語切替
 *   ・SupportScreen   … サポート（お問い合わせ・FAQ）
 *   ・DocumentScreen  … Special Thanks / 利用規約 / プライバシー / 特商法（読み物）
 *
 * 静かなトンマナ（装飾を排したリスト・余白で区切る）を踏襲。
 * 文面は仮（運営が管理画面 or バンドルテキストで差し替え）。
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Linking,
} from 'react-native';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';
import { useT, useI18n, Lang } from '../lib/i18n';
import { useAuthUser } from '../lib/useAuthUser';

// ─────────────────────────────────────────────
// 共通サブヘッダー（戻る＋タイトル）
// ─────────────────────────────────────────────

const SubHeader: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => {
  const t = useT();
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={s.back}>‹ {t('settings.title')}</Text>
      </Pressable>
      <Text style={s.h1}>{title}</Text>
      <View style={{ width: 60 }} />
    </View>
  );
};

// ─────────────────────────────────────────────
// アカウント
// ─────────────────────────────────────────────

export const AccountScreen: React.FC<{
  onBack: () => void;
  onSignOut: () => void;
}> = ({ onBack, onSignOut }) => {
  const t = useT();
  const user = useAuthUser();
  const email = user?.email ?? t('settings.notLoggedIn');
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />
      <SubHeader title={t('account.title')} onBack={onBack} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <Text style={s.fieldLabel}>{t('account.emailLabel')}</Text>
          <Text style={s.fieldValue}>{email}</Text>
        </View>

        {/* TODO: パスワード変更・メール変更（Firebase Auth） */}
        <Pressable style={s.row} onPress={() => {}}>
          <Text style={s.rowLabel}>{t('account.changePassword')}</Text>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [s.outlineBtn, pressed && { opacity: 0.7 }]}
          onPress={onSignOut}
        >
          <Text style={s.outlineLabel}>{t('settings.signout')}</Text>
        </Pressable>

        {/* TODO: アカウント削除フロー（確認ダイアログ + Firebase 退会処理） */}
        <Pressable style={s.dangerRow} onPress={() => {}}>
          <Text style={s.dangerLabel}>{t('account.delete')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────
// 購入の復元
// ─────────────────────────────────────────────

export const RestoreScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const t = useT();
  const [status, setStatus] = useState<'idle' | 'busy' | 'done'>('idle');

  const restore = async () => {
    setStatus('busy');
    // TODO: expo-in-app-purchases / react-native-iap の restorePurchases() を呼ぶ
    await new Promise((r) => setTimeout(r, 600));
    setStatus('done');
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />
      <SubHeader title={t('restore.title')} onBack={onBack} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.paragraph}>{t('restore.body')}</Text>

        <Pressable
          style={({ pressed }) => [s.primaryBtn, (pressed || status === 'busy') && { opacity: 0.7 }]}
          onPress={restore}
          disabled={status === 'busy'}
        >
          <Text style={s.primaryLabel}>
            {status === 'busy' ? t('restore.busy') : status === 'done' ? t('restore.done') : t('restore.button')}
          </Text>
        </Pressable>

        {status === 'done' && <Text style={s.note}>{t('restore.doneNote')}</Text>}
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────
// 言語
// ─────────────────────────────────────────────

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
];

export const LanguageScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const t = useT();
  const { lang, setLang } = useI18n();
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />
      <SubHeader title={t('language.title')} onBack={onBack} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {LANGUAGES.map((l) => (
          <Pressable key={l.code} style={s.row} onPress={() => setLang(l.code)}>
            <Text style={s.rowLabel}>{l.label}</Text>
            {lang === l.code && <Text style={s.check}>✓</Text>}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────
// サポート
// ─────────────────────────────────────────────

export const SupportScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const t = useT();
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />
      <SubHeader title={t('support.title')} onBack={onBack} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.paragraph}>{t('support.body')}</Text>

        {/* TODO: 実際の問い合わせ先メール / フォーム URL に差し替え */}
        <Pressable
          style={s.row}
          onPress={() => Linking.openURL('mailto:support@fluxring.app').catch(() => {})}
        >
          <View style={s.rowText}>
            <Text style={s.rowLabel}>{t('support.mail')}</Text>
            <Text style={s.rowSub}>support@fluxring.app</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        <Pressable
          style={s.row}
          onPress={() => Linking.openURL('https://fluxring.app/faq').catch(() => {})}
        >
          <Text style={s.rowLabel}>{t('support.faq')}</Text>
          <Text style={s.chevron}>›</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────
// 読み物（Special Thanks / 利用規約 / プライバシー / 特商法）
// ─────────────────────────────────────────────

export type DocKind = 'thanks' | 'terms' | 'privacy' | 'tokushoho';

const DOCS: Record<DocKind, { title: string; body: string }> = {
  thanks: {
    title: 'Special Thanks',
    body:
      'FLUX RING は、多くの方の協力で形になりました。\n\n' +
      '・楽曲 / 音響：岡 ナオキ\n' +
      '・ビジュアルディレクション：株式会社ヌメロ.8\n' +
      '・テスト協力：初期リスナーの皆さま\n\n' +
      'この場をかりて、心より感謝申し上げます。',
  },
  terms: {
    title: '利用規約',
    body:
      '本利用規約（以下「本規約」）は、FLUX RING（以下「本サービス」）の利用条件を定めるものです。\n\n' +
      '第1条（適用）\n本規約は、利用者と運営者との間の本サービスの利用に関わる一切の関係に適用されます。\n\n' +
      '第2条（アカウント）\n利用者は、自己の責任においてアカウントを管理するものとします。\n\n' +
      '第3条（購入と所有）\n本サービスで購入した作品は買い切りであり、利用者のアカウントに永続的に紐づきます。\n\n' +
      '（以下、正式な条文は公開前に法務確認のうえ差し替え）',
  },
  privacy: {
    title: 'プライバシーポリシー',
    body:
      '運営者は、利用者の個人情報を以下の方針に基づいて取り扱います。\n\n' +
      '1. 取得する情報\nメールアドレス、購入履歴、利用状況などを取得します。\n\n' +
      '2. 利用目的\n本サービスの提供・改善、サポート対応、重要なお知らせの配信に利用します。\n\n' +
      '3. 第三者提供\n法令に基づく場合を除き、本人の同意なく第三者に提供しません。\n\n' +
      '（以下、正式な条文は公開前に差し替え）',
  },
  tokushoho: {
    title: '特定商取引法に基づく表記',
    body:
      '販売事業者：株式会社ヌメロ.8\n' +
      '運営統括責任者：岡 ナオキ\n' +
      '所在地：（公開前に記載）\n' +
      'お問い合わせ：support@fluxring.app\n\n' +
      '販売価格：各作品ページに表示（例：¥2,500）\n' +
      '商品代金以外の必要料金：通信料金はお客様のご負担となります。\n' +
      'お支払い方法：App Store / Google Play の決済\n' +
      '商品の引渡し時期：決済完了後、ただちにご利用いただけます。\n' +
      '返品・キャンセル：デジタルコンテンツの性質上、購入後の返品はお受けできません。',
  },
};

export const DocumentScreen: React.FC<{ kind: DocKind; onBack: () => void }> = ({
  kind,
  onBack,
}) => {
  const t = useT();
  const doc = DOCS[kind];
  // タイトルは i18n。本文（法務・クレジット）は現状 日本語のまま（別途英訳予定）。
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />
      <SubHeader title={t(`doc.${kind}`)} onBack={onBack} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.docBody}>{doc.body}</Text>
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────
// スタイル
// ─────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  header: {
    paddingTop: 52,
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { color: COLOR.textSecondary, fontSize: 14 },
  h1: { color: COLOR.textPrimary, fontSize: 16, fontWeight: '600', letterSpacing: 1 },
  body: { paddingHorizontal: SPACE.lg, paddingBottom: 48, gap: SPACE.md },

  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: 'rgba(34,36,69,0.30)',
    padding: SPACE.md,
    gap: 4,
  },
  fieldLabel: { color: COLOR.textSecondary, fontSize: 11, letterSpacing: 1 },
  fieldValue: { color: COLOR.textPrimary, fontSize: 16, letterSpacing: 0.3 },

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
  chevron: { color: COLOR.textSecondary, fontSize: 18 },
  check: { color: COLOR.auraCyan, fontSize: 16 },

  paragraph: { color: COLOR.textSecondary, fontSize: 14, lineHeight: 23, letterSpacing: 0.3 },
  docBody: { color: COLOR.textPrimary, fontSize: 14, lineHeight: 26, letterSpacing: 0.3 },
  note: { color: COLOR.auraCyan, fontSize: 13, textAlign: 'center' },

  primaryBtn: {
    paddingVertical: 15,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.auraCyan,
    backgroundColor: 'rgba(96,206,224,0.08)',
    alignItems: 'center',
  },
  primaryLabel: { color: COLOR.textPrimary, fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
  outlineBtn: {
    marginTop: SPACE.sm,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.border,
    alignItems: 'center',
  },
  outlineLabel: { color: COLOR.textSecondary, fontSize: 14, letterSpacing: 1 },
  dangerRow: { marginTop: SPACE.lg, alignItems: 'center', paddingVertical: SPACE.sm },
  dangerLabel: { color: COLOR.badge, fontSize: 13, letterSpacing: 0.5 },
});

export default DocumentScreen;
