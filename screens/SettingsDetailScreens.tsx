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
  Modal,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinear, RadialGradient as SvgRadial, Stop, Rect, Circle, Path } from 'react-native-svg';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';
import { NUM_FONT, JP_SERIF_FONT } from '../constants/fonts';
import { useT, useI18n, Lang } from '../lib/i18n';
import { useAuthUser } from '../lib/useAuthUser';
import { useTopInset, useBottomInset } from '../lib/safeArea';

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
  const navTop = useTopInset(8);

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
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* この画面だけ「‹」単体の戻る行＋大見出しの2段構成（モック準拠）。
            他の設定末端画面は SubHeader（戻る＋タイトルを同じ行に中央配置）のまま。 */}
        <View style={[s.acctNav, { paddingTop: navTop }]}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={s.back}>‹</Text>
          </Pressable>
        </View>
        <Text style={s.acctTitle}>{t('account.title')}</Text>

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
        <Text style={[s.paragraph, s.supportLead]}>{t('support.body')}</Text>

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

// 条文形式（利用規約・プライバシーポリシー）: 前文＋条ごとの見出し・本文
type DocSection = { heading?: string; body: string };
type TextDoc = { title: string; lead?: string; sections: DocSection[] };

// CREDITS（Special Thanks）: 役職ラベル＋名前の縦積み。
// hero=true は上部の大きな枠（ファウンダー）で、下に区切り線を引く。
type CreditEntry = { role: string; name: string; hero?: boolean };
const CREDITS: CreditEntry[] = [
  { role: 'FOUNDER / EXECUTIVE PRODUCER', name: 'Naoki Oka', hero: true },
  { role: 'PROJECT MANAGER', name: 'Tsubasa Miyazaki' },
  { role: 'ENGINEER', name: 'Satoru Miyosawa' },
  { role: 'DESIGNER', name: 'Naoki Oka' },
  { role: 'NAMING', name: 'Mizuki Yasuoka' },
  { role: 'ADVISOR', name: 'Sachi Nishimoto' },
  { role: 'SPECIAL THANKS', name: 'Donuts, Inc.' },
  { role: 'SPECIAL THANKS', name: 'Tokyo 7th Sisters' },
];

