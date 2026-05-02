import { useRef, useEffect, useState } from 'react';
import {
  IoPlay,
  IoPause,
  IoAdd,
  IoLockClosed,
} from 'react-icons/io5';
import type { Track } from '../../types/track';
import { formatDuration } from '../../types/track';
import styles from './TrackCard.module.css';

interface TrackCardProps {
  track: Track;
  index?: number;
  isPlaying: boolean;
  analyserNode: AnalyserNode | null;
  locked?: boolean;
  onPlay: () => void;
  onPreview: () => void;
  onAdd: () => void;
  onLockTap?: () => void;
}

const DOT_COUNT = 8;

function WaveformDots({ analyserNode }: { analyserNode: AnalyserNode | null }) {
  const [levels, setLevels] = useState<number[]>(() => new Array(DOT_COUNT).fill(0));
  const rafRef = useRef(0);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  useEffect(() => {
    if (!analyserNode) return;
    const binCount = analyserNode.frequencyBinCount;
    dataRef.current = new Uint8Array(binCount);

    function tick() {
      if (!analyserNode || !dataRef.current) return;
      analyserNode.getByteFrequencyData(dataRef.current);
      const data = dataRef.current;
      const step = Math.max(1, Math.floor(data.length / DOT_COUNT));
      const newLevels: number[] = [];
      for (let i = 0; i < DOT_COUNT; i++) {
        const idx = Math.min(i * step, data.length - 1);
        newLevels.push(data[idx] / 255);
      }
      setLevels(newLevels);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserNode]);

  return (
    <div className={styles.waveform}>
      {levels.map((level, i) => (
        <span
          key={i}
          className={styles.waveformDot}
          style={{
            transform: `scale(${0.6 + level * 0.8})`,
            opacity: 0.4 + level * 0.6,
          }}
        />
      ))}
    </div>
  );
}

export function TrackCard({
  track,
  isPlaying,
  analyserNode,
  locked = false,
  onPlay,
  onPreview,
  onAdd,
  onLockTap,
}: TrackCardProps) {
  const hash = track.id.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const period = (8.0 + Math.abs(hash % 370) / 100).toFixed(2) + 's';
  const phase = (-Math.abs((hash * 2654435761) % 950) / 100).toFixed(2) + 's';

  const addGlow = {
    ['--glow-period' as string]: (6.5 + Math.abs(hash % 250) / 100) + 's',
    ['--glow-phase' as string]: (-Math.abs((hash * 31) % 800) / 100) + 's',
  };

  const handleCardClick = () => {
    if (locked && onLockTap) { onLockTap(); return; }
    onPlay();
  };

  return (
    <div
      className={`${styles.card} ${isPlaying ? styles.cardActive : ''}`}
      onClick={handleCardClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Artwork */}
      <div className={styles.artworkContainer}>
        <div
          className="thumb-glow-ring"
          style={{ ['--period' as any]: period, ['--phase' as any]: phase }}
        />
        <div className={styles.artworkRing}>
          {track.artworkUrl ? (
            <img
              src={track.artworkUrl}
              alt={track.title}
              className={styles.artwork}
              style={locked ? { filter: 'brightness(0.7) grayscale(0.3)' } : undefined}
            />
          ) : (
            <div className={`${styles.artwork} ${styles.artworkPlaceholder}`} />
          )}
          {locked && (
            <div className={styles.lockOverlay}>
              <IoLockClosed size={22} color="#fff" />
            </div>
          )}
        </div>
      </div>

      {/* Right content */}
      <div className={styles.content}>
        <div className={styles.headerRow}>
          <div className={styles.titleGroup}>
            <span className={styles.title}>{track.title}</span>
            <span className={styles.duration}>{formatDuration(track.duration)}</span>
          </div>

          <div className={styles.controls} onClick={(e) => e.stopPropagation()}>
            <button onClick={onPlay} className={styles.playButton} type="button">
              {isPlaying ? <IoPause size={14} /> : <IoPlay size={14} style={{ marginLeft: 1 }} />}
            </button>

            {isPlaying ? (
              <WaveformDots analyserNode={analyserNode} />
            ) : (
              <button onClick={onPreview} className={styles.previewText} type="button">
                プレビュー
              </button>
            )}

            <button onClick={onAdd} className={styles.iconButton} type="button" style={addGlow}>
              <IoAdd size={15} />
            </button>
          </div>
        </div>

        <p className={styles.description}>{track.description}</p>
      </div>
    </div>
  );
}
