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
 * 読み物4点の文面は Firestore の legal_docs から読む（lib/legalDocs.ts）。管理画面で書き換え、
 * 読めないときはアプリ同梱の文面（constants/legalDocs.json）を出す。アプリ側に編集機能は持たない。
 */

import React, { useState } from 'react';
import Constants from 'expo-constants';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Linking,
  Modal,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinear, Stop, Rect, Path } from 'react-native-svg';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';
import { NUM_FONT, JP_SERIF_FONT } from '../constants/fonts';
import { useT, useI18n, Lang } from '../lib/i18n';
import { useAuthUser } from '../lib/useAuthUser';
import { submitInquiry, type InquiryType } from '../lib/submitInquiry';
import { useQuestionListUrl } from '../lib/remoteConfig';
import { useTopInset, useBottomInset } from '../lib/safeArea';
import { CR, CreditsBackdrop } from '../components/CreditsBackdrop';
import { useLegalDoc, type TokushoRow } from '../lib/legalDocs';

// ─────────────────────────────────────────────
// 共通サブヘッダー（戻る＋タイトル）
// ─────────────────────────────────────────────

/**
 * 設定配下・作家画面で共通のヘッダーテンプレート。
 * 余白・フォント・中央揃え・戻る矢印のサイズはすべてここ（と s.header 系）に集約し、
 * 各画面でヘッダーを直書きしない。上端は SafeArea 実測 + 8px（従来の固定 52px は
 * ステータスバー44pt想定の値なので、44pt機では同じ見た目のまま Dynamic Island 機で
 * 自動的に下がる）。
 */
export const SubHeader: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => {
  const top = useTopInset(8);
  return (
    <View style={[s.header, { paddingTop: top }]}>
      <Pressable onPress={onBack} hitSlop={12} style={s.backBtn}>
        <Text style={s.back}>‹</Text>
      </Pressable>
      <Text style={s.h1}>{title}</Text>
      <View style={s.backBtn} />
    </View>
  );
};

// ─────────────────────────────────────────────
// アカウント
// ─────────────────────────────────────────────

