import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  signInWithEmail,
  signUpWithEmail,
  readableAuthError,
} from '@/services/auth';
import { OrbSphere } from '@/components/ui/OrbSphere';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

type Mode = 'signin' | 'signup';

function SocialButton({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  return (
    <View style={socialStyles.wrap}>
      <View style={socialStyles.btn}>
        <Ionicons name={icon} size={20} color={colors.textSecondary} />
        <Text style={socialStyles.label}>{label}</Text>
        <Text style={socialStyles.soon}>準備中</Text>
      </View>
    </View>
  );
}

const socialStyles = StyleSheet.create({
  wrap: { flex: 1 },
  btn: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    opacity: 0.6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  soon: {
    fontSize: 9,
    color: colors.textMuted,
  },
});

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password);
      }
    } catch (err) {
      setError(readableAuthError(err));
    } finally {
      setBusy(false);
    }
  }, [busy, mode, email, password]);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.center}>
            <View style={styles.card}>
              <View style={styles.brand}>
                <OrbSphere size={64} hue={266} />
                <Text style={styles.brandTitle}>Flux Ring</Text>
                <Text style={styles.brandSub}>サウンドで、集中と安らぎを。</Text>
              </View>

              <View style={styles.tabRow}>
                <Pressable
                  onPress={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  style={[styles.tab, mode === 'signin' && styles.tabActive]}
                >
                  <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>
                    ログイン
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  style={[styles.tab, mode === 'signup' && styles.tabActive]}
                >
                  <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>
                    新規登録
                  </Text>
                </Pressable>
              </View>

              <View style={styles.field}>
                <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="メールアドレス"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                />
              </View>

              <View style={styles.field}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="パスワード（6文字以上）"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  textContentType={mode === 'signin' ? 'password' : 'newPassword'}
                />
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable onPress={handleSubmit} disabled={busy} style={styles.submitWrap}>
                <LinearGradient
                  colors={busy ? ['#c2b4d6', '#a899c6'] : ['#a388c8', '#9178BD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submit}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>
                      {mode === 'signin' ? 'ログイン' : 'アカウント作成'}
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>または</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                <SocialButton icon="logo-google" label="Google" />
                <SocialButton icon="logo-apple" label="Apple" />
                <SocialButton icon="logo-facebook" label="Facebook" />
              </View>

              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>商用利用に関する注意事項</Text>
                <Text style={styles.noticeBody}>
                  Flux Ring で配信される楽曲の商用利用には、プレミアムプラン（¥2,980/月）
                  へのご加入が必要です。
                </Text>
              </View>

              <Text style={styles.terms}>
                続行することで、利用規約およびプライバシーポリシーに同意したものとみなされます。
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing.md,
  },
  brand: {
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1.2,
  },
  brandSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(230,225,240,0.5)',
    borderRadius: borderRadius.md,
    padding: 4,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.white,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  error: {
    fontSize: 12,
    color: '#c25a65',
    padding: 10,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(220,120,135,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220,120,135,0.25)',
  },
  submitWrap: {
    marginTop: 4,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  submit: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  notice: {
    marginTop: 4,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(145,120,189,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(145,120,189,0.15)',
  },
  noticeTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 10,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  terms: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(145,120,189,0.2)',
  },
  dividerText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  socialRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
