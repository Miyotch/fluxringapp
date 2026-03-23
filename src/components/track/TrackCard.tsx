import {
  IoPlayCircle,
  IoPauseCircle,
  IoAdd,
  IoHeart,
  IoHeartOutline,
} from 'react-icons/io5';
import { colors } from '../../theme/colors';
import { borderRadius } from '../../theme/spacing';
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
    <div
      className={styles.card}
      style={
        isPlaying
          ? {
              backgroundColor: colors.cardActiveBackground,
              borderRadius: borderRadius.lg,
              border: `1px solid ${colors.cardBorder}`,
              boxShadow: `0 2px 8px ${colors.primaryLight}`,
            }
          : undefined
      }
    >
      <div className={styles.row}>
        {/* Album art */}
        <div className={styles.artworkContainer}>
          {track.artworkUrl ? (
            <img src={track.artworkUrl} alt={track.title} className={styles.artwork} />
          ) : (
            <div
              className={styles.artwork}
              style={{ backgroundColor: colors.backgroundEnd }}
            />
          )}
        </div>

        {/* Track info */}
        <div className={styles.info}>
          <div className={styles.titleRow}>
            <span className={styles.title}>{track.title}</span>
            <span className={styles.duration}>{formatDuration(track.duration)}</span>
          </div>

          {/* Controls */}
          <div className={styles.controls}>
            <button onClick={onPlay} className={styles.playButton}>
              {isPlaying ? (
                <IoPauseCircle size={32} color={colors.buttonPlay} />
              ) : (
                <IoPlayCircle size={32} color={colors.buttonPlay} />
              )}
            </button>

            {isPlaying ? (
              <div className={styles.waveform}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className={styles.waveformBar}
                    style={{
                      height: 8 + Math.random() * 16,
                      backgroundColor: colors.primary,
                    }}
                  />
                ))}
              </div>
            ) : (
              <button onClick={onPreview} className={styles.previewButton}>
                プレビュー
              </button>
            )}

            <button onClick={onAdd} className={styles.iconButton}>
              <IoAdd size={20} color={colors.buttonPlus} />
            </button>

            <button onClick={onFavorite} className={styles.iconButton}>
              {isFavorite ? (
                <IoHeart size={20} color={colors.buttonHeart} />
              ) : (
                <IoHeartOutline size={20} color={colors.buttonHeart} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className={styles.description}>{track.description}</p>
    </div>
  );
}
