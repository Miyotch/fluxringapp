import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Track } from '../../types/track';
import { formatDuration } from '../../types/track';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

interface TrackCardProps {
  track: Track;
  isPlaying: boolean;
  /** Synthesized 0..1 amplitude from the audio player. */
  level: number;
  locked?: boolean;
  onPlay: () => void;
  onPreview: () => void;
  onAdd: () => void;
  onLockTap?: () => void;
}

const DOT_COUNT = 8;

function WaveformDots({ level }: { level: number }) {
  const [levels, setLevels] = useState<number[]>(() => new Array(DOT_COUNT).fill(0));

  useEffect(() => {
    let frame: number;
    let tick = 0;
    const loop = () => {
      tick = (tick + 1) % 1024;
      const next: number[] = [];
      for (let i = 0; i < DOT_COUNT; i++) {
        const phase = tick * 0.18 + i * 0.7;
        next.push(Math.max(0, level * (0.5 + 0.5 * Math.sin(phase))));
      }
      setLevels(next);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [level]);

  return (
    <View style={styles.waveform}>
      {levels.map((l, i) => (
        <View
          key={i}
          style={[
            styles.waveformDot,
            {
              transform: [{ scale: 0.6 + l * 0.8 }],
              opacity: 0.4 + l * 0.6,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function TrackCard({
  track,
  isPlaying,
  level,
  locked = false,
  onPlay,
  onPreview,
  onAdd,
  onLockTap,
}: TrackCardProps) {
  const handlePress = () => {
    if (locked && onLockTap) {
      onLockTap();
      return;
    }
    onPlay();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        isPlaying && styles.cardActive,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.artworkRing}>
        {track.artworkUrl ? (
          <Image
            source={{ uri: track.artworkUrl }}
            style={[styles.artwork, locked && styles.artworkLocked]}
          />
        ) : (
          <View style={[styles.artwork, styles.artworkPlaceholder]} />
        )}
        {locked && (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={22} color="#fff" />
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <Text style={styles.title} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={styles.duration}>{formatDuration(track.duration)}</Text>
          </View>

          <View style={styles.controls}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              style={styles.playButton}
              hitSlop={6}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={14}
                color="#fff"
                style={isPlaying ? undefined : { marginLeft: 1 }}
              />
            </Pressable>

            {isPlaying ? (
              <WaveformDots level={level} />
            ) : (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onPreview();
                }}
                hitSlop={4}
              >
                <Text style={styles.previewText}>プレビュー</Text>
              </Pressable>
            )}

            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              style={styles.iconButton}
              hitSlop={6}
            >
              <Ionicons name="add" size={15} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {track.description}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardActive: {
    backgroundColor: colors.cardActiveBackground,
  },
  cardPressed: {
    opacity: 0.85,
  },
  artworkRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.backgroundDither,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  artworkLocked: {
    opacity: 0.6,
  },
  artworkPlaceholder: {
    backgroundColor: colors.backgroundDither,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  duration: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.buttonPlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  iconButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 70,
    justifyContent: 'flex-end',
  },
  waveformDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  description: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },
});
