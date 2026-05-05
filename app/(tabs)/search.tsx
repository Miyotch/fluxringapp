import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { TrackCard } from '@/components/track/TrackCard';
import { useTracks } from '@/hooks/useTracks';
import { useAudioPlayer } from '@/components/player/useAudioPlayer';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const { tracks } = useTracks();
  const { currentTrack, isPlaying, level, playTrack } = useAudioPlayer();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.rootFrequency.includes(q),
    );
  }, [tracks, query]);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="タイトル・周波数・キーワードで検索"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isCurrent = item.id === currentTrack?.id;
            return (
              <TrackCard
                track={item}
                isPlaying={isCurrent && isPlaying}
                level={isCurrent && isPlaying ? level : 0}
                onPlay={() => playTrack(item)}
                onPreview={() => playTrack(item, item.previewUrl || item.audioUrl)}
                onAdd={() => {}}
              />
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>該当する楽曲が見つかりませんでした。</Text>
          }
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  list: {
    paddingBottom: spacing.lg,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    padding: spacing.xl,
  },
});
