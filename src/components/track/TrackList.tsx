import { TrackCard } from './TrackCard';
import type { Track } from '../../types/track';

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
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
      {tracks.map((track) => (
        <TrackCard
          key={track.id}
          track={track}
          isPlaying={track.id === currentTrackId}
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
