import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { TrackCard } from './TrackCard';
import type { Track } from '../../types/track';
import { spacing } from '../../theme/spacing';

interface TrackListProps {
  tracks: Track[];
  currentTrackId: string | null;
  favorites: string[];
  onPlayTrack: (track: Track) => void;
  onPreviewTrack: (track: Track) => void;
  onAddTrack: (track: Track) => void;
  onToggleFavorite: (track: Track) => void;
}

export function TrackList({
  tracks,
  currentTrackId,
  favorites,
  onPlayTrack,
  onPreviewTrack,
  onAddTrack,
  onToggleFavorite,
}: TrackListProps) {
  return (
    <FlatList
      data={tracks}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TrackCard
          track={item}
          isPlaying={item.id === currentTrackId}
          isFavorite={favorites.includes(item.id)}
          onPlay={() => onPlayTrack(item)}
          onPreview={() => onPreviewTrack(item)}
          onAdd={() => onAddTrack(item)}
          onFavorite={() => onToggleFavorite(item)}
        />
      )}
      style={styles.list}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    paddingVertical: spacing.md,
  },
});