const TEXT_DOCS: Record<'terms' | 'privacy', TextDoc> = {
  terms: {
    title: 'FLUX RING 利用規約',
    lead:
      'この利用規約（以下「本規約」といいます）は、株式会社Numéro.8（以下「当社」といいます）が提供するアプリケーション「FLUX RING」（以下「本アプリ」といいます）および本アプリ上で提供される一切のサービス（以下総称して「本サービス」といいます）の利用条件を定めるものです。ユーザーは、本規約に同意のうえ、本サービスを利用するものとします。',
    sections: [
      {
        heading: '第1条（適用）',
        body:
          '1．本規約は、本サービスの利用に関する当社とユーザーとの間の権利義務関係を定めることを目的とし、ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されます。\n' +
          '2．当社が本アプリ上または当社ウェブサイト上で掲載する個別規定およびガイドラインは、本規約の一部を構成するものとします。個別規定の内容が本規約と矛盾する場合には、当該個別規定が優先して適用されます。\n' +
          '3．法人・店舗・施設等による商用利用に関する条件は、第9条に定める商用ライセンス契約または当社との間で別途締結するカスタム制作契約に定めるものとし、本規約は、原則として個人としての本サービスの利用に適用されます。',
      },
      {
        heading: '第2条（定義）',
        body:
          '本規約において使用する用語の定義は、以下のとおりとします。\n' +
          '（1）「本作品」とは、本アプリ上で提供される音源、調律設計、アートワーク、デジタルカードその他一切のコンテンツをいいます。\n' +
          '（2）「購入済作品」とは、ユーザーが当社所定の対価を支払い、利用許諾を受けた本作品をいいます。\n' +
          '（3）「限定版作品」とは、特定の企画またはコラボレーションの期間においてのみ販売される本作品をいいます。\n' +
          '（4）「商用ライセンス契約」とは、購入済作品およびVIPコンテンツを店舗・施設等において商用目的で再生することを許諾する契約であって、アプリ内課金による年間の定期利用決済（サブスクリプション）により締結されるものをいいます。\n' +
          '（5）「カスタム制作契約」とは、特定のユーザーのために本作品を個別に制作することを内容とする、当社と当該ユーザーとの間で本アプリ外において別途締結される契約をいいます。\n' +
          '（6）「VIPコンテンツ」とは、商用ライセンス契約またはカスタム制作契約を締結したユーザーに対してのみ提供されるコンテンツおよび機能をいいます。\n' +
          '（7）「ストア」とは、Apple App Store、Google Play その他本アプリの配信プラットフォームをいいます。',
      },
      {
        heading: '第3条（アカウント）',
        body:
          '1．ユーザーは、本サービスの利用にあたり、当社所定の方法（メールアドレスによる登録、またはGoogle・Apple等の外部アカウントによる認証を含みます）によりアカウントを作成するものとします。\n' +
          '2．ユーザーは、自己のアカウントに関する情報を自らの責任において管理するものとし、これを第三者に利用させ、または貸与・譲渡・売買してはなりません。\n' +
          '3．アカウント情報の管理不十分、または第三者による使用等に起因してユーザーに生じた損害については、当社に故意または重過失がある場合を除き、ユーザーが負担するものとします。\n' +
          '4．ユーザーは、当社所定の手続によりアカウントを削除することができます。アカウントの削除、本アプリのアンインストール、または端末の変更等を行った場合であっても、ストア経由で登録された定期利用決済（サブスクリプション）は自動的に解約されません。ユーザーは、自らの責任において、各ストアの管理画面（OSの設定画面等）から解約手続を行うものとします。アカウント削除後の購入済作品の取扱いは、第5条第4項に定めるとおりとします。',
      },
      {
        heading: '第4条（未成年者の利用）',
        body:
          '1．未成年者が本サービスを利用する場合には、親権者その他の法定代理人の同意を得たうえで利用するものとします。\n' +
          '2．未成年者が本作品を購入する場合には、あらかじめ法定代理人の同意を得るものとします。\n' +
          '3．未成年者が、法定代理人の同意を得たと偽り、または自己が成年であると偽って本サービスを利用した場合その他詐術を用いた場合、当該行為に関する法律行為を取り消すことができないことがあります。',
      },
      {
        heading: '第5条（本作品の利用許諾）',
        body:
          '1．当社は、購入済作品について、ユーザーに対し、私的かつ非商用の目的の範囲内で、期間の定めなくこれを再生・視聴するための、非独占的かつ譲渡不能・再許諾不能の利用権を許諾します。\n' +
          '2．本作品の購入は、前項に定める利用権の取得を意味するものであり、本作品にかかる著作権その他の知的財産権がユーザーに移転するものではありません。\n' +
          '3．店舗・施設・イベント等における営利目的での再生その他の商用利用を行う場合には、第9条に定める商用ライセンス契約またはカスタム制作契約を締結する必要があります。\n' +
          '4．アカウントの削除または本サービスの提供終了後においても、ユーザーがそれ以前に適法にダウンロードした購入済作品の音源ファイルについては、第1項に定める範囲内で継続して利用することができます。',
      },
      {
        heading: '第6条（購入・決済）',
        body:
          '1．本作品の購入にかかる決済は、ストアが提供する決済手段（アプリ内課金）により行われるものとし、決済に関する事項については、各ストアの利用規約およびポリシーが適用されます。\n' +
          '2．本作品の価格は、本アプリ上に表示される価格（消費税込み）とします。\n' +
          '3．デジタルコンテンツという商品の性質上、購入手続の完了後における返金およびキャンセルは、各ストアのポリシーに基づき認められる場合を除き、行うことができません。\n' +
          '4．ユーザーは、機種変更等の場合、本アプリの「購入の復元」機能により、同一のアカウントおよび同一のストアアカウントに紐づく購入済作品を復元することができます。\n' +
          '5．本サービスの取引条件（販売価格、支払時期、提供時期等）に関する詳細は、本アプリ内に別途掲示する「特定商取引法に基づく表記」に定めるとおりとします。',
      },
      {
        heading: '第7条（無料試聴）',
        body:
          '1．当社は、本作品の一部について、購入前の試聴（プレビュー）を無償で提供します。\n' +
          '2．試聴は、本作品の購入判断に資するために提供されるものであり、当社は、その提供内容および提供範囲をいつでも変更することができます。',
      },
      {
        heading: '第8条（限定版作品）',
        body:
          '1．限定版作品は、当社が定める特定の期間または企画においてのみ販売されるものとし、販売終了後の再販売は行いません。\n' +
          '2．限定版作品はデジタル形式でのみ提供され、特段の表示がない限り、物理的な物品は含まれません。\n' +
          '3．限定版作品の販売期間、内容その他の条件は、販売の都度、本アプリ上に表示します。',
      },
      {
        heading: '第9条（商用ライセンス契約およびVIPコンテンツ）',
        body:
          '1．VIPコンテンツは、商用ライセンス契約またはカスタム制作契約を締結したユーザーに対してのみ提供されます。これらの契約を締結していないユーザーは、VIPコンテンツを利用すること、および本サービスを商用目的で利用することができません。\n' +
          '2．商用ライセンス契約は、アプリ内課金による年間の定期利用決済により成立し、契約期間満了日までにユーザーが解約手続を行わない限り、1年単位で自動的に更新されます。解約手続は、各ストアの管理画面（OSの設定画面等）から行うものとします。\n' +
          '3．契約期間の途中で商用ライセンス契約を解約した場合であっても、既に支払われた対価について、日割または月割による返金は行いません。\n' +
          '4．商用ライセンス契約に基づく許諾は、契約が紐づく1アカウント単位とします。ユーザーは、当該アカウントにおいて、購入済作品およびVIPコンテンツを、店舗・施設等において商用目的で再生することができます。ただし、許諾される利用は、本アプリの正規の機能を用いた直接再生に限られ、音源の抽出、複製、他の再生機器もしくはシステムへの転送その他これらに類する行為を行うことはできません。\n' +
          '5．商用ライセンス契約が終了した場合、前項に定める商用目的での再生に係る許諾およびVIPコンテンツの利用権は消滅します。ただし、第5条に定める購入済作品の私的利用に係る利用権は存続します。\n' +
          '6．カスタム制作契約の内容および条件は、当該契約の定めによるものとし、当該契約の定めが本規約に優先して適用されます。カスタム制作契約に基づき制作された本作品の商用目的での再生の可否および条件についても、同様とします。',
      },
      {
        heading: '第10条（利用データの取得）',
        body:
          '1．当社は、本サービスの提供・維持・改善、コンテンツの企画・制作、不正利用の防止その他当社プライバシーポリシーに定める目的のため、ユーザーごとの本作品の再生履歴その他本サービスの利用状況に関する情報を取得します。\n' +
          '2．前項の情報の取扱いについては、当社プライバシーポリシーの定めによります。',
      },
      {
        heading: '第11条（知的財産権）',
        body:
          '1．本アプリおよび本作品に関する著作権（著作権法第27条および第28条に定める権利を含みます）その他一切の知的財産権は、当社に帰属します。なお、本作品の著作者人格権は、各作品の著作者に留保されています。\n' +
          '2．「FLUX RING」の名称、ロゴその他当社が使用する標章に関する権利は当社に帰属し、ユーザーは、当社の事前の承諾なくこれらを使用することはできません。\n' +
          '3．本規約に基づく本サービスの提供は、ユーザーに対し、第5条に定める利用権を超えるいかなる権利の譲渡または許諾をも意味するものではありません。',
      },
      {
        heading: '第12条（カード画像の共有）',
        body:
          '1．ユーザーは、本作品のデジタルカード画像（スクリーンショットを含む静止画に限ります）を、非商用の目的に限り、SNSその他の媒体において共有・掲載することができます。\n' +
          '2．前項の共有にあたり、ユーザーは、当該画像を改変してはならず、また、自己の著作物であるかのような表示その他出所を誤認させる表示をしてはなりません。\n' +
          '3．本作品の音源（その全部または一部を問わず、録音・録画によるものを含みます）を共有・公開・送信することは、方法のいかんを問わず、行うことができません。\n' +
          '4．当社は、共有された画像の掲載態様が不適切であると合理的に判断した場合、ユーザーに対しその削除を求めることができ、ユーザーはこれに従うものとします。ユーザーが本条に違反したことにより第三者との間で紛争が生じた場合、ユーザーの責任と費用においてこれを解決するものとし、当社は一切の責任を負いません。',
      },
      {
        heading: '第13条（禁止事項）',
        body:
          '1．ユーザーは、本サービスの利用にあたり、以下の各号のいずれかに該当する行為をしてはなりません。\n' +
          '（1）法令または公序良俗に違反する行為\n' +
          '（2）本作品の複製、翻案、改変、公衆送信、頒布、貸与、販売その他第5条に定める利用権の範囲を超える利用（私的使用のための複製として著作権法上認められる場合を除きます）\n' +
          '（3）本作品の音源の抽出、録音、変換その他これらに類する行為\n' +
          '（4）本アプリのリバースエンジニアリング、逆コンパイル、逆アセンブルその他の解析行為\n' +
          '（5）本サービスの運営を妨害する行為、不正アクセス、または技術的保護手段を回避する行為\n' +
          '（6）アカウントまたは購入済作品の利用権を第三者に譲渡・貸与・売買する行為\n' +
          '（7）本作品を商用目的で利用する行為（商用ライセンス契約またはカスタム制作契約に基づく場合を除きます）\n' +
          '（8）当社、本作品の著作者その他の第三者の権利または利益を侵害する行為\n' +
          '（9）その他当社が不適切と合理的に判断する行為\n' +
          '2．ユーザーが前項に違反した場合、当社は、事前の通知なく、本サービスの利用の全部もしくは一部の停止、またはアカウントの削除を行うことができます。',
      },
      {
        heading: '第14条（非保証）',
        body:
          '1．本作品は音楽作品として提供されるものであり、当社は、本作品の利用により特定の効果または効能（心身の状態に関する変化を含みます）が生じることを保証するものではありません。\n' +
          '2．本作品は、医療行為またはこれに類する行為を代替するものではありません。\n' +
          '3．当社は、本サービスがすべての端末およびOS環境において正常に動作すること、ならびに本サービスに中断、エラーその他の不具合が生じないことを保証するものではありません。',
      },
      {
        heading: '第15条（本サービスの変更・中断・終了）',
        body:
          '1．当社は、ユーザーへの事前の通知をもって、本サービスの内容を変更し、または提供を終了することができます。ただし、緊急やむを得ない場合には、事前の通知を行わないことがあります。\n' +
          '2．当社は、システムの保守点検、通信障害、天災地変その他やむを得ない事由がある場合、本サービスの全部または一部の提供を一時的に中断することができます。\n' +
          '3．本サービスの提供を終了する場合、当社は、合理的な期間をおいて事前に告知するとともに、購入済作品の音源ファイルのダウンロード機会の確保その他ユーザーの利益に配慮した措置を講ずるよう努めます。\n' +
          '4．本条に基づく措置によりユーザーに損害が生じた場合の当社の責任は、第16条の定めに従います。',
      },
      {
        heading: '第16条（免責・損害賠償）',
        body:
          '1．当社は、当社に故意または重過失がある場合を除き、本サービスに関連してユーザーに生じた損害について、賠償の責任を負いません。\n' +
          '2．当社が賠償責任を負う場合であっても、当社に故意または重過失があるときを除き、賠償額は、当該損害の発生した日から遡って12か月の間にユーザーが当社に支払った対価の総額を上限とします。\n' +
          '3．前二項の定めは、消費者契約法その他の強行法規の適用を排除するものではなく、これらの法規により無効とされる範囲においては適用されません。',
      },
      {
        heading: '第17条（反社会的勢力の排除）',
        body:
          '1．ユーザーは、自己が、暴力団、暴力団員、暴力団準構成員、暴力団関係企業、総会屋その他これらに準ずる者（以下「反社会的勢力」といいます）に該当しないこと、および反社会的勢力と社会的に非難されるべき関係を有しないことを表明し、保証するものとします。\n' +
          '2．ユーザーが前項に違反した場合、当社は、事前の通知なく、本サービスの利用を停止し、またはアカウントを削除することができます。これによりユーザーに損害が生じた場合であっても、当社は一切の責任を負いません。',
      },
      {
        heading: '第18条（本規約の変更）',
        body:
          '1．本規約は、民法第548条の2第1項に定める定型約款に該当します。当社は、民法第548条の4の規定に基づき、以下の各号のいずれかに該当する場合、本規約を変更することができます。\n' +
          '（1）本規約の変更が、ユーザーの一般の利益に適合するとき\n' +
          '（2）本規約の変更が、契約をした目的に反せず、かつ、変更の必要性、変更後の内容の相当性その他の変更に係る事情に照らして合理的なものであるとき\n' +
          '2．当社は、本規約を変更する場合、その効力発生日の相当期間前までに、変更後の本規約の内容および効力発生日を、本アプリ上への表示その他当社所定の方法により周知します。',
      },
      {
        heading: '第19条（権利義務の譲渡禁止）',
        body:
          'ユーザーは、当社の書面による事前の承諾なく、本規約上の地位または本規約に基づく権利もしくは義務を、第三者に譲渡し、または担保に供することはできません。',
      },
      {
        heading: '第20条（分離可能性）',
        body:
          '本規約のいずれかの条項またはその一部が、法令等により無効または執行不能と判断された場合であっても、本規約のその余の条項および一部が無効または執行不能と判断された条項の残りの部分は、継続して完全に効力を有するものとします。',
      },
      {
        heading: '第21条（配信プラットフォームに関する特則）',
        body:
          '1．ユーザーは、本規約が当社とユーザーとの間でのみ締結されるものであり、Apple Inc.、Google LLC等の本アプリの配信プラットフォーム提供者（以下「プラットフォーマー」といいます）との間で締結されるものではないことを確認します。\n' +
          '2．本サービスの提供、保守およびサポートに関する一切の責任は当社が負うものとし、プラットフォーマーはかかる義務を一切負いません。\n' +
          '3．プラットフォーマーは、本規約の第三者受益者として、ユーザーに対し本規約を執行する権利を有します。',
      },
      {
        heading: '第22条（準拠法・管轄）',
        body:
          '1．本規約の準拠法は日本法とし、本規約は日本法に従って解釈されるものとします。\n' +
          '2．本サービスに関して当社とユーザーとの間に生じた紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。',
      },
      {
        heading: '附則',
        body:
          '制定日：2026年7月24日\n' +
          '株式会社Numéro.8',
      },
    ],
  },
  privacy: {
    title: 'プライバシーポリシー',
    lead:
      '株式会社Numéro.8（以下「当社」といいます）は、当社が提供するスマートフォンアプリケーション「FLUX RING」（以下「本アプリ」といいます）における利用者（以下「ユーザー」といいます）の情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。',
    sections: [
      {
        heading: '事業者の表示',
        body:
          '制定日：2026年7月24日\n' +
          '会社名：株式会社Numéro.8\n' +
          '代表取締役：岡 直樹\n' +
          '所在地：〒145-0071　東京都大田区田園調布4-44-8',
      },
      {
        heading: '第1条（適用範囲）',
        body:
          '1. 本ポリシーは、本アプリの利用に関して適用されます。\n' +
          '2. 当社が本アプリ以外のウェブサイトまたはサービスにおいて取得する情報の取扱いについては、当該ウェブサイトまたはサービスにおいて別途定めるところによります。',
      },
      {
        heading: '第2条（取得する情報）',
        body:
          '当社は、本アプリの提供にあたり、以下の情報を取得します。\n' +
          '1. アカウント情報\n' +
          '　メールアドレス、ならびにGoogleアカウントまたはApple IDによるログインを利用する場合に各サービスから提供される識別子および登録情報のうち当社が受領するもの\n' +
          '2. 購入に関する情報\n' +
          '　購入した作品の履歴、購入日時、購入の復元に必要な情報。なお、決済はApple Inc.またはGoogle LLCが提供するアプリ内課金により処理され、クレジットカード番号その他の決済手段に関する情報を当社が取得することはありません。\n' +
          '3. 再生ログ\n' +
          '　ユーザーごとの作品の再生に関する記録（再生した作品、再生日時、再生回数、再生時間等）\n' +
          '4. 端末情報・識別子\n' +
          '　端末の機種名、OSの種類およびバージョン、言語設定、アプリのバージョン、プッシュ通知の配信に必要なデバイストークン、その他端末に関する情報\n' +
          '5. 利用状況・障害に関する情報\n' +
          '　本アプリの操作履歴、画面遷移、クラッシュ（強制終了）発生時の技術情報その他本アプリの利用状況に関する情報\n' +
          '6. お問い合わせに関する情報\n' +
          '　ユーザーが当社に問い合わせを行う際に提供される氏名、メールアドレス、問い合わせ内容',
      },
      {
        heading: '第3条（利用目的）',
        body:
          '当社は、取得した情報を以下の目的で利用します。\n' +
          '1. 本アプリの提供、ユーザー認証、購入した作品の管理および購入の復元のため\n' +
          '2. 再生ログに基づく作品の推薦および表示順の制御のため\n' +
          '3. 本アプリの品質改善、不具合の解析および新機能の開発のため\n' +
          '4. お知らせその他の通知（プッシュ通知を含みます）の配信のため\n' +
          '5. お問い合わせへの対応のため\n' +
          '6. 利用規約に違反する行為への対応その他本アプリの適正な運営のため\n' +
          '7. 法令に基づく義務の履行のため\n' +
          '\n' +
          '当社は、取得した情報を、第三者への広告配信を目的として他社のアプリケーションまたはウェブサイトを横断してユーザーを追跡する目的（トラッキング）で利用することはありません。\n' +
          '\n' +
          '当社は、上記の利用目的の達成に必要な範囲を超えて、取得した情報を利用しません。利用目的を変更する場合は、変更前の利用目的と関連性を有すると合理的に認められる範囲でこれを行い、本アプリ内またはウェブサイト上での掲示により通知または公表します。',
      },
      {
        heading: '第4条（外部送信される情報）',
        body:
          '当社は、本アプリの利用状況の解析および品質改善のため、以下の外部事業者が提供する情報収集モジュールを本アプリに組み込んでいます。これにより、ユーザーの端末から以下の情報が各事業者に送信されます。\n' +
          '\n' +
          '1. Google Analytics for Firebase（提供者：Google LLC）\n' +
          '　・送信される情報：端末情報、識別子、本アプリの利用状況（画面遷移、操作履歴等）\n' +
          '　・利用目的：本アプリの利用状況の解析および品質改善\n' +
          '　・提供者のプライバシーポリシー：https://policies.google.com/privacy\n' +
          '2. Firebase Crashlytics（提供者：Google LLC）\n' +
          '　・送信される情報：端末情報、クラッシュ発生時の技術情報\n' +
          '　・利用目的：不具合の解析および品質改善\n' +
          '　・提供者のプライバシーポリシー：https://policies.google.com/privacy\n' +
          '3. プッシュ通知基盤（Apple Push Notification service／Firebase Cloud Messaging）（提供者：Apple Inc.／Google LLC）\n' +
          '　・送信される情報：デバイストークン、端末情報\n' +
          '　・利用目的：プッシュ通知の配信',
      },
      {
        heading: '第5条（第三者提供）',
        body:
          '当社は、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。\n' +
          '1. ユーザー本人の同意がある場合\n' +
          '2. 法令に基づく場合\n' +
          '3. 人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき\n' +
          '4. 国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき\n' +
          '5. 合併その他の事由による事業の承継に伴って個人情報が提供される場合',
      },
      {
        heading: '第6条（外国にある第三者への提供・委託）',
        body:
          '1. 当社は、第4条に定める情報収集モジュールの利用およびシステム基盤の運用に伴い、Google LLC（米国）その他外国に所在する事業者が管理するサーバーにおいてユーザーの情報を取り扱うことがあります。\n' +
          '2. 米国における個人情報の保護に関する制度についての情報は、個人情報保護委員会のウェブサイト（https://www.ppc.go.jp/）において公表されています。\n' +
          '3. 当社は、外国にある第三者に個人データの取扱いを委託する場合、当該第三者において個人情報保護法に相当する水準の安全管理措置が講じられるよう、契約その他の方法により必要な措置を講じます。',
      },
      {
        heading: '第7条（委託）',
        body:
          '当社は、利用目的の達成に必要な範囲において、個人情報の取扱いの全部または一部を第三者（クラウドサービス事業者、解析基盤の提供事業者等）に委託することがあります。この場合、当社は、委託先を適切に選定し、委託先における個人情報の安全管理が図られるよう、必要かつ適切な監督を行います。',
      },
      {
        heading: '第8条（安全管理措置）',
        body:
          '当社は、取り扱う個人情報の漏えい、滅失または毀損の防止その他の安全管理のため、以下の措置を講じます。\n' +
          '1. 個人情報の取扱いに関する規律の整備\n' +
          '2. 個人情報を取り扱う従業者の限定および教育（組織的・人的安全管理措置）\n' +
          '3. 個人情報を取り扱う機器・電子媒体等の盗難・紛失の防止（物理的安全管理措置）\n' +
          '4. アクセス制御、通信の暗号化その他の技術的安全管理措置\n' +
          '5. 外国において個人データを取り扱う場合における、当該国の制度を踏まえた安全管理措置\n' +
          '\n' +
          '安全管理措置の内容に関するお問い合わせは、第12条の窓口までご連絡ください。',
      },
      {
        heading: '第9条（保有個人データの開示・訂正・利用停止等）',
        body:
          '1. ユーザーは、当社に対し、個人情報保護法の定めに従い、当社が保有する自己の個人データについて、開示、訂正・追加・削除、利用停止・消去、第三者提供の停止および第三者提供記録の開示を請求することができます。\n' +
          '2. 前項の請求は、第12条の窓口にて受け付けます。当社は、請求者が本人であることを確認したうえで、法令の定めに従い、遅滞なく対応します。\n' +
          '3. 開示等の請求にあたっては、法令の定める範囲内で手数料をいただく場合があります。',
      },
      {
        heading: '第10条（アカウントの削除および情報の消去）',
        body:
          'ユーザーがアカウントの削除を希望する場合、本アプリ内の手続または第12条の窓口への連絡により、これを行うことができます。当社は、アカウント削除後、法令上保存が義務付けられる情報および紛争対応等のために合理的に必要な情報を除き、当該ユーザーの個人情報を遅滞なく消去します。',
      },
      {
        heading: '第11条（未成年のユーザーについて）',
        body:
          '未成年のユーザーは、親権者その他の法定代理人の同意を得たうえで本アプリを利用するものとします。',
      },
      {
        heading: '第12条（お問い合わせ窓口）',
        body:
          '本ポリシーおよび当社の個人情報の取扱いに関するお問い合わせは、以下の窓口までお願いします。\n' +
          '\n' +
          '株式会社Numéro.8（代表取締役：岡 直樹）\n' +
          '所在地：〒145-0071 東京都大田区田園調布4-44-8\n' +
          '個人情報お問い合わせ窓口\n' +
          'メールアドレス：support@numero8.jp',
      },
      {
        heading: '第13条（本ポリシーの改定）',
        body:
          '1. 当社は、法令の改正、事業内容の変更その他の事情により、本ポリシーを改定することがあります。\n' +
          '2. 改定後の本ポリシーは、本アプリ内またはウェブサイト上に掲示した時点から効力を生じます。ただし、法令上ユーザーの同意が必要となる内容の改定については、当社所定の方法によりユーザーの同意を取得します。\n' +
          '\n' +
          '以上',
      },
    ],
  },
};

