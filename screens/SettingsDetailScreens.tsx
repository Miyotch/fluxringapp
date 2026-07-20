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

// 条文形式（利用規約・プライバシーポリシー）: 前文＋条ごとの見出し・本文
type DocSection = { heading?: string; body: string };
type TextDoc = { title: string; lead?: string; sections: DocSection[] };

// 表形式（特定商取引法に基づく表記）
type TableDoc = { title: string; rows: { label: string; value: string }[] };

const TEXT_DOCS: Record<'thanks' | 'terms' | 'privacy', TextDoc> = {
  thanks: {
    title: 'Special Thanks',
    sections: [
      {
        heading: 'FluxRing Credits',
        body:
          'Presented by\n' +
          '株式会社Numéro.8　岡 直樹\n\n' +
          'Project Manager\n' +
          '株式会社AppTalentHub　宮崎 翼\n\n' +
          'Developer\n' +
          '株式会社Sparkle vision　三代澤 哲',
      },
      {
        body:
          'FLUX RING は、多くの方の協力で形になりました。\n\n' +
          '・楽曲 / 音響：岡 ナオキ\n' +
          '・ビジュアルディレクション：株式会社ヌメロ.8\n' +
          '・テスト協力：初期リスナーの皆さま\n\n' +
          'この場をかりて、心より感謝申し上げます。',
      },
    ],
  },
  terms: {
    title: 'FluxRing 利用規約',
    lead:
      'この利用規約（以下「本規約」といいます。）は、株式会社Numéro.8（以下「当社」といいます。）が' +
      '提供する音楽配信アプリサービス「FluxRing」（以下「本サービス」といいます。）の利用条件を定める' +
      'ものです。登録ユーザーの皆さま（以下「ユーザー」といいます。）には、本規約に従って本サービスを' +
      'ご利用いただきます。',
    sections: [
      {
        heading: '第1条（適用）',
        body:
          '1. 本規約は、ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されるものとします。\n' +
          '2. 当社が本サービスに関し、本規約のほか、各種の規定（以下「個別規定」といいます。）を定めた場合、' +
          'これらは本規約の一部を構成するものとします。本規約の規定が個別規定の規定と異なる場合には、' +
          '個別規定の規定が優先して適用されるものとします。',
      },
      {
        heading: '第2条（利用登録およびアカウント管理）',
        body:
          '1. 本サービスにおいては、登録希望者が本規約に同意の上、当社の定める方法によって利用登録を申請し、' +
          '当社がこれを承認することによって、利用登録が完了するものとします。\n' +
          '2. ユーザーは、自己の責任において、本サービスのアカウントおよびパスワードを適切に管理・保管する' +
          'ものとします。\n' +
          '3. ユーザーは、いかなる場合にも、アカウントおよびパスワードを第三者に譲渡または貸与し、もしくは' +
          '第三者と共用することはできません。当社は、アカウントとパスワードの組み合わせが登録情報と一致して' +
          'ログインされた場合には、そのアカウントを登録しているユーザー自身による利用とみなします。',
      },
      {
        heading: '第3条（利用料金および支払方法）',
        body:
          '1. ユーザーは、本サービスの有料プランを利用する場合、当社が定め、本サービス上または公式サイトに' +
          '表示する利用料金を、当社が指定する支払方法により支払うものとします。\n' +
          '2. 本サービスの決済は、Apple Inc.、Google LLC等が提供する決済プラットフォームを利用して行われます。\n' +
          '3. 利用料金は、支払期日までに支払われない場合、当社は事前の通知なく本サービスの提供を停止、または' +
          '利用登録を抹消することができるものとします。\n' +
          '4. 既に支払われた利用料金については、法令に定める場合を除き、理由の如何を問わず返金いたしません。',
      },
      {
        heading: '第4条（著作権・知的財産権）',
        body:
          '1. 本サービスを通じて提供されるすべての音楽、音声、歌詞、画像、文章、プログラム等のコンテンツ' +
          '（以下「本コンテンツ」といいます。）に関する著作権、商標権その他の知的財産権は、当社または当社に' +
          'ライセンスを許諾している正当な権利者に帰属します。\n' +
          '2. ユーザーは、本サービス内での個人利用を目的としてのみ本コンテンツを視聴することができ、当社の' +
          '事前の書面による承諾なしに、複製、転載、公衆送信、改変、リバースエンジニアリング等、本サービスの' +
          '目的を超えた一切の利用を行ってはなりません。',
      },
      {
        heading: '第5条（禁止事項）',
        body:
          'ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。\n' +
          '1. 法令または公序良俗に違反する行為\n' +
          '2. 犯罪行為に関連する行為\n' +
          '3. 当社、本サービスの他のユーザー、または第三者の知的財産権、プライバシー権、名誉その他の権利' +
          'または利益を侵害する行為\n' +
          '4. 本サービスのサーバーまたはネットワークの機能を破壊したり、妨害したりする行為\n' +
          '5. 本サービスを、商業用の広告、宣伝、勧誘、その他営利を目的として利用する行為（当社の認めたもの' +
          'を除く）\n' +
          '6. 他のユーザーになりすます行為\n' +
          '7. 当社のサービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為\n' +
          '8. その他、当社が不適切と判断する行為',
      },
      {
        heading: '第6条（本サービスの提供の停止等）',
        body:
          '1. 当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく、' +
          '本サービスの全部または一部の提供を停止または中断することができるものとします。\n' +
          '　・本サービスに係るコンピュータシステムの保守点検または更新を行う場合\n' +
          '　・地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合\n' +
          '　・コンピュータまたは通信回線等が事故により停止した場合\n' +
          '　・その他、当社が本サービスの提供が困難と判断した場合\n' +
          '2. 当社は、本サービスの提供の停止または中断により、ユーザーまたは第三者が被ったいかなる不利益' +
          'または損害についても、一切の責任を負わないものとします。',
      },
      {
        heading: '第7条（利用制限および登録抹消）',
        body:
          '当社は、ユーザーが以下のいずれかに該当する場合には、事前の通知なく、投稿データを削除し、' +
          'ユーザーに対して本サービスの全部もしくは一部の利用を制限し、またはユーザーとしての登録を' +
          '抹消することができるものとします。\n' +
          '1. 本規約のいずれかの条項に違反した場合\n' +
          '2. 登録事項に虚偽の事実があることが判明した場合\n' +
          '3. 支払債務の履行遅延または不履行があった場合\n' +
          '4. 当社からの連絡に対し、一定期間返答がない場合\n' +
          '5. その他、当社が本サービスの利用を適当でないと判断した場合',
      },
      {
        heading: '第8条（退会・サブスクリプションの解約）',
        body:
          '1. ユーザーは、当社の定める退会手続により、本サービスから退会できるものとします。\n' +
          '2. 有料サブスクリプションの解約手続きは、ユーザー自身がApp Store／Google Playなど各プラット' +
          'フォームの設定画面、または当社指定の方法で行うものとし、解約手続きが完了するまでは自動的に更新' +
          'され、課金が継続します。',
      },
      {
        heading: '第9条（保証の否認および免責事項）',
        body:
          '1. 当社は、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の' +
          '目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます。）がないこと' +
          'を明示的にも黙示的にも保証しておりません。\n' +
          '2. 当社は、本サービスに起因してユーザーに生じたあらゆる損害について一切の責任を負いません。' +
          'ただし、本サービスに関する当社とユーザーとの間の契約（本規約を含みます。）が消費者契約法に定める' +
          '消費者契約となる場合、この免責規定は適用されません。\n' +
          '3. 前項ただし書に定める場合であっても、当社は、当社の過失（重過失を除きます。）による債務不履行' +
          'または不法行為によりユーザーに生じた損害のうち特別な事情から生じた損害（当社またはユーザーが損害' +
          '発生につき予見し、または予見し得た場合を含みます。）について一切の責任を負いません。また、当社の' +
          '過失（重過失を除きます。）による債務不履行または不法行為によりユーザーに生じた損害の賠償は、' +
          'ユーザーから当該損害が発生した月に受領した利用料金の額を上限とします。',
      },
      {
        heading: '第10条（サービス内容の変更等）',
        body:
          '当社は、ユーザーに通知することなく、本サービスの内容を変更しまたは本サービスの提供を中止する' +
          'ことができるものとし、これによってユーザーに生じた損害について一切の責任を負いません。',
      },
      {
        heading: '第11条（利用規約の変更）',
        body:
          '当社は、必要と判断した場合には、ユーザーに事前に通知することなく、いつでも本規約を変更する' +
          'ことができるものとします。なお、本規約の変更後、ユーザーが本サービスを利用した場合には、' +
          'ユーザーは変更後の規約に同意したものとみなします。',
      },
      {
        heading: '第12条（個人情報の取扱い）',
        body:
          '当社は、本サービスの利用によって取得する個人情報については、当社「プライバシーポリシー」に' +
          '従い適切に取り扱うものとします。',
      },
      {
        heading: '第13条（通知または連絡）',
        body:
          'ユーザーと当社との間の通知または連絡は、当社の定める方法によって行うものとします。当社は、' +
          'ユーザーから、当社が別途定める方式に従った変更届け出がない限り、現在登録されている連絡先が' +
          '有効なものとみなして当該連絡先へ通知または連絡を行い、これらは発信時にユーザーへ到達したものと' +
          'みなします。',
      },
      {
        heading: '第14条（準拠法・裁判管轄）',
        body:
          '1. 本規約の解釈にあたっては、日本法を準拠法とします。\n' +
          '2. 本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する地方裁判所を第一審の専属的' +
          '合意管轄裁判所とします。',
      },
    ],
  },
  privacy: {
    title: 'FluxRing プライバシーポリシー',
    lead:
      '株式会社Numéro.8（以下「当社」といいます。）は、当社が提供する音楽配信アプリサービス「FluxRing」' +
      '（以下「本サービス」といいます。）における、ユーザーの個人情報の取扱いについて、以下のとおり' +
      'プライバシーポリシー（以下「本ポリシー」といいます。）を定めます。',
    sections: [
      {
        heading: '第1条（個人情報の定義）',
        body:
          '「個人情報」とは、個人情報の保護に関する法律（以下「個人情報保護法」といいます。）にいう' +
          '「個人情報」を指すものとし、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日、' +
          '住所、電話番号、連絡先その他の記述等により特定の個人を識別できる情報（個人識別符号が含まれる' +
          'ものを含みます。）を指します。',
      },
      {
        heading: '第2条（個人情報の収集方法）',
        body:
          '当社は、ユーザーが本サービスを利用するにあたり、以下の個人情報を取得することがあります。\n\n' +
          'ユーザーから直接ご提供いただく情報\n' +
          '　・氏名、メールアドレス、生年月日、性別、その他プロフィール情報\n' +
          '　・アカウント作成時、またはお問い合わせ時に入力いただく情報\n\n' +
          '本サービスの利用に伴い自動的に取得する情報\n' +
          '　・端末情報（OS、端末の個体識別情報等）\n' +
          '　・ログ情報および行動履歴（アクセス日時、再生履歴、お気に入り登録履歴、検索履歴等）\n' +
          '　・クッキー（Cookie）および類似の技術を利用して取得する情報\n\n' +
          '決済に関する情報\n' +
          '　・ユーザーの決済処理は外部の決済サービスプロバイダ（Apple Inc.、Google LLC、クレジットカード' +
          '会社等）が行うため、当社が直接クレジットカード番号等の機密性の高い決済情報を保持することは' +
          'ありません。ただし、決済完了ステータスや決済番号等の情報は取得します。',
      },
      {
        heading: '第3条（個人情報を収集・利用する目的）',
        body:
          '当社が個人情報を収集・利用する目的は、以下のとおりです。\n' +
          '1. 本サービスの提供・運営のため\n' +
          '2. ユーザーの本人確認や、本サービスのご利用にかかる料金決済のため\n' +
          '3. ユーザーの視聴履歴等に基づく、おすすめの楽曲やプレイリスト等のパーソナライズ化されたコンテンツ' +
          '表示のため\n' +
          '4. メンテナンス、重要なお知らせ、規約変更などの必要な連絡を行うため\n' +
          '5. 本サービスの改善、新機能の開発、およびマーケティング分析のため\n' +
          '6. ユーザーからのお問い合わせに対応するため（本人確認を行うことを含みます）\n' +
          '7. 不正利用の検知、防止および対応のため\n' +
          '8. 上記の利用目的に付随する目的',
      },
      {
        heading: '第4条（個人情報の第三者提供）',
        body:
          '当社は、次に掲げる場合を除いて、あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供' +
          'することはありません。ただし、個人情報保護法その他の法令で認められる場合を除きます。\n' +
          '1. 人命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき\n' +
          '2. 公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を' +
          '得ることが困難であるとき\n' +
          '3. 国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して' +
          '協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれが' +
          'あるとき\n' +
          '4. 予め次の事項を告知あるいは公表し、かつ当社が個人情報保護委員会に届出をしたとき\n' +
          '　・利用目的に第三者への提供を含むこと\n' +
          '　・第三者に提供されるデータの項目\n' +
          '　・第三者への提供の手段または方法\n' +
          '　・本人の求めに応じて個人情報の第三者への提供を停止すること\n' +
          '　・本人の求めを受け付ける方法',
      },
      {
        heading: '第5条（個人情報の開示、訂正、利用停止等）',
        body:
          '1. ユーザーは、当社に対し、当社が保有する自己の個人情報の開示、訂正、追加、削除、利用停止、または' +
          '消去（以下「開示等」といいます。）を求めることができます。\n' +
          '2. 開示等のご請求は、後述の「お問い合わせ窓口」までご連絡ください。当社は、ご本人からの請求で' +
          'あることを確認の上、遅滞なく対応いたします。ただし、個人情報保護法その他の法令により当社が' +
          'これらの義務を負わない場合は、この限りではありません。',
      },
      {
        heading: '第6条（安全管理措置）',
        body:
          '当社は、ユーザーの個人情報の漏洩、滅失または毀損の防止その他の個人情報の安全管理のために、' +
          '必要かつ適切な措置を講じます。',
      },
      {
        heading: '第7条（プライバシーポリシーの変更）',
        body:
          '1. 本ポリシーの内容は、ユーザーに通知することなく、変更することができるものとします。\n' +
          '2. 当社が別途定める場合を除いて、変更後のプライバシーポリシーは、本サービス上または当社' +
          'ウェブサイトに掲載したときから効力を生じるものとします。',
      },
      {
        heading: '第8条（お問い合わせ窓口）',
        body:
          '本ポリシーに関するお問い合わせは、下記の窓口までお願いいたします。\n\n' +
          '住所：〒145-0071 東京都大田区田園調布4-44-8\n' +
          '社名：株式会社Numéro.8\n' +
          '担当部署：カスタマーサポート\n' +
          'Eメールアドレス：support@numero8.jp',
      },
    ],
  },
};

