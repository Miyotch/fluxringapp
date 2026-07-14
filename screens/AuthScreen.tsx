/**
 * AuthScreen.tsx — サインアップ / ログイン
 * ------------------------------------------------------------------
 * ワイヤーフレーム 01: オンボーディング → サインアップ/ログイン（Google/Apple）。
 *   ・mode で「signup」「login」を切替（タイトル・CTA文言が変わる）
 *   ・メール/パスワード ＋ ソーシャル（Google / Apple）
 *   ・認証実体は lib/firebaseAuth.ts に接続:
 *       - メール:  signUp / signIn
 *       - Google:  expo-auth-session で id_token 取得 → signInWithGoogleToken
 *       - Apple:   expo-apple-authentication で identityToken 取得 → signInWithAppleToken
 *
 * 前提（Firebase コンソールで Google / Apple を有効化済み）:
 *   - Google: extra.googleAuth.webClientId / iosClientId を app.json に設定（constants/authConfig.ts 参照）
 *   - Apple:  app.json で ios.usesAppleSignIn=true ＋ expo-apple-authentication プラグイン
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';
import {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  isGoogleConfigured,
  APPLE_SIGNIN_ENABLED,
} from '../constants/authConfig';
import { signUp, signIn, signInWithGoogleToken } from '../lib/firebaseAuth';
import { AppleButton } from '../components/AppleButton';

// OAuth リダイレクト後にブラウザセッションを閉じる（expo-auth-session 必須）
WebBrowser.maybeCompleteAuthSession();

type Props = {
  mode: 'signup' | 'login';
  onSwitchMode: (mode: 'signup' | 'login') => void;
  onAuthenticated: () => void;
};

/**
 * GoogleButton — Google サインインのフックを内包する子コンポーネント。
 * useIdTokenAuthRequest はクライアントID未設定だとマウント時にクラッシュしうるため、
 * 親は isGoogleConfigured が true のときだけこのコンポーネントをマウントする。
 */
const GoogleButton: React.FC<{
  busy: boolean;
  onBusy: (b: boolean) => void;
  onError: (m: string | null) => void;
  onAuthenticated: () => void;
}> = ({ busy, onBusy, onError, onAuthenticated }) => {
  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token;
      if (idToken) {
        onBusy(true);
        signInWithGoogleToken(idToken)
          .then(onAuthenticated)
          .catch((e) => onError(e?.message ?? 'Google サインインに失敗しました'))
          .finally(() => onBusy(false));
      }
    } else if (response?.type === 'error') {
      onError('Google サインインに失敗しました');
    }
    // response の変化のみで発火させる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return (
    <Pressable
      style={styles.socialBtn}
      onPress={() => {
        onError(null);
        promptAsync();
      }}
      disabled={busy}
    >
      <Text style={styles.socialLabel}>Google で続ける</Text>
    </Pressable>
  );
};

export const AuthScreen: React.FC<Props> = ({ mode, onSwitchMode, onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  // NOTE: Apple サインインは provisioning profile が「Sign In with Apple」機能
  // 未対応のため一時的に無効化（expo-apple-authentication を依存から除外）。
  // 再有効化手順は constants/authConfig.ts のコメント参照。
  //
  // NOTE: Google の expo-auth-session フックは、クライアントID未設定だと
  // マウント時にクラッシュしうるため <GoogleButton> 子コンポーネントに分離し、
  // isGoogleConfigured が true のときだけマウントする（下部の JSX 参照）。

  // ── メール / パスワード ──
  const handleSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (isSignup) await signUp(email, password);
      else await signIn(email, password);
      onAuthenticated();
    } catch (e: any) {
      setError(e?.message ?? '認証に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />

      <View style={styles.body}>
        <Text style={styles.brand}>FLUX RING</Text>
        <Text style={styles.title}>{isSignup ? '新規登録' : 'ログイン'}</Text>

        {/* メール / パスワード */}
        <TextInput
          style={styles.input}
          placeholder="メールアドレス"
          placeholderTextColor={COLOR.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="パスワード"
          placeholderTextColor={COLOR.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, (pressed || busy) && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={busy}
        >
          <Text style={styles.primaryLabel}>
            {busy ? '処理中…' : isSignup ? '新規登録' : 'ログイン'}
          </Text>
        </Pressable>

        {/* ソーシャル */}
        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>または</Text>
          <View style={styles.line} />
        </View>

        {/* ソーシャル認証（ログイン・新規登録の両方で表示） */}
        {/* Google: 設定済みのときだけフック付きボタンをマウント（未設定時のクラッシュ回避） */}
        {isGoogleConfigured ? (
          <GoogleButton
            busy={busy}
            onBusy={setBusy}
            onError={setError}
            onAuthenticated={onAuthenticated}
          />
        ) : (
          <Pressable
            style={[styles.socialBtn, { opacity: 0.5 }]}
            onPress={() =>
              setError('Google クライアントIDが未設定です（app.json の extra.googleAuth）')
            }
          >
            <Text style={styles.socialLabel}>Google で続ける</Text>
          </Pressable>
        )}

        {/* Apple: iOS の対応端末でのみ表示（AppleButton 内で isAvailableAsync 判定） */}
        {APPLE_SIGNIN_ENABLED && (
          <AppleButton
            busy={busy}
            onBusy={setBusy}
            onError={setError}
            onAuthenticated={onAuthenticated}
          />
        )}
      </View>

      {/* モード切替 */}
      <Pressable
        style={styles.switchRow}
        onPress={() => onSwitchMode(isSignup ? 'login' : 'signup')}
      >
        <Text style={styles.switchText}>
          {isSignup ? 'すでにアカウントをお持ちですか？ ログイン' : '新規登録はこちら'}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg, justifyContent: 'center' },
  body: { paddingHorizontal: SPACE.xl, gap: SPACE.md },
  brand: { color: COLOR.textSecondary, fontSize: 12, letterSpacing: 5, textAlign: 'center' },
  title: {
    color: COLOR.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: SPACE.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: 14,
    color: COLOR.textPrimary,
    fontSize: 15,
    backgroundColor: 'rgba(34,36,69,0.30)',
  },
  error: { color: COLOR.badge, fontSize: 13 },
  primaryBtn: {
    marginTop: SPACE.sm,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.auraCyan,
    backgroundColor: 'rgba(96,206,224,0.08)',
    alignItems: 'center',
  },
  primaryLabel: { color: COLOR.textPrimary, fontSize: 15, fontWeight: '600', letterSpacing: 1 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginVertical: SPACE.xs },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: COLOR.border },
  dividerText: { color: COLOR.textSecondary, fontSize: 12 },
  socialBtn: {
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.border,
    alignItems: 'center',
  },
  socialLabel: { color: COLOR.textPrimary, fontSize: 14, letterSpacing: 0.5 },
  switchRow: { position: 'absolute', bottom: 40, alignSelf: 'center' },
  switchText: { color: COLOR.textSecondary, fontSize: 13, letterSpacing: 0.3 },
});

export default AuthScreen;
