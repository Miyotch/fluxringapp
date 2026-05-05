import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

export default function NotificationsScreen() {
  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.empty}>
          <Ionicons name="notifications-outline" size={48} color={colors.textMuted} />
          <Text style={styles.title}>お知らせはありません</Text>
          <Text style={styles.sub}>新しいお知らせが届くと、ここに表示されます。</Text>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  sub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
