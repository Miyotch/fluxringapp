import {
  IoPlay,
  IoPause,
  IoAdd,
  IoHeartOutline,
  IoHeart,
} from 'react-icons/io5';
import type { Track } from '../../types/track';
import { formatDuration } from '../../types/track';
import styles from './TrackCard.module.css';

interface TrackCardProps {
  track: Track;
  isPlaying: boolean;
  onPlay: () => void;
  onPreview: () => void;
  onAdd: () => void;
  onFavorite: () => void;
  isFavorite: boolean;
}

export function TrackCard({
  track,
  isPlaying,
  onPlay,
  onPreview,
  onAdd,
  onFavorite,
  isFavorite,
}: TrackCardProps) {
  return (
    <div className={`${styles.card} ${isPlaying ? styles.cardActive : ''}`}>
      {/* Artwork */}
      <div className={styles.artworkContainer}>
        <div className={styles.artworkRing}>
          {track.artworkUrl ? (
            <img
              src={track.artworkUrl}
              alt={track.title}
              className={styles.artwork}
            />
          ) : (
            <div className={`${styles.artwork} ${styles.artworkPlaceholder}`} />
          )}
        </div>
      </div>

      {/* Right content */}
      <div className={styles.content}>
        {/* Title + Duration */}
        <div className={styles.titleRow}>
          <span className={styles.title}>{track.title}</span>
          <span className={styles.duration}>{formatDuration(track.duration)}</span>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <button onClick={onPlay} className={styles.playButton} type="button">
            {isPlaying ? <IoPause size={18} /> : <IoPlay size={18} style={{ marginLeft: 2 }} />}
          </button>

          {isPlaying ? (
            <div className={styles.waveform}>
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} className={styles.waveformDot} />
              ))}
            </div>
          ) : (
            <button onClick={onPreview} className={styles.previewText} type="button">
              プレビュー
            </button>
          )}

          <button onClick={onAdd} className={styles.iconButton} type="button">
            <IoAdd size={18} />
          </button>

          <button onClick={onFavorite} className={styles.iconButton} type="button">
            {isFavorite ? (
              <IoHeart size={16} color="#d4a0c8" />
            ) : (
              <IoHeartOutline size={16} />
            )}
          </button>
        </div>

        {/* Description */}
        <p className={styles.description}>{track.description}</p>
      </div>
    </div>
  );
}
