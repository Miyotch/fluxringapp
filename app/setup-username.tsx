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
import { LinearGradient } from 'expo-linear-gradient';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { initFirebase } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function SetupUsernameScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!user || !name.trim() || busy) return;
    setError(null);
    setBusy(true);
    try {
      await updateDoc(doc(getFirestore(initFirebase()), 'users', user.uid), {
        displayName: name.trim(),
      });
      router.replace('/(tabs)');
    } catch (err) {
      setError((err as Error).message ?? 'ユーザー名の保存に失敗しました。');
    } finally {
      setBusy(false);
    }
  }, [user, name, busy, router]);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.center}>
            <View style={styles.card}>
              <Text style={styles.title}>ユーザー名を設定</Text>
              <Text style={styles.sub}>あなたの表示名をお知らせください。</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="ユーザー名"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                maxLength={32}
                autoFocus
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable onPress={submit} disabled={busy} style={styles.submitWrap}>
                <LinearGradient
                  colors={busy ? ['#c2b4d6', '#a899c6'] : ['#a388c8', '#9178BD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submit}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>設定する</Text>
                  )}
                </LinearGradient>
              </Pressable>
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
    maxWidth: 460,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  sub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    color: colors.textPrimary,
  },
  error: {
    fontSize: 12,
    color: '#c25a65',
  },
  submitWrap: {
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
  },
});