export const AccountScreen: React.FC<{
  onBack: () => void;
  /** 「購入」欄の「購入の復元」タップで遷移 */
  onOpenRestore: () => void;
  /** 「ご利用プラン」欄の表示に使う（VIP＝年間ライセンス契約中なら「有料」） */
  vipUnlocked: boolean;
  /** 退会（確認後に実行）。設定リストがカード型7項目になったため、
   *  退会導線はこの画面に集約する（App Store の審査要件で、アカウントを
   *  作れるアプリはアプリ内に削除導線が必要）。 */
  onDeleteAccount?: () => void | Promise<void>;
}> = ({ onBack, onOpenRestore, vipUnlocked, onDeleteAccount }) => {
  const t = useT();
  const user = useAuthUser();
  const email = user?.email ?? t('settings.notLoggedIn');
  const { width: screenW, height: screenH } = useWindowDimensions();

  // 退会の確認ポップアップ
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const runDelete = async () => {
    if (!onDeleteAccount) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteAccount();
      setConfirmDelete(false);
    } catch {
      setDeleteError(t('settings.delete.failed'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={CR.deepest} />
      <CreditsBackdrop w={screenW} h={screenH} />
      <SubHeader title={t('account.title')} onBack={onBack} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.acctSectionLabel}>{t('account.sec.registration')}</Text>
        <View style={s.acctCard}>
          <Text style={s.acctLabel}>{t('account.emailLabel')}</Text>
          <Text style={[s.acctValue, s.acctValueMono]}>{email}</Text>
        </View>
        <View style={s.acctCard}>
          <Text style={s.acctLabel}>{t('account.plan')}</Text>
          <Text style={s.acctValue}>
            {vipUnlocked ? t('account.plan.paid') : t('account.plan.free')}
          </Text>
        </View>

        <Text style={s.acctSectionLabel}>{t('account.sec.purchases')}</Text>
        <Pressable
          style={({ pressed }) => [s.acctCard, pressed && { opacity: 0.7 }]}
          onPress={onOpenRestore}
        >
          <Text style={s.acctLabel}>{t('settings.restore')}</Text>
          <Text style={s.chevron}>›</Text>
        </Pressable>

        {onDeleteAccount && (
          <Pressable
            style={({ pressed }) => [s.acctCard, s.acctCardDanger, pressed && { opacity: 0.7 }]}
            onPress={() => {
              setDeleteError(null);
              setConfirmDelete(true);
            }}
          >
            <Text style={[s.acctLabel, s.acctLabelDanger]}>{t('settings.deleteAccount')}</Text>
            <Text style={[s.chevron, s.acctLabelDanger]}>›</Text>
          </Pressable>
        )}
        <Text style={s.acctFootnote}>{t('account.planNote')}</Text>
      </ScrollView>

      {/* 退会の確認ポップアップ（購入情報など全消去の確認・戻る/削除する） */}
      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setConfirmDelete(false)}
      >
        <Pressable style={s.modalScrim} onPress={() => !deleting && setConfirmDelete(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>{t('settings.delete.title')}</Text>
            <Text style={s.modalBody}>{t('settings.delete.body')}</Text>
            {deleteError && <Text style={s.modalError}>{deleteError}</Text>}

            <Pressable
              style={({ pressed }) => [s.modalDeleteBtn, (pressed || deleting) && { opacity: 0.7 }]}
              onPress={runDelete}
              disabled={deleting}
            >
              <Text style={s.modalDeleteLabel}>
                {deleting ? '処理中…' : t('settings.delete.confirm')}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [s.modalCancelBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              <Text style={s.modalCancelLabel}>{t('settings.delete.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

// ─────────────────────────────────────────────
// 購入の復元
// ─────────────────────────────────────────────

/**
 * 購入の復元。
 * restorePurchases()（iOS は sync / Android は query の取り直し）→
 * getAvailablePurchases() → サーバ検証 → Firestore 権利付与、までを
 * lib/iap.ts が行い、ここは結果の件数を出し分けるだけ。
 * 復元した所有権は App.tsx の usePurchaseFlow が保持するので、この画面で
 * 完結させない（コレクションに反映される形にする）。
 *
 * 非消費型（買い切り）を扱うアプリでは、この導線はストア審査上ほぼ必須。
 */
export const RestoreScreen: React.FC<{
  onBack: () => void;
  /** 復元の実行。復元できた trackId の数を返す */
  onRestore?: () => Promise<{ trackIds: string[]; hadFailure: boolean }>;
}> = ({ onBack, onRestore }) => {
  const t = useT();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [status, setStatus] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const [count, setCount] = useState(0);

  const restore = async () => {
    setStatus('busy');
    if (!onRestore) {
      // 課金フローが繋がっていない画面（部品デモ等）。押しても壊さない
      setStatus('failed');
      return;
    }
    try {
      const result = await onRestore();
      setCount(result.trackIds.length);
      setStatus(result.hadFailure && result.trackIds.length === 0 ? 'failed' : 'done');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={CR.deepest} />
      <CreditsBackdrop w={screenW} h={screenH} />
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

        {/* 0件 / n件 / 失敗 で文言を出し分ける。0件は異常ではないので
            エラー文言にしない（そもそも購入が無いだけのことがある）。 */}
        {status === 'done' && (
          <Text style={s.note}>
            {count === 0 ? t('restore.none') : t('restore.doneCount', { n: count })}
          </Text>
        )}
        {status === 'failed' && <Text style={s.note}>{t('restore.failed')}</Text>}
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────
// 言語
// ─────────────────────────────────────────────

// English はまだ翻訳未確定のため選択肢に出さない（英訳確定後に追加）。
// lib/i18n.tsx 側の 'en' 辞書・Lang 型はそのまま残し、切替の受け皿だけ用意しておく。
const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'ja', label: '日本語' },
];

export const LanguageScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const t = useT();
  const { lang, setLang } = useI18n();
  const { width: screenW, height: screenH } = useWindowDimensions();
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={CR.deepest} />
      <CreditsBackdrop w={screenW} h={screenH} />
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

type SupportView = 'list' | 'form' | 'sent';

// 問い合わせの種類。表示ラベルは i18n キー経由（lib/i18n.tsx の support.inquiry.type.*）
const INQUIRY_TYPES: { key: InquiryType; labelKey: string }[] = [
  { key: 'bug', labelKey: 'support.inquiry.type.bug' },
  { key: 'billing', labelKey: 'support.inquiry.type.billing' },
  { key: 'other', labelKey: 'support.inquiry.type.other' },
];

export const SupportScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const t = useT();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const user = useAuthUser();
  // よくある質問のリンク先（Remote Config の question_list。運営がFirebase
  // コンソールから編集する）。取得できるまで／失敗時はデフォルトURLのまま
  const questionListUrl = useQuestionListUrl();
  const [view, setView] = useState<SupportView>('list');
  const [type, setType] = useState<InquiryType>('bug');
  const [typeOpen, setTypeOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 「戻る」はフォーム／送信完了からは一覧へ、一覧からは設定へ
  const handleBack = () => {
    if (view === 'list') {
      onBack();
      return;
    }
    setError(null);
    setTypeOpen(false);
    setView('list');
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError(t('support.inquiry.error'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await submitInquiry({ type, message });
      setView('sent');
    } catch {
      setError(t('support.inquiry.sendError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={CR.deepest} />
      <CreditsBackdrop w={screenW} h={screenH} />
      <SubHeader title={t('support.title')} onBack={handleBack} />

      {view === 'list' && (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          <Text style={[s.paragraph, s.supportLead]}>{t('support.body')}</Text>

          <Pressable style={s.row} onPress={() => setView('form')}>
            <Text style={s.rowLabel}>{t('support.inquiry')}</Text>
            <Text style={s.chevron}>›</Text>
          </Pressable>

          <Pressable
            style={s.row}
            onPress={() => Linking.openURL(questionListUrl).catch(() => {})}
          >
            <Text style={s.rowLabel}>{t('support.faq')}</Text>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        </ScrollView>
      )}

      {view === 'form' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
            <Text style={[s.paragraph, s.supportLead]}>{t('support.inquiry.lead')}</Text>

            {/* 送信元メールアドレス（編集不可・アカウントのメールをそのまま表示）。
                自由入力にすると別人のメールアドレスを騙って送れてしまうため、
                ログイン中アカウントの値をそのまま使う（lib/submitInquiry.ts 参照） */}
            {user?.email && (
              <View style={s.formField}>
                <Text style={s.formLabel}>{t('support.inquiry.email')}</Text>
                <View style={[s.formInput, s.formStatic]}>
                  <Text style={s.formStaticText}>{user.email}</Text>
                </View>
              </View>
            )}

            <View style={s.formField}>
              <Text style={s.formLabel}>{t('support.inquiry.type')}</Text>
              <Pressable
                style={[s.formInput, s.formSelect]}
                onPress={() => setTypeOpen((o) => !o)}
                accessibilityRole="button"
                accessibilityLabel={t('support.inquiry.type')}
              >
                <Text style={s.formSelectValue}>
                  {t(INQUIRY_TYPES.find((opt) => opt.key === type)?.labelKey ?? '')}
                </Text>
                <Text style={s.formSelectChevron}>{typeOpen ? '︿' : '﹀'}</Text>
              </Pressable>
              {typeOpen && (
                <View style={s.formSelectMenu}>
                  {INQUIRY_TYPES.map((opt, i) => (
                    <Pressable
                      key={opt.key}
                      style={[
                        s.formSelectOption,
                        i === INQUIRY_TYPES.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      onPress={() => {
                        setType(opt.key);
                        setTypeOpen(false);
                      }}
                    >
                      <Text style={s.rowLabel}>{t(opt.labelKey)}</Text>
                      {type === opt.key && <Text style={s.check}>✓</Text>}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={s.formField}>
              <Text style={s.formLabel}>{t('support.inquiry.message')}</Text>
              <TextInput
                style={[s.formInput, s.formInputMulti]}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                placeholder={t('support.inquiry.messagePlaceholder')}
                placeholderTextColor={COLOR.textSecondary}
              />
            </View>

            {error && <Text style={s.formError}>{error}</Text>}

            <Pressable
              style={({ pressed }) => [s.primaryBtn, (pressed || submitting) && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={s.primaryLabel}>
                {submitting ? t('support.inquiry.sending') : t('support.inquiry.submit')}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {view === 'sent' && (
        <View style={s.sentWrap}>
          <Text style={s.modalTitle}>{t('support.inquiry.sentTitle')}</Text>
          <Text style={[s.paragraph, { textAlign: 'center', marginTop: SPACE.sm }]}>
            {t('support.inquiry.sentMessage')}
          </Text>
          {/* 元の画面（サポート一覧）へ戻れるようにする。設定まで抜けてしまう
              onBack ではなく、フォームを開く前にいた一覧へ戻す */}
          <Pressable
            style={[s.primaryBtn, s.sentBtn]}
            onPress={() => {
              setMessage('');
              setType('bug');
              setView('list');
            }}
          >
            <Text style={s.primaryLabel}>{t('support.inquiry.backToList')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────
// 読み物（Special Thanks / 利用規約 / プライバシー / 特商法）
// ─────────────────────────────────────────────

export type DocKind = 'thanks' | 'terms' | 'privacy' | 'tokushoho';

// 文面の型・中身・読み込みは lib/legalDocs.ts（Firestore legal_docs ＋ 同梱の文面）

// ─────────────────────────────────────────────
// 特定商取引法に基づく表記（専用トンマナ。行のデータは legal_docs/tokushoho）
// ─────────────────────────────────────────────

// 「仮置き / 要確認」バッジ
const TokushoBadge: React.FC<{ label: string }> = ({ label }) => (
  <View style={tk.badge}>
    <Text style={tk.badgeText}>{label}</Text>
  </View>
);

const TokushoRowView: React.FC<{ row: TokushoRow }> = ({ row }) => (
  <View style={tk.row}>
    <Text style={tk.dt}>{row.label}</Text>
    <View style={tk.dd}>
      {row.value != null && (
        <View style={tk.valueLine}>
          <Text style={tk.ddText}>{row.value}</Text>
          {row.badge && <TokushoBadge label={row.badge} />}
        </View>
      )}
      {row.list && (
        <View style={tk.list}>
          {row.list.map((raw, i) => {
            const item = typeof raw === 'string' ? { text: raw } : raw;
            const badge = item.badge ?? item.badgeInText;
            return (
              <View key={i} style={tk.listItem}>
                <Text style={tk.ddText}>{item.text}</Text>
                {badge && <TokushoBadge label={badge} />}
              </View>
            );
          })}
        </View>
      )}
      {row.note && (
        <View style={tk.noteLine}>
          <Text style={tk.note}>{row.note}</Text>
          {row.badgeInNote && <TokushoBadge label={row.badgeInNote} />}
        </View>
      )}
    </View>
  </View>
);

// 特定商取引法に基づく表記（添付仕様準拠の独自トンマナ。ヘッダーは共通 SubHeader を流用）
const TokushohoScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const t = useT();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { rows, footer } = useLegalDoc('tokushoho');
  return (
    <View style={tk.root}>
      <StatusBar barStyle="light-content" backgroundColor={CR.deepest} />
      <CreditsBackdrop w={screenW} h={screenH} />
      <SubHeader title={t('doc.tokushoho')} onBack={onBack} />
      <ScrollView contentContainerStyle={tk.body} showsVerticalScrollIndicator={false}>
        {rows.map((row, i) => (
          <TokushoRowView key={`${row.label}-${i}`} row={row} />
        ))}
        {footer && <Text style={tk.foot}>{footer}</Text>}
      </ScrollView>
    </View>
  );
};

// 特定商取引法画面固有のカラー定義（他画面のトンマナとは独立）
const TK = {
  bg: '#0B0E1E',
  ink: '#ECEEF7',
  sub: 'rgba(236, 238, 247, 0.62)',
  line: 'rgba(236, 238, 247, 0.12)',
  accent: '#60CEE0',
  pending: '#F0C674',
  pendingBorder: 'rgba(240, 198, 116, 0.4)',
} as const;

const tk = StyleSheet.create({
  // CreditsBackdrop の外周色（CR.deepest、後方で定義のためここでは直値）と揃える
  root: { flex: 1, backgroundColor: '#05040c' },
  body: { paddingHorizontal: 24, paddingBottom: 96 },
  row: { paddingVertical: 19, borderBottomWidth: 1, borderBottomColor: TK.line },
  // タイトル(項目名)16px・内容13pxの指示により、dt/ddTextの大小関係を入れ替えた
  dt: { fontSize: 16, color: TK.sub, letterSpacing: 0.6, marginBottom: 6, fontFamily: JP_SERIF_FONT },
  dd: { gap: 4 },
  // 数字が並ぶため EB Garamond（等幅寄りの数字グリフ）を当てる。和文はOSフォールバック。
  // 内容は指示により 13。行間は同じ13px向けの note と揃えて22にした
  // （旧16px向けの30.4のままだと13pxに対して行間が空きすぎるため）
  ddText: { fontSize: 13, color: TK.ink, lineHeight: 22, fontFamily: NUM_FONT },
  valueLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  list: { gap: 2 },
  listItem: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 6, paddingVertical: 2 },
  noteLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 },
  note: { fontSize: 13, color: TK.sub, lineHeight: 22, fontFamily: NUM_FONT },
  badge: {
    borderWidth: 1,
    borderColor: TK.pendingBorder,
    borderRadius: 3,
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 12, color: TK.pending, fontFamily: NUM_FONT },
  foot: { marginTop: 48, fontSize: 11, color: TK.sub, letterSpacing: 0.55, fontFamily: NUM_FONT },
});

// CR / CreditsBackdrop（CREDITS 画面と同じ背景）は components/CreditsBackdrop.tsx へ
// 移動した（コレクション／メディア／VIP等、設定配下以外の画面でも使うため）。

// 両端が透明にフェードする水平線（Founderブロック下のシアン光条／区切り線に共用）
const FadeLine: React.FC<{ w: number; h: number; color: string; style?: object }> = ({
  w,
  h,
  color,
  style,
}) => (
  <Svg width={w} height={h} style={style}>
    <Defs>
      <SvgLinear id={`crfade-${color}-${w}`} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor={color} stopOpacity={0} />
        <Stop offset="0.5" stopColor={color} stopOpacity={1} />
        <Stop offset="1" stopColor={color} stopOpacity={0} />
      </SvgLinear>
    </Defs>
    <Rect x={0} y={0} width={w} height={h} fill={`url(#crfade-${color}-${w})`} />
  </Svg>
);

// CREDITS 画面（Special Thanks）: 背景と本文は添付デザイン準拠の独自トンマナ
// （放射状グラデーション背景＋オーラ・中央のFounderブロック＋左寄せのクルーリスト）。
// ヘッダーだけは他の設定画面と揃えるため共通の SubHeader を使う。
const CreditsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const t = useT();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const contentW = screenW - SPACE.xl * 2; // paddingHorizontal 34相当 = SPACE.xl

  const { entries } = useLegalDoc('credits');
  const [founder, ...crew] = entries;
  // 同じ役職は1つにまとめる（出てきた順）
  const crewGroups: { role: string; names: string[] }[] = [];
  for (const c of crew) {
    const g = crewGroups.find((x) => x.role === c.role);
    if (g) g.names.push(c.name);
    else crewGroups.push({ role: c.role, names: [c.name] });
  }

  return (
    <View style={cs.root}>
      <StatusBar barStyle="light-content" backgroundColor={CR.deepest} />
      <CreditsBackdrop w={screenW} h={screenH} />

      <SubHeader title={t('settings.thanks')} onBack={onBack} />

      <ScrollView
        contentContainerStyle={cs.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={cs.founderBlock}>
          <Text style={cs.roleLabel}>{founder.role}</Text>
          <Text style={cs.personName}>{founder.name}</Text>
          <FadeLine w={20} h={1} color={CR.cyan} style={cs.founderLine} />
        </View>

        <FadeLine w={contentW} h={1} color={CR.border} style={cs.rule} />

        <View style={cs.crewList}>
          {crewGroups.map((g) => (
            <View key={g.role} style={cs.crewRow}>
              <Text style={cs.roleLabel}>{g.role}</Text>
              {/* 同じ役職が複数人のときは、役職を1回だけ出して名前を横に並べる
                  （入りきらなければ折り返す） */}
              <View style={cs.nameRow}>
                {g.names.map((n, i) => (
                  <Text key={`${n}-${i}`} style={cs.personName}>{n}</Text>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={cs.footerWrap}>
          <Text style={cs.footerMark}>FluxRing</Text>
          <Text style={[cs.footerMark, cs.footerMarkDim]}>Operated by Numéro.8</Text>
        </View>
      </ScrollView>
    </View>
  );
};

// CREDITS 専用スタイル（他画面の s とは独立。フォントは欧文名の並びのため EB Garamond 統一）
const cs = StyleSheet.create({
  root: { flex: 1, backgroundColor: CR.deepest },
  // ヘッダーは共通の SubHeader に統一したので、この画面固有のヘッダー定義は持たない。
  // paddingTop 48 は「クレジット〜岡氏のブロックを2〜3行分下げる」ための余白。
  body: { paddingHorizontal: SPACE.xl, paddingTop: 48, paddingBottom: 80 },
  founderBlock: { alignItems: 'center', marginBottom: 46 },
  founderLine: { marginTop: 16, opacity: 0.6 },
  rule: { marginBottom: 42, opacity: 0.5 },
  crewList: { gap: 26, alignItems: 'flex-start' },
  crewRow: { alignItems: 'flex-start' },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 },
  // role-label: 10px / 字間.2em(=2.0) / --sub / uppercase / weight400
  roleLabel: {
    color: CR.sub,
    fontSize: 10,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
    fontWeight: '400',
    fontFamily: NUM_FONT,
  },
  // person-name: 15px / 字間.04em(=0.6) / --text / weight400 / marginTop 6
  personName: {
    color: CR.text,
    fontSize: 15,
    letterSpacing: 0.6,
    fontWeight: '400',
    marginTop: 6,
    fontFamily: NUM_FONT,
  },
  footerWrap: { alignItems: 'center', marginTop: 46, gap: 6 },
  // footer-mark: 9px / 字間.3em(=2.7) / --tertiary / uppercase。2行目のみ opacity 0.55
  footerMark: {
    color: CR.tertiary,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: NUM_FONT,
  },
  footerMarkDim: { opacity: 0.55 },
});

export const DocumentScreen: React.FC<{ kind: DocKind; onBack: () => void }> = ({
  kind,
  onBack,
}) => {
  // Special Thanks は専用の CREDITS 画面
  if (kind === 'thanks') return <CreditsScreen onBack={onBack} />;

  // 特定商取引法に基づく表記も専用画面（独自データ構造・独自トンマナ）
  if (kind === 'tokushoho') return <TokushohoScreen onBack={onBack} />;

  return <TextDocScreen kind={kind} onBack={onBack} />;
};

// 条文形式（利用規約・プライバシーポリシー）。
// タイトルは i18n。本文は legal_docs/{kind} の言語別の中身（英語が無ければ日本語）。
const TextDocScreen: React.FC<{ kind: 'terms' | 'privacy'; onBack: () => void }> = ({
  kind,
  onBack,
}) => {
  const t = useT();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const docBody = useLegalDoc(kind);
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={CR.deepest} />
      <CreditsBackdrop w={screenW} h={screenH} />
      <SubHeader title={t(`doc.${kind}`)} onBack={onBack} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {docBody.lead && <Text style={s.docLead}>{docBody.lead}</Text>}
        {docBody.sections.map((sec, i) => (
          <View key={sec.heading ?? i} style={s.docSection}>
            {sec.heading && <Text style={s.docHeading}>{sec.heading}</Text>}
            <Text style={s.docBody}>{sec.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────
// 情報（規約類のまとめ）
// ─────────────────────────────────────────────

// 版は app.json の expo.version から読む（手書きだと上げ忘れてずれるため。2026-09-24）
const APP_VERSION = Constants.expoConfig?.version ?? '';

/**
 * 設定「情報」。CREDITS / 利用規約 / プライバシー / 特商法 を束ねる中間画面。
 * 設定リストを7項目に保つため、読み物4点はここへ集約する。
 * 遷移は自前の state で持つ（App 側の settingsDetail を1段に保てるので、
 * 読み物から戻ったときに設定直下ではなくこの画面へ正しく戻れる）。
 */
export const InfoScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const t = useT();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [doc, setDoc] = useState<DocKind | null>(null);

  if (doc) return <DocumentScreen kind={doc} onBack={() => setDoc(null)} />;

  // CREDITS は設定の第1階層へ移したのでここには置かない（規約類3点のみ）
  const rows: { kind: DocKind; label: string }[] = [
    { kind: 'terms', label: t('settings.terms') },
    { kind: 'privacy', label: t('settings.privacy') },
    { kind: 'tokushoho', label: t('settings.tokushoho') },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={CR.deepest} />
      <CreditsBackdrop w={screenW} h={screenH} />
      <SubHeader title={t('settings.info')} onBack={onBack} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.infoList}>
          {rows.map((r) => (
            <Pressable
              key={r.kind}
              style={({ pressed }) => [s.infoCard, pressed && { opacity: 0.7 }]}
              onPress={() => setDoc(r.kind)}
              accessibilityRole="button"
            >
              <Text style={s.infoLabel}>{r.label}</Text>
              <Text style={s.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.version}>{t('settings.version', { v: APP_VERSION })}</Text>
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────
// スタイル
// ─────────────────────────────────────────────

const s = StyleSheet.create({
  // CreditsBackdrop の外周色と揃える（設定配下の各画面は CREDITS と同じ背景にする）
  root: { flex: 1, backgroundColor: CR.deepest },

  // ── 情報（設定と同じカード型リスト）──
  infoList: { gap: 12 },
  infoCard: {
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
  infoLabel: {
    color: COLOR.textPrimary,
    fontSize: 14,
    letterSpacing: 0.28,
    flex: 1,
    paddingRight: SPACE.sm,
    fontFamily: JP_SERIF_FONT,
  },
  // バージョン番号＝数字表記
  version: {
    fontFamily: NUM_FONT,
    marginTop: SPACE.lg,
    color: COLOR.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 0.5,
    opacity: 0.7,
  },

  header: {
    paddingTop: 52,
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // 戻るは「‹」のみに統一。左右を同幅にしてタイトルを中央に保つ
  // （左は実タップ領域、右は見えないバランサー）。
  backBtn: { width: 32 },
  // 16px（見出しh1と同大）でもまだ見づらいとの指摘のため、2段階分＋4して20pxへ
  back: { color: COLOR.textBack, fontSize: 24, letterSpacing: 0.6 },
  // 和文＝明朝（OS標準）/ letterSpacing = fontSize×0.02
  h1: {
    flex: 1,
    textAlign: 'center',
    color: COLOR.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.32,
    fontFamily: JP_SERIF_FONT,
  },
  body: { paddingHorizontal: SPACE.lg, paddingBottom: 48, gap: SPACE.md },

  // ── アカウント画面専用（カード型リスト）──
  acctSectionLabel: {
    color: COLOR.textSecondary,
    fontSize: 11,
    letterSpacing: 0.22,
    marginTop: SPACE.xs,
    fontFamily: JP_SERIF_FONT,
  },
  // 情報行（メールアドレス/ご利用プラン）と遷移行（購入の復元/削除）で共通の枠
  acctCard: {
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
  acctCardDanger: { borderColor: 'rgba(255,59,48,0.35)' },
  acctLabel: { color: COLOR.textPrimary, fontSize: 14, letterSpacing: 0.28, fontFamily: JP_SERIF_FONT },
  acctLabelDanger: { color: COLOR.badge },
  // 既定は和文（ご利用プラン等）。メールアドレスは acctValueMono を重ねて欧文にする
  acctValue: { color: COLOR.textSecondary, fontSize: 13, letterSpacing: 0.26, fontFamily: JP_SERIF_FONT },
  acctValueMono: { fontFamily: NUM_FONT, letterSpacing: 0 },
  acctFootnote: {
    color: COLOR.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: 0.24,
    opacity: 0.85,
    marginTop: SPACE.xs,
    fontFamily: JP_SERIF_FONT,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
  },
  rowLabel: { color: COLOR.textPrimary, fontSize: 15, letterSpacing: 0.3, fontFamily: JP_SERIF_FONT },
  chevron: { color: COLOR.textSecondary, fontSize: 18 },
  check: { color: COLOR.auraCyan, fontSize: 16 },

  paragraph: { color: COLOR.textSecondary, fontSize: 14, lineHeight: 23, letterSpacing: 0.28, fontFamily: JP_SERIF_FONT },
  // サポート画面: タイトル(SubHeader)と本文の間に2行分（lineHeight23×2）の余白を追加
  supportLead: { marginTop: 46 },
  docLead: {
    color: COLOR.textSecondary,
    fontSize: 15,
    lineHeight: 25,
    letterSpacing: 0.26,
    marginBottom: SPACE.xs,
    fontFamily: JP_SERIF_FONT,
  },
  docSection: { gap: 6 },
  // タイトル(見出し)16px・内容(本文)13pxの指示により、見出しはそのまま・本文はここで縮小
  docHeading: { color: COLOR.textPrimary, fontSize: 16, fontWeight: '700', letterSpacing: 0.32, fontFamily: JP_SERIF_FONT },
  // 本文は指示により 16 → 13。行間は tk.note と同じ13px向けの値(22)に合わせた
  // （16px向けの29のままだと13pxに対して行間が空きすぎるため）
  docBody: { color: COLOR.textPrimary, fontSize: 13, lineHeight: 22, letterSpacing: 0.32, fontFamily: JP_SERIF_FONT },
  note: { color: COLOR.auraCyan, fontSize: 13, textAlign: 'center', letterSpacing: 0.26, fontFamily: JP_SERIF_FONT },

  primaryBtn: {
    paddingVertical: 15,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.auraCyan,
    backgroundColor: 'rgba(96,206,224,0.08)',
    alignItems: 'center',
  },
  primaryLabel: { color: COLOR.textPrimary, fontSize: 15, fontWeight: '600', letterSpacing: 0.3, fontFamily: JP_SERIF_FONT },

  // ── サポート「お問い合わせ」フォーム ──
  formField: { gap: 6 },
  formLabel: { color: COLOR.textSecondary, fontSize: 12, letterSpacing: 0.24, fontFamily: JP_SERIF_FONT },
  formInput: {
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: 12,
    color: COLOR.textPrimary,
    fontSize: 14,
    fontFamily: JP_SERIF_FONT,
    backgroundColor: 'rgba(34,36,69,0.30)',
  },
  formInputMulti: { height: 140, paddingTop: 12 },
  // 送信元メールアドレス（編集不可の表示専用行）。枠は formInput と同じにして
  // フォーム内の見た目を揃えつつ、地色を少し弱めて「編集できない」ことを示す
  formStatic: { backgroundColor: 'rgba(34,36,69,0.18)' },
  formStaticText: { color: COLOR.textSecondary, fontSize: 14, fontFamily: JP_SERIF_FONT },
  // お問い合わせの種類（プルダウン）
  formSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formSelectValue: { color: COLOR.textPrimary, fontSize: 14, fontFamily: JP_SERIF_FONT },
  formSelectChevron: { color: COLOR.textSecondary, fontSize: 12 },
  formSelectMenu: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: RADIUS.md,
    backgroundColor: '#14132a',
    overflow: 'hidden',
  },
  formSelectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
  },
  formError: { color: COLOR.badge, fontSize: 12.5, lineHeight: 19, letterSpacing: 0.24 },
  sentWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xl },
  sentBtn: { alignSelf: 'stretch', marginTop: SPACE.xl },

  // ── 退会確認モーダル ──
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(8,7,20,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.30)',
    backgroundColor: '#1B1838',
    padding: SPACE.lg,
    gap: SPACE.sm,
  },
  modalTitle: {
    color: COLOR.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.34,
    textAlign: 'center',
    fontFamily: JP_SERIF_FONT,
  },
  modalBody: {
    color: COLOR.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    letterSpacing: 0.26,
    fontFamily: JP_SERIF_FONT,
  },
  modalError: { color: COLOR.badge, fontSize: 12, textAlign: 'center', letterSpacing: 0.24, fontFamily: JP_SERIF_FONT },
  modalDeleteBtn: {
    marginTop: SPACE.sm,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.55)',
    backgroundColor: 'rgba(255,59,48,0.12)',
    alignItems: 'center',
  },
  modalDeleteLabel: { color: COLOR.badge, fontSize: 15, fontWeight: '700', letterSpacing: 0.3, fontFamily: JP_SERIF_FONT },
  modalCancelBtn: { paddingVertical: 12, alignItems: 'center' },
  modalCancelLabel: { color: COLOR.textPrimary, fontSize: 14, letterSpacing: 0.28, fontFamily: JP_SERIF_FONT },
});

export default DocumentScreen;
