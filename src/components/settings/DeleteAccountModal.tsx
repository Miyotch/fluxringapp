import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { deleteAccount, readableAuthError } from '@/services/auth';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
}

const DANGER = '#c25a65';

export function DeleteAccountModal({ visible, onClose }: DeleteAccountModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<'info' | 'confirm'>('info');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep('info');
    setPassword('');
    setError(null);
    setBusy(false);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleDelete = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      reset();
      onClose();
      router.replace('/login');
    } catch (err) {
      setError(readableAuthError(err));
      setBusy(false);
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kavWrap}
        >
          <Pressable style={styles.card} onPress={() => undefined}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>アカウント削除</Text>
              <Pressable onPress={handleClose} hitSlop={8} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {step === 'info' ? (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.infoBox}>
                  <Ionicons name="warning-outline" size={20} color={DANGER} />
                  <Text style={styles.infoText}>
                    アカウントを削除すると、保存されたプレイリスト、お気に入り、設定など
                    すべてのデータが完全に削除され、復元できません。
                  </Text>
                </View>

                <View style={styles.infoBox}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoStrong}>
                      アカウント削除はサブスクの解約が完了してから可能です
                    </Text>
                    <Text style={styles.infoText}>
                      アカウントを削除する前に、下記の手順でサブスクリプションを解約してください。
                    </Text>
                    <View style={styles.stepList}>
                      <Text style={styles.stepItem}>
                        <Text style={styles.stepStrong}>iOS: </Text>
                        設定 → Apple ID → サブスクリプション → Flux Ring → 「サブスクリプションをキャンセル」
                      </Text>
                      <Text style={styles.stepItem}>
                        <Text style={styles.stepStrong}>Android: </Text>
                        Google Playストア → メニュー → 定期購入 → Flux Ring → 「定期購入を解約」
                      </Text>
                      <View style={styles.stepRowLinks}>
                        <Text style={styles.stepStrong}>Webブラウザ: </Text>
                        <Pressable
                          onPress={() => openLink('https://play.google.com/store/account/subscriptions')}
                        >
                          <Text style={styles.linkText}>Google Play</Text>
                        </Pressable>
                        <Text style={styles.stepItem}> / </Text>
                        <Pressable onPress={() => openLink('https://reportaproblem.apple.com')}>
                          <Text style={styles.linkText}>Apple Report a Problem</Text>
                        </Pressable>
                      </View>
                    </View>
                    <Text style={styles.infoText}>
                      サブスクリプションの解約を行わずにアカウントを削除した場合、
                      課金が継続される可能性があります。必ず先に解約をお済ませください。
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => setStep('confirm')}
                  style={({ pressed }) => [
                    styles.nextBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.nextBtnLabel}>理解した上で削除に進む</Text>
                </Pressable>
              </ScrollView>
            ) : (
              <View style={styles.form}>
                <Text style={styles.confirmText}>
                  この操作は取り消せません。本当にアカウントを削除しますか？
                </Text>
                {user?.email ? (
                  <TextInput
                    placeholder="パスワードを入力して確認"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="current-password"
                    textContentType="password"
                    style={styles.input}
                    editable={!busy}
                  />
                ) : null}
                {error && (
                  <View style={styles.errBox}>
                    <Text style={styles.errText}>{error}</Text>
                  </View>
                )}
                <Pressable
                  onPress={handleDelete}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.deleteWrap,
                    (pressed || busy) && { opacity: 0.85 },
                  ]}
                >
                  <LinearGradient
                    colors={['#d85a65', '#c25a65']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.deleteBtn}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.deleteLabel}>アカウントを完全に削除する</Text>
                    )}
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (busy) return;
                    setError(null);
                    setStep('info');
                  }}
                  style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.backBtnLabel}>戻る</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  kavWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: DANGER,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  infoBox: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md - 2,
    borderRadius: borderRadius.sm + 2,
    backgroundColor: 'rgba(240,235,248,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(200,190,220,0.25)',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  infoStrong: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  stepList: {
    marginVertical: spacing.sm,
    gap: 6,
  },
  stepItem: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  stepStrong: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  stepRowLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  linkText: {
    fontSize: 11,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  nextBtn: {
    marginTop: spacing.sm,
    paddingVertical: 12,
    borderRadius: borderRadius.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(194,90,101,0.3)',
    backgroundColor: 'rgba(194,90,101,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnLabel: {
    color: DANGER,
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    gap: spacing.sm + 2,
  },
  confirmText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  input: {
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(200,190,220,0.45)',
    backgroundColor: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    color: colors.textPrimary,
  },
  errBox: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(220,120,135,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220,120,135,0.25)',
  },
  errText: {
    fontSize: 12,
    color: DANGER,
    lineHeight: 18,
  },
  deleteWrap: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.sm + 2,
    overflow: 'hidden',
  },
  deleteBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLabel: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  backBtn: {
    paddingVertical: 10,
    borderRadius: borderRadius.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(200,190,220,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
