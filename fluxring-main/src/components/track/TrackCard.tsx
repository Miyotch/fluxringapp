import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import type { Track } from '../../types/track';
import { formatDuration } from '../../types/track';

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
    <View style={[styles.card, isPlaying && styles.cardActive]}>
      <View style={styles.row}>
        {/* Album art */}
        <View style={styles.artworkContainer}>
          {track.artworkUrl ? (
            <Image source={{ uri: track.artworkUrl }} style={styles.artwork} />
          ) : (
            <View style={[styles.artwork, styles.artworkPlaceholder]} />
          )}
        </View>

        {/* Track info */}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={styles.duration}>{formatDuration(track.duration)}</Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity onPress={onPlay} style={styles.playButton}>
              <Ionicons
                name={isPlaying ? 'pause-circle' : 'play-circle'}
                size={32}
                color={colors.buttonPlay}
              />
            </TouchableOpacity>

            {isPlaying ? (
              <View style={styles.waveform}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveformBar,
                      { height: 8 + Math.random() * 16 },
                    ]}
                  />
                ))}
              </View>
            ) : (
              <>
                <TouchableOpacity onPress={onPreview} style={styles.previewButton}>
                  <Text style={styles.previewText}>プレビュー</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={onAdd} style={styles.iconButton}>
              <Ionicons name="add" size={20} color={colors.buttonPlus} />
            </TouchableOpacity>

            <TouchableOpacity onPress={onFavorite} style={styles.iconButton}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={20}
                color={colors.buttonHeart}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.description} numberOfLines={2}>
        {track.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  cardActive: {
    backgroundColor: colors.cardActiveBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artworkContainer: {
    marginRight: spacing.md,
  },
  artwork: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  artworkPlaceholder: {
    backgroundColor: colors.backgroundEnd,
  },
  info: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  duration: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playButton: {
    marginRight: spacing.xs,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
    height: 24,
  },
  waveformBar: {
    width: 3,
    backgroundColor: colors.primary,
    borderRadius: 1.5,
    opacity: 0.6,
  },
  previewButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(155, 143, 212, 0.1)',
  },
  previewText: {
    fontSize: 12,
    color: colors.primary,
  },
  iconButton: {
    padding: spacing.xs,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 18,
    paddingLeft: 64 + spacing.md,
  },
});
