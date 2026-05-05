import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { OrbSphere } from '@/components/ui/OrbSphere';
import { usePlaylists } from '@/hooks/usePlaylists';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function PlaylistScreen() {
  const { playlists } = usePlaylists();

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Text style={styles.title}>プレイリスト</Text>
        <FlatList
          data={playlists}
          keyExtractor={(p) => p.id}
          numColumns={3}
          columnWrapperStyle={styles.grid}
          contentContainerStyle={styles.content}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <OrbSphere size={84} hue={item.hue} />
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardCount}>{item.trackIds.length} 曲</Text>
            </View>
          )}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  grid: {
    gap: spacing.md,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 8,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 6,
  },
  cardCount: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});
