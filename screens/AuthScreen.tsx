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

import React, { useState, useEffect, useCallback } from 'react';
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
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';
import {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  isGoogleConfigured,
} from '../constants/authConfig';
import {
  signUp,
  signIn,
  signInWithGoogleToken,
  signInWithAppleToken,
} from '../lib/firebaseAuth';

// OAuth リダイレクト後にブラウザセッションを閉じる（expo-auth-session 必須）
WebBrowser.maybeCompleteAuthSession();

type Props = {
  mode: 'signup' | 'login';
  onSwitchMode: (mode: 'signup' | 'login') => void;
  onAuthenticated: () => void;
};

export const AuthScreen: React.FC<Props> = ({ mode, onSwitchMode, onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const isSignup = mode === 'signup';

  // ── Apple サインインの可用性（iOS かつ対応端末のみ） ──
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    }
  }, []);

  // ── Google（expo-auth-session） ──
  const [, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
  });

  // Google の認可レスポンスを受けて Firebase にサインイン
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.params?.id_token;
      if (idToken) {
        setBusy(true);
        signInWithGoogleToken(idToken)
          .then(onAuthenticated)
          .catch((e) => setError(e?.message ?? 'Google サインインに失敗しました'))
          .finally(() => setBusy(false));
      }
    } else if (googleResponse?.type === 'error') {
      setError('Google サインインがキャンセルされました');
    }
  }, [googleResponse, onAuthenticated]);

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

  // ── Apple ──
  const handleApple = useCallback(async () => {
    setError(null);
    try {
      // リプレイ攻撃対策の nonce（raw を Firebase に、SHA256 を Apple に渡す）
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        setError('Apple の認証情報を取得できませんでした');
        return;
      }
      setBusy(true);
      await signInWithAppleToken(credential.identityToken, rawNonce);
      onAuthenticated();
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return; // ユーザーキャンセルは無視
      setError(e?.message ?? 'Apple サインインに失敗しました');
    } finally {
      setBusy(false);
    }
  }, [onAuthenticated]);

  // ── Google ボタン押下 ──
  const handleGoogle = async () => {
    setError(null);
    if (!isGoogleConfigured) {
      setError('Google クライアントIDが未設定です（app.json の extra.googleAuth）');
      return;
    }
    await promptGoogle();
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />

      <View style={styles.body}>
        <Text style={styles.brand}>FLUX RING</Text>
        <Text style={styles.title}>{isSignup ? 'アカウント作成' : 'ログイン'}</Text>

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
            {busy ? '処理中…' : isSignup ? 'サインアップ' : 'ログイン'}
          </Text>
        </Pressable>

        {/* ソーシャル */}
        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>または</Text>
          <View style={styles.line} />
        </View>

        <Pressable style={styles.socialBtn} onPress={handleGoogle} disabled={busy}>
          <Text style={styles.socialLabel}>Google で続ける</Text>
        </Pressable>

        {/* Apple は iOS の対応端末のみ表示 */}
        {appleAvailable && (
          <Pressable style={styles.socialBtn} onPress={handleApple} disabled={busy}>
            <Text style={styles.socialLabel}>Apple で続ける</Text>
          </Pressable>
        )}
      </View>

      {/* モード切替 */}
      <Pressable
        style={styles.switchRow}
        onPress={() => onSwitchMode(isSignup ? 'login' : 'signup')}
      >
        <Text style={styles.switchText}>
          {isSignup ? 'すでにアカウントをお持ちですか？ ログイン' : 'アカウントを作成する'}
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
