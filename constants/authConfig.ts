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
 * Apple サインインは provisioning profile に「Sign In with Apple」機能の
 * 登録が必要。未登録のままだと iOS ビルド（署名）が失敗する。
 * さらに expo-apple-authentication はインストールされているだけで prebuild 時に
 * applesignin エンタイトルメントを自動付与するため、依存ごと一旦除外している。
 *
 * 【再有効化手順】
 *   1. ローカルで `eas build --platform ios`（または `eas credentials`）を一度実行し、
 *      EAS に Sign In with Apple 機能を同期＋プロファイルを再生成させる
 *   2. `npx expo install expo-apple-authentication expo-crypto` で依存を戻す
 *   3. app.json の ios に `"usesAppleSignIn": true` と
 *      `"plugins": ["expo-apple-authentication"]` を戻す
 *   4. AuthScreen に Apple サインインのコード（handleApple / Apple ボタン）を戻す
 *      ※ lib/firebaseAuth.ts の signInWithAppleToken は残してある
 *   5. このフラグを true にする
 */
export const APPLE_SIGNIN_ENABLED = false
