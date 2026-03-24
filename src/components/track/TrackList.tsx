import { TrackCard } from './TrackCard';
import type { Track } from '../../types/track';
import styles from './TrackList.module.css';

interface TrackListProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  analyserNode: AnalyserNode | null;
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
  analyserNode,
  favorites,
  onPlayTrack,
  onPreviewTrack,
  onAddTrack,
  onToggleFavorite,
}: TrackListProps) {
  return (
    <div className={styles.list}>
      {tracks.map((track) => {
        const isCurrent = track.id === currentTrackId;
        return (
          <TrackCard
            key={track.id}
            track={track}
            isPlaying={isCurrent && isPlaying}
            analyserNode={isCurrent && isPlaying ? analyserNode : null}
            isFavorite={favorites.includes(track.id)}
            onPlay={() => onPlayTrack(track)}
            onPreview={() => onPreviewTrack(track)}
            onAdd={() => onAddTrack(track)}
            onFavorite={() => onToggleFavorite(track)}
          />
        );
      })}
    </div>
  );
}
