import { TrackCard } from './TrackCard';
import type { Track } from '../../types/track';
import styles from './TrackList.module.css';

interface TrackListProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  analyserNode: AnalyserNode | null;
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
  analyserNode,
  lockedTrackIds,
  onPlayTrack,
  onPreviewTrack,
  onAddTrack,
  onLockTap,
}: TrackListProps) {
  return (
    <div className={styles.list}>
      {tracks.map((track, index) => {
        const isCurrent = track.id === currentTrackId;
        const isLocked = lockedTrackIds?.has(track.id) ?? false;
        return (
          <TrackCard
            key={track.id}
            track={track}
            index={index}
            isPlaying={isCurrent && isPlaying}
            analyserNode={isCurrent && isPlaying ? analyserNode : null}
            locked={isLocked}
            onPlay={() => onPlayTrack(track)}
            onPreview={() => onPreviewTrack(track)}
            onAdd={() => onAddTrack(track)}
            onLockTap={onLockTap}
          />
        );
      })}
    </div>
  );
}