// ─────────────────────────────────────────────
// 特定商取引法に基づく表記（専用データ・専用トンマナ）
// ─────────────────────────────────────────────

// list項目は文字列（バッジなし）または { text, badge } の混在を許容する。
// badge/badgeInText は同じ意味（項目末尾に添えるバッジ）の別名として扱う。
type TokushoListItem = string | { text: string; badge?: string; badgeInText?: string };

type TokushoRow = {
  label: string;
  value?: string;
  /** value の直後に添えるバッジ（例: 仮置きのメールアドレス） */
  badge?: string;
  list?: TokushoListItem[];
  note?: string;
  /** note の直後に添えるバッジ */
  badgeInNote?: string;
};

export const tokushoData: TokushoRow[] = [
  {
    label: '販売価格',
    list: [
      '楽曲作品（通常）：2,500円（税込）',
      'コラボレーション限定版：6,000円（税込）',
      '商業ライセンス（法人向け・年間）：42,000円（税込）',
      'カスタム制作：500,000円（税込）〜（個別お見積り）',
    ],
    note: '各作品・各プランの販売価格は、アプリ内および各販売ページに表示します。',
  },
  {
    label: '商品代金以外の必要料金',
    value: 'アプリのダウンロードおよびご利用に必要な通信料は、お客様のご負担となります。',
    note: 'カスタム制作に付随する物理カードの配送料は、お見積り時に個別にご案内します。',
    badgeInNote: '要確認',
  },
  {
    label: '支払方法',
    list: [
      {
        text: '楽曲作品・コラボレーション限定版・商業ライセンス：App Store／Google Play のアプリ内課金（各プラットフォームが提供する決済手段）。商業ライセンスは自動更新のサブスクリプションです。',
      },
      {
        text: 'カスタム制作：当社との個別契約に基づく銀行振込',
        badge: '仮置き',
      },
    ],
  },
  {
    label: '支払時期',
    list: [
      {
        text: '楽曲作品・コラボレーション限定版：購入手続き完了時にお支払いが確定します。',
      },
      {
        text: '商業ライセンス：初回お申し込み時に課金され、以後は1年ごとの更新日に自動的に課金されます。',
      },
      {
        text: 'カスタム制作：個別契約に定める時期（請求書発行後14日以内）',
        badgeInText: '仮置き',
      },
    ],
  },
  {
    label: '引渡時期',
    list: [
      'アプリ内購入：決済完了後、直ちにアプリ内でご利用いただけます。',
      'カスタム制作：個別契約に定める納期によります。',
    ],
  },
  {
    label: '商業ライセンスの\n契約期間・解約',
    value:
      '契約期間は1年間で、解約のお手続きがない限り、同一条件で自動的に更新されます。更新を停止する場合は、更新日の24時間前までに、ご利用の端末のOS（App Store／Google Play）のサブスクリプション設定から解約のお手続きを行ってください。解約後も、既にお支払いいただいた契約期間の満了日まではご利用いただけます。',
  },
  {
    label: '返品・キャンセル',
    value:
      'デジタルコンテンツという商品の性質上、購入手続き完了後の返品・キャンセル・返金はお受けできません。商業ライセンスの中途解約による残期間の日割返金も行いません。アプリ内課金に関する返金の取り扱いは、App Store／Google Play 各プラットフォームの規約に準じます。',
    note: 'カスタム制作の解約・キャンセルについては、個別契約の定めによります。',
  },
  { label: '動作環境', value: '対応OSおよび推奨環境は、App Store／Google Play の各ストアページに記載します。' },
  { label: '特別な販売条件', value: '一部の作品は、販売期間または提供数を限定する場合があります。条件は各販売ページに表示します。' },
  // 会社情報は取引条件のあとに置く（上部に出るデグレの再発防止）
  { label: '販売業者', value: '株式会社Numéro.8' },
  { label: '代表者・販売責任者', value: '岡 直樹' },
  { label: '所在地', value: '〒145-0071 東京都大田区田園調布4-44-8' },
  {
    label: '電話番号',
    value: 'ご請求があった場合、遅滞なく開示いたします。お問い合わせは下記メールアドレスまでお願いいたします。',
  },
  { label: 'メールアドレス', value: 'support@fluxring.example', badge: '仮置き' },
];