const TOKUSHOHO: TableDoc = {
  title: '特定商取引法に基づく表記',
  rows: [
    { label: '販売事業者名（社名）', value: '株式会社Numéro.8' },
    { label: '代表者名', value: '岡 直樹' },
    { label: '所在地', value: '〒145-0071 東京都大田区田園調布4-44-8' },
    { label: 'お問い合わせ先', value: 'support@numero8.jp' },
    { label: '販売価格', value: '本サービス（アプリ内）または公式サイトのプラン購入ページに表示する価格（消費税込み）' },
    { label: '商品代金以外の必要料金', value: '本サービスを利用するためのインターネット通信料・パケット通信料等は、お客様のご負担となります。' },
    { label: 'お支払方法', value: 'App Store決済（Apple ID）、Google Play決済、クレジットカード決済' },
    { label: '代金の支払時期', value: '各決済方法の提供会社の定める課金基準・支払時期に基づきます（原則として、購入確定時または定期購読の更新時に課金されます）。' },
    { label: '役務の提供時期', value: 'お支払手続き完了後、直ちにご利用いただけます。' },
    { label: 'キャンセル・返品（返金）について', value: 'デジタルコンテンツの特性上、購入確定後、および有料プラン登録期間中のキャンセル・返金は一切お受けできません。翌月以降の自動更新の停止（解約）については、いつでもお手続きが可能です。' },
    { label: '動作環境', value: '推奨環境の詳細は、ストア等のアプリ配信ページをご確認ください。' },
  ],
};

