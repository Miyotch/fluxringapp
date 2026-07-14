/**
 * authConfig.ts — ソーシャル認証のクライアントID
 * ------------------------------------------------------------------
 * Google サインイン（expo-auth-session）に必要な OAuth クライアントID。
 * 値は app.json の `extra.googleAuth` から読み込む（コードに直書きしない）。
 *
 * 取得場所（Firebase コンソール / Google Cloud）:
 *   ・webClientId     … Firebase Authentication → ログイン方法 → Google →
 *                       「ウェブ SDK の設定」→ ウェブクライアントID
 *                       ※ Firebase はこの audience の id_token を受け付けるため必須
 *   ・iosClientId     … Google Cloud → 認証情報 → OAuth 2.0 → iOS クライアント
 *                       （GoogleService-Info.plist の CLIENT_ID と同じ）
 *   ・androidClientId … 同 Android クライアント（Android 配信時に設定）
 *
 * Apple はクライアントID不要（bundleId と expo-apple-authentication で完結）。
 */

import Constants from 'expo-constants'

type GoogleAuthConfig = {
  webClientId?: string
  iosClientId?: string
  androidClientId?: string
}

const extra =
  (Constants.expoConfig?.extra?.googleAuth as GoogleAuthConfig | undefined) ?? {}

export const GOOGLE_WEB_CLIENT_ID = extra.webClientId ?? ''
export const GOOGLE_IOS_CLIENT_ID = extra.iosClientId ?? ''
export const GOOGLE_ANDROID_CLIENT_ID = extra.androidClientId ?? ''

/** クライアントIDが設定済みか（未設定なら UI で Google ボタンを無効化する） */
export const isGoogleConfigured = Boolean(
  GOOGLE_WEB_CLIENT_ID || GOOGLE_IOS_CLIENT_ID,
)

/**
 * Apple サインインの有効化フラグ。
 * ------------------------------------------------------------------
 * expo-apple-authentication を依存に戻し、app.json に usesAppleSignIn=true と
 * プラグインを設定済み。実行時は AppleAuthentication.isAvailableAsync() で
 * 利用可否を判定し、iOS の対応端末でのみ Apple ボタンを表示する。
 *
 * ⚠️ EAS ビルド前提:
 *   expo-apple-authentication は prebuild 時に applesignin エンタイトルメントを
 *   自動付与する。Apple Developer 側で App ID に「Sign In with Apple」capability を
 *   有効化し、`eas credentials`（または `eas build`）でプロファイルを再生成して
 *   おかないと iOS の署名ビルドが失敗する。
 *   Firebase コンソール → Authentication → Apple も有効化しておくこと。
 */
export const APPLE_SIGNIN_ENABLED = true