export const footerCompany = '株式会社Numéro.8';

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
  return (
    <View style={tk.root}>
      <StatusBar barStyle="light-content" backgroundColor={TK.bg} />
      <SubHeader title={t('doc.tokushoho')} onBack={onBack} />
      <ScrollView contentContainerStyle={tk.body} showsVerticalScrollIndicator={false}>
        {tokushoData.map((row, i) => (
          <TokushoRowView key={`${row.label}-${i}`} row={row} />
        ))}
        <Text style={tk.foot}>{footerCompany}</Text>
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
  root: { flex: 1, backgroundColor: TK.bg },
  body: { paddingHorizontal: 24, paddingBottom: 96 },
  row: { paddingVertical: 19, borderBottomWidth: 1, borderBottomColor: TK.line },
  dt: { fontSize: 13, color: TK.sub, letterSpacing: 0.6, marginBottom: 6, fontFamily: JP_SERIF_FONT },
  dd: { gap: 4 },
  // 数字が並ぶため EB Garamond（等幅寄りの数字グリフ）を当てる。和文はOSフォールバック。
  // 視認性向上のため 14 → 16（lineHeight は 1.9 倍のまま）
  ddText: { fontSize: 16, color: TK.ink, lineHeight: 30.4, fontFamily: NUM_FONT },
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

// CREDITS 画面固有のカラー定義（添付デザイン仕様に準拠。他画面のトンマナとは独立）
const CR = {
  page: '#0E0C20',
  deepest: '#05040c',
  text: '#ECEEF7',
  sub: '#9498BE',
  tertiary: 'rgba(236, 238, 247, 0.30)',
  cyan: '#60CEE0',
  violet: '#7C62D6',
  border: '#3A3D72',
} as const;

// 背景: 中央上部が明るい放射状グラデーション＋3つのソフトなオーラ（blur近似はエッジが
// 透明に落ちる radial gradient で代替。RN には CSS の filter:blur 相当がないため）
const CreditsBackdrop: React.FC<{ w: number; h: number }> = ({ w, h }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgRadial id="crbg" cx="50%" cy="0%" r="85%">
          <Stop offset="0.28" stopColor="#15132e" />
          <Stop offset="0.55" stopColor="#0c0a1f" />
          <Stop offset="1" stopColor="#07060f" />
        </SvgRadial>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#crbg)" />
    </Svg>
    <Svg width={300} height={300} style={{ position: 'absolute', left: -80, top: -60 }}>
      <Defs>
        <SvgRadial id="crb1" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#5868E2" stopOpacity={0.2} />
          <Stop offset="1" stopColor="#5868E2" stopOpacity={0} />
        </SvgRadial>
      </Defs>
      <Circle cx={150} cy={150} r={150} fill="url(#crb1)" />
    </Svg>
    <Svg width={260} height={260} style={{ position: 'absolute', right: -90, top: 280 }}>
      <Defs>
        <SvgRadial id="crb2" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={CR.cyan} stopOpacity={0.1} />
          <Stop offset="1" stopColor={CR.cyan} stopOpacity={0} />
        </SvgRadial>
      </Defs>
      <Circle cx={130} cy={130} r={130} fill="url(#crb2)" />
    </Svg>
    <Svg width={220} height={220} style={{ position: 'absolute', left: 20, bottom: -80 }}>
      <Defs>
        <SvgRadial id="crb3" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={CR.violet} stopOpacity={0.14} />
          <Stop offset="1" stopColor={CR.violet} stopOpacity={0} />
        </SvgRadial>
      </Defs>
      <Circle cx={110} cy={110} r={110} fill="url(#crb3)" />
    </Svg>
  </View>
);

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

  const [founder, ...crew] = CREDITS;

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
          {crew.map((c, i) => (
            <View key={`${c.role}-${c.name}-${i}`} style={cs.crewRow}>
              <Text style={cs.roleLabel}>{c.role}</Text>
              <Text style={cs.personName}>{c.name}</Text>
            </View>
          ))}
        </View>

        <View style={cs.footerWrap}>
          <Text style={cs.footerMark}>FLUX RING</Text>
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
    fontSize: 9,
    letterSpacing: 2.7,
    textTransform: 'uppercase',
    fontFamily: NUM_FONT,
  },
  footerMarkDim: { opacity: 0.55 },
});

