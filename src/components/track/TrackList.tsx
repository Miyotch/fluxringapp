import { TrackCard } from './TrackCard';
import type { Track } from '../../types/track';
import styles from './TrackList.module.css';

interface TrackListProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  favorites: string[];
  onPlayTrack: (track: Track) => void;
  onPreviewTrack: (track: Track) => void;
  onAddTrack: (track: Track) => void;
  onToggleFavorite: (track: Track) => void;
}

export function TrackList({
  tracks,
  currentTrackId,
  isPlaying,
  favorites,
  onPlayTrack,
  onPreviewTrack,
  onAddTrack,
  onToggleFavorite,
}: TrackListProps) {
  return (
    <div className={styles.list}>
      {tracks.map((track) => (
        <TrackCard
          key={track.id}
          track={track}
          isPlaying={track.id === currentTrackId && isPlaying}
          isFavorite={favorites.includes(track.id)}
          onPlay={() => onPlayTrack(track)}
          onPreview={() => onPreviewTrack(track)}
          onAdd={() => onAddTrack(track)}
          onFavorite={() => onToggleFavorite(track)}
        />
      ))}
    </div>
  );
}
