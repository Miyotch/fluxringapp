/**
 * i18n.tsx — 多言語（日本語 / 英語）
 * ------------------------------------------------------------------
 * LanguageProvider でアプリを包み、各画面は useT() の t('key') で文言を出す。
 * 選択言語は AsyncStorage に永続化。楽曲タイトル・Story 等の「作品コンテンツ」は
 * 翻訳対象外（データとして保持）。ここでは UI の固定文言のみを扱う。
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type Lang = 'ja' | 'en'

const STORAGE_KEY = 'fluxring.lang'

type Dict = Record<string, string>

const JA: Dict = {
  // フッター
  'tab.home': 'ホーム',
  'tab.collection': 'コレクション',
  'tab.vip': 'VIP',
  'tab.media': 'メディア',
  'tab.settings': '設定',
  // 共通
  'common.back': '戻る',
  'common.or': 'または',
  // オンボーディング
  'onboarding.signup': 'サインアップ',
  'onboarding.login': 'ログイン',
  // 認証
  'auth.createAccount': 'アカウント作成',
  'auth.login': 'ログイン',
  'auth.email': 'メールアドレス',
  'auth.password': 'パスワード',
  'auth.signup': 'サインアップ',
  'auth.processing': '処理中…',
  'auth.google': 'Google で続ける',
  'auth.toLogin': 'すでにアカウントをお持ちですか？ ログイン',
  'auth.toSignup': 'アカウントを作成する',
  'auth.googleNotConfigured': 'Google クライアントIDが未設定です（app.json の extra.googleAuth）',
  'auth.failed': '認証に失敗しました',
  // ディスカバー / 購入
  'buy.label': '購入する',
  'buy.play': '再生',
  // コレクション
  'collection.title': 'コレクション',
  'collection.owned': 'マイコレクション',
  'collection.wishlist': 'ウィッシュリスト',
  'collection.ownedCount': '{n} の作品を所有',
  'collection.ownedTag': '所有済み',
  'collection.buy': '購入する {price}',
  'collection.emptyTitle': 'まだ、ひとつも。',
  'collection.emptyBody': '出会った作品が、ここに静かに集まります。',
  'collection.discover': '作品と出会う',
  // 設定
  'settings.title': '設定',
  'settings.sec.account': 'アカウント',
  'settings.sec.creator': 'CREATOR',
  'settings.sec.general': '一般',
  'settings.sec.info': '情報',
  'settings.account': 'アカウント',
  'settings.restore': '購入の復元',
  'settings.restore.sub': '買い切り作品を引き継ぐ',
  'settings.artist': 'Artist のご紹介',
  'settings.artist.sub': '作家一覧 → 作家 → 楽曲一覧',
  'settings.language': '言語',
  'settings.support': 'サポート',
  'settings.support.sub': 'お問い合わせ',
  'settings.thanks': 'Special Thanks',
  'settings.thanks.sub': 'スタッフクレジット・協力者',
  'settings.terms': '利用規約',
  'settings.privacy': 'プライバシーポリシー',
  'settings.tokushoho': '特定商取引法に基づく表記',
  'settings.signout': 'サインアウト',
  'settings.deleteAccount': 'アカウントを削除',
  'settings.deleteAccount.sub': '購入情報を含むすべてのデータを削除',
  'settings.delete.title': 'アカウントを削除しますか？',
  'settings.delete.body': '購入した作品を含む、すべてのデータが削除されます。この操作は元に戻せません。',
  'settings.delete.confirm': '削除する',
  'settings.delete.cancel': '戻る',
  'settings.delete.failed': '削除に失敗しました。再度ログインしてからお試しください。',
  'settings.version': 'FLUX RING　バージョン {v}',
  'settings.langName': '日本語',
  'settings.notLoggedIn': '未ログイン',
  // 設定・末端
  'account.title': 'アカウント',
  'account.emailLabel': 'メールアドレス',
  'account.changePassword': 'パスワードを変更',
  'account.delete': 'アカウントを削除',
  'restore.title': '購入の復元',
  'restore.body': '機種変更や再インストールのあとでも、買い切りで手に入れた作品はここから引き継げます。ストアのアカウントに紐づいた購入履歴を確認して、コレクションへ復元します。',
  'restore.button': '購入を復元する',
  'restore.busy': '復元中…',
  'restore.done': '復元しました',
  'restore.doneNote': '所有作品をコレクションに反映しました。',
  'language.title': '言語',
  'support.title': 'サポート',
  'support.body': 'ご不明な点や不具合のご報告は、下記よりお問い合わせください。個別ケース（コードの紛失・端末トラブル等）も承ります。',
  'support.mail': 'メールで問い合わせ',
  'support.faq': 'よくある質問',
  'doc.thanks': 'Special Thanks',
  'doc.terms': '利用規約',
  'doc.privacy': 'プライバシーポリシー',
  'doc.tokushoho': '特定商取引法に基づく表記',
}

const EN: Dict = {
  'tab.home': 'Home',
  'tab.collection': 'Collection',
  'tab.vip': 'VIP',
  'tab.media': 'Media',
  'tab.settings': 'Settings',
  'common.back': 'Back',
  'common.or': 'or',
  'onboarding.signup': 'Sign Up',
  'onboarding.login': 'Log In',
  'auth.createAccount': 'Create Account',
  'auth.login': 'Log In',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.signup': 'Sign Up',
  'auth.processing': 'Processing…',
  'auth.google': 'Continue with Google',
  'auth.toLogin': 'Already have an account? Log in',
  'auth.toSignup': 'Create an account',
  'auth.googleNotConfigured': 'Google client ID is not set (extra.googleAuth in app.json)',
  'auth.failed': 'Authentication failed',
  'buy.label': 'Buy',
  'buy.play': 'Play',
  'collection.title': 'Collection',
  'collection.owned': 'My Collection',
  'collection.wishlist': 'Wishlist',
  'collection.ownedCount': '{n} works owned',
  'collection.ownedTag': 'Owned',
  'collection.buy': 'Buy {price}',
  'collection.emptyTitle': 'Nothing yet.',
  'collection.emptyBody': 'Works you meet will quietly gather here.',
  'collection.discover': 'Discover works',
  'settings.title': 'Settings',
  'settings.sec.account': 'ACCOUNT',
  'settings.sec.creator': 'CREATOR',
  'settings.sec.general': 'GENERAL',
  'settings.sec.info': 'INFO',
  'settings.account': 'Account',
  'settings.restore': 'Restore Purchases',
  'settings.restore.sub': 'Carry over your one-time purchases',
  'settings.artist': 'About the Artist',
  'settings.artist.sub': 'Artists → Artist → Tracks',
  'settings.language': 'Language',
  'settings.support': 'Support',
  'settings.support.sub': 'Contact us',
  'settings.thanks': 'Special Thanks',
  'settings.thanks.sub': 'Staff credits & contributors',
  'settings.terms': 'Terms of Service',
  'settings.privacy': 'Privacy Policy',
  'settings.tokushoho': 'Commercial Transactions Act',
  'settings.signout': 'Sign Out',
  'settings.deleteAccount': 'Delete Account',
  'settings.deleteAccount.sub': 'Erase all data including purchases',
  'settings.delete.title': 'Delete your account?',
  'settings.delete.body': 'All data, including purchased works, will be permanently deleted. This cannot be undone.',
  'settings.delete.confirm': 'Delete',
  'settings.delete.cancel': 'Back',
  'settings.delete.failed': 'Deletion failed. Please sign in again and retry.',
  'settings.version': 'FLUX RING  Version {v}',
  'settings.langName': 'English',
  'settings.notLoggedIn': 'Not signed in',
  'account.title': 'Account',
  'account.emailLabel': 'Email',
  'account.changePassword': 'Change Password',
  'account.delete': 'Delete Account',
  'restore.title': 'Restore Purchases',
  'restore.body': 'Even after changing devices or reinstalling, works you bought outright can be carried over here. We check the purchase history tied to your store account and restore them to your collection.',
  'restore.button': 'Restore Purchases',
  'restore.busy': 'Restoring…',
  'restore.done': 'Restored',
  'restore.doneNote': 'Your owned works have been added to your collection.',
  'language.title': 'Language',
  'support.title': 'Support',
  'support.body': 'For questions or bug reports, please contact us below. We also handle individual cases (lost codes, device issues, etc.).',
  'support.mail': 'Contact by email',
  'support.faq': 'FAQ',
  'doc.thanks': 'Special Thanks',
  'doc.terms': 'Terms of Service',
  'doc.privacy': 'Privacy Policy',
  'doc.tokushoho': 'Commercial Transactions Act',
}

const DICTS: Record<Lang, Dict> = { ja: JA, en: EN }

type Ctx = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<Ctx>({
  lang: 'ja',
  setLang: () => {},
  t: (k) => JA[k] ?? k,
})

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>('ja')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'en' || v === 'ja') setLangState(v)
      })
      .catch(() => {})
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {})
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = DICTS[lang][key] ?? JA[key] ?? key
      if (vars) {
        for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, String(vars[k]))
      }
      return s
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)
export const useT = () => useContext(I18nContext).t