export const DocumentScreen: React.FC<{ kind: DocKind; onBack: () => void }> = ({
  kind,
  onBack,
}) => {
  const t = useT();

  // Special Thanks は専用の CREDITS 画面
  if (kind === 'thanks') return <CreditsScreen onBack={onBack} />;

  // 特定商取引法に基づく表記も専用画面（独自データ構造・独自トンマナ）
  if (kind === 'tokushoho') return <TokushohoScreen onBack={onBack} />;

  // タイトルは i18n。本文（法務）は現状 日本語のまま（別途英訳予定）。
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />
      <SubHeader title={t(`doc.${kind}`)} onBack={onBack} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {TEXT_DOCS[kind].lead && <Text style={s.docLead}>{TEXT_DOCS[kind].lead}</Text>}
        {TEXT_DOCS[kind].sections.map((sec, i) => (
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

const APP_VERSION = '1.0.0';

/**
 * 設定「情報」。CREDITS / 利用規約 / プライバシー / 特商法 を束ねる中間画面。
 * 設定リストを7項目に保つため、読み物4点はここへ集約する。
 * 遷移は自前の state で持つ（App 側の settingsDetail を1段に保てるので、
 * 読み物から戻ったときに設定直下ではなくこの画面へ正しく戻れる）。
 */
export const InfoScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const t = useT();
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
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />
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
  root: { flex: 1, backgroundColor: COLOR.bg },

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
  back: { color: COLOR.textBack, fontSize: 20, letterSpacing: 0.6 },
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

  // ── アカウント画面専用（モック準拠の2段ヘッダー＋カード型リスト）──
  acctNav: { paddingHorizontal: SPACE.lg, paddingBottom: 2 },
  acctTitle: {
    color: COLOR.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.48,
    paddingHorizontal: SPACE.lg,
    marginTop: SPACE.md,
    marginBottom: SPACE.md,
    fontFamily: JP_SERIF_FONT,
  },
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
  rowText: { flex: 1, gap: 3 },
  rowLabel: { color: COLOR.textPrimary, fontSize: 15, letterSpacing: 0.3, fontFamily: JP_SERIF_FONT },
  // メールアドレス表示のみに使う欧文行（SupportScreen）
  rowSub: { color: COLOR.textSecondary, fontSize: 12, letterSpacing: 0.24, fontFamily: NUM_FONT },
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
  docHeading: { color: COLOR.textPrimary, fontSize: 16, fontWeight: '700', letterSpacing: 0.32, fontFamily: JP_SERIF_FONT },
  // 視認性向上のため 14 → 16
  docBody: { color: COLOR.textPrimary, fontSize: 16, lineHeight: 29, letterSpacing: 0.32, fontFamily: JP_SERIF_FONT },
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
