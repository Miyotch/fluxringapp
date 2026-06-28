/**
 * AuthScreen.tsx — サインアップ / ログイン
 * ------------------------------------------------------------------
 * ワイヤーフレーム 01: オンボーディング → サインアップ/ログイン（Google/Apple）。
 *   ・mode で「signup」「login」を切替（タイトル・CTA文言が変わる）
 *   ・メール/パスワード ＋ ソーシャル（Google / Apple）
 *   ・認証実体は lib/firebaseAuth.ts（signUp / signIn）に接続
 */

import React, { useState } from 'react';
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
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';
// import { signUp, signIn } from '../lib/firebaseAuth'; // TODO: 接続時に有効化

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

  const isSignup = mode === 'signup';

  const handleSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      // TODO: lib/firebaseAuth を接続
      // if (isSignup) await signUp(email, password);
      // else          await signIn(email, password);
      await new Promise((r) => setTimeout(r, 400)); // stub
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

        {/* TODO: expo-auth-session / @react-native-google-signin、Apple は expo-apple-authentication */}
        <Pressable style={styles.socialBtn} onPress={onAuthenticated}>
          <Text style={styles.socialLabel}>Google で続ける</Text>
        </Pressable>
        {Platform.OS === 'ios' && (
          <Pressable style={styles.socialBtn} onPress={onAuthenticated}>
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
