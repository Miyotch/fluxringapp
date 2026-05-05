import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { changePassword, readableAuthError } from '@/services/auth';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

interface PasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PasswordModal({ visible, onClose }: PasswordModalProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
    setBusy(false);
    setDone(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (next.length < 6) {
      setError('パスワードは6文字以上で入力してください。');
      return;
    }
    if (next !== confirm) {
      setError('新しいパスワードが一致しません。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(readableAuthError(err));
    } finally {
      setBusy(false);
    }
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
              <Text style={styles.title}>パスワード変更</Text>
              <Pressable onPress={handleClose} hitSlop={8} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {done ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={20} color="#5a9e6e" />
                <Text style={styles.successText}>パスワードを変更しました。</Text>
              </View>
            ) : (
              <View style={styles.form}>
                <TextInput
                  placeholder="現在のパスワード"
                  placeholderTextColor={colors.textMuted}
                  value={current}
                  onChangeText={setCurrent}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  style={styles.input}
                  editable={!busy}
                />
                <TextInput
                  placeholder="新しいパスワード（6文字以上）"
                  placeholderTextColor={colors.textMuted}
                  value={next}
                  onChangeText={setNext}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  style={styles.input}
                  editable={!busy}
                />
                <TextInput
                  placeholder="新しいパスワード（確認）"
                  placeholderTextColor={colors.textMuted}
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  style={styles.input}
                  editable={!busy}
                />
                {error && (
                  <View style={styles.errBox}>
                    <Text style={styles.errText}>{error}</Text>
                  </View>
                )}
                <Pressable
                  onPress={handleSubmit}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.submitWrap,
                    (pressed || busy) && { opacity: 0.85 },
                  ]}
                >
                  <LinearGradient
                    colors={['#a388c8', '#9178BD']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submitBtn}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.submitLabel}>変更する</Text>
                    )}
                  </LinearGradient>
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
    maxWidth: 460,
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
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  form: {
    gap: spacing.sm + 2,
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
    color: '#c25a65',
    lineHeight: 18,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(90,180,120,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(90,180,120,0.2)',
  },
  successText: {
    fontSize: 13,
    color: '#5a9e6e',
    fontWeight: '600',
  },
  submitWrap: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.sm + 2,
    overflow: 'hidden',
  },
  submitBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitLabel: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
