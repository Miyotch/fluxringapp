import { FlatList, StyleSheet } from 'react-native';
import { TrackCard } from './TrackCard';
import type { Track } from '../../types/track';

interface TrackListProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  /** Synthesized 0..1 amplitude from the audio player. */
  level: number;
  lockedTrackIds?: Set<string>;
  onPlayTrack: (track: Track) => void;
  onPreviewTrack: (track: Track) => void;
  onAddTrack: (track: Track) => void;
  onLockTap?: () => void;
}

export function TrackList({
  tracks,
  currentTrackId,
  isPlaying,
  level,
  lockedTrackIds,
  onPlayTrack,
  onPreviewTrack,
  onAddTrack,
  onLockTap,
}: TrackListProps) {
  return (
    <FlatList
      data={tracks}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => {
        const isCurrent = item.id === currentTrackId;
        const isLocked = lockedTrackIds?.has(item.id) ?? false;
        return (
          <TrackCard
            track={item}
            isPlaying={isCurrent && isPlaying}
            level={isCurrent && isPlaying ? level : 0}
            locked={isLocked}
            onPlay={() => onPlayTrack(item)}
            onPreview={() => onPreviewTrack(item)}
            onAdd={() => onAddTrack(item)}
            onLockTap={onLockTap}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: 8,
  },
});
