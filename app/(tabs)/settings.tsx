import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { useAuth } from '@/hooks/useAuth';
import { useUserPlan } from '@/hooks/useUserPlan';
import { signOut } from '@/services/auth';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function SettingsScreen() {
  const { user } = useAuth();
  const { planName, isAdmin } = useUserPlan();

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>設定</Text>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>ユーザー</Text>
            <Text style={styles.cardValue}>
              {user?.displayName || user?.email || '匿名ユーザー'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>プラン</Text>
            <Text style={styles.cardValue}>{planName}</Text>
          </View>

          {isAdmin && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>権限</Text>
              <Text style={styles.cardValue}>管理者</Text>
            </View>
          )}

          <Pressable
            onPress={() => {
              void signOut();
            }}
            style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.primary} />
            <Text style={styles.logoutText}>ログアウト</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 4,
  },
  cardLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  cardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