export const DocumentScreen: React.FC<{ kind: DocKind; onBack: () => void }> = ({
  kind,
  onBack,
}) => {
  const t = useT();
  // タイトルは i18n。本文（法務・クレジット）は現状 日本語のまま（別途英訳予定）。
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />
      <SubHeader title={t(`doc.${kind}`)} onBack={onBack} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {kind === 'tokushoho' ? (
          <View style={s.table}>
            {TOKUSHOHO.rows.map((row) => (
              <View key={row.label} style={s.tableRow}>
                <Text style={s.tableLabel}>{row.label}</Text>
                <Text style={s.tableValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            {TEXT_DOCS[kind].lead && <Text style={s.docLead}>{TEXT_DOCS[kind].lead}</Text>}
            {TEXT_DOCS[kind].sections.map((sec, i) => (
              <View key={sec.heading ?? i} style={s.docSection}>
                {sec.heading && <Text style={s.docHeading}>{sec.heading}</Text>}
                <Text style={s.docBody}>{sec.body}</Text>
              </View>
            ))}
          </>
        )}
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
  docLead: { color: COLOR.textSecondary, fontSize: 13, lineHeight: 22, letterSpacing: 0.3, marginBottom: SPACE.xs },
  docSection: { gap: 6 },
  docHeading: { color: COLOR.textPrimary, fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  docBody: { color: COLOR.textPrimary, fontSize: 14, lineHeight: 26, letterSpacing: 0.3 },
  note: { color: COLOR.auraCyan, fontSize: 13, textAlign: 'center' },
  // 特商法（表形式）
  table: { gap: 0 },
  tableRow: {
    paddingVertical: SPACE.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
    gap: 4,
  },
  tableLabel: { color: COLOR.textSecondary, fontSize: 11, letterSpacing: 0.5 },
  tableValue: { color: COLOR.textPrimary, fontSize: 14, lineHeight: 21, letterSpacing: 0.2 },

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
