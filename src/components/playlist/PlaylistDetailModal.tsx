import { useMemo } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { OrbSphere } from '../ui/OrbSphere';
import { useTracks } from '../../hooks/useTracks';
import type { Playlist } from '../../hooks/usePlaylists';
import type { Track } from '../../types/track';
import { formatDuration } from '../../types/track';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

interface PlaylistDetailModalProps {
  visible: boolean;
  playlist: Playlist | null;
  onClose: () => void;
  onEdit: () => void;
  onPlay: (track: Track) => void;
  onRemoveTrack: (trackId: string) => Promise<void>;
}

export function PlaylistDetailModal({
  visible,
  playlist,
  onClose,
  onEdit,
  onPlay,
  onRemoveTrack,
}: PlaylistDetailModalProps) {
  const { tracks } = useTracks();

  // Resolve the playlist track ids to full Track objects, preserving order.
  const playlistTracks = useMemo<Track[]>(() => {
    if (!playlist) return [];
    return playlist.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is Track => Boolean(t));
  }, [playlist, tracks]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.panel}
          onPress={(event) => event.stopPropagation()}
        >
          {playlist ? (
            <>
              {/* Header */}
              <View style={styles.header}>
                <OrbSphere size={72} hue={playlist.hue} />
                <View style={styles.headerText}>
                  <Text style={styles.kindLabel}>プレイリスト</Text>
                  <Text style={styles.title} numberOfLines={1}>
                    {playlist.name}
                  </Text>
                  <Text style={styles.count}>
                    {playlistTracks.length} 曲
                  </Text>
                </View>
                <Pressable
                  onPress={onEdit}
                  style={styles.headerButton}
                  hitSlop={6}
                  accessibilityLabel="プレイリスト設定を編集"
                >
                  <Ionicons
                    name="settings-outline"
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>
                <Pressable
                  onPress={onClose}
                  style={styles.headerButton}
                  hitSlop={6}
                  accessibilityLabel="閉じる"
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>

              {/* Body */}
              {playlistTracks.length === 0 ? (
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}>
                    <Ionicons
                      name="musical-notes-outline"
                      size={32}
                      color={colors.textMuted}
                    />
                  </View>
                  <Text style={styles.emptyTitle}>
                    曲が追加されていません
                  </Text>
                  <Text style={styles.emptyDesc}>
                    曲リストの「+」ボタンから、このプレイリストへ追加できます
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                >
                  {playlistTracks.map((track) => (
                    <View key={track.id} style={styles.row}>
                      <View style={styles.artwork}>
                        {track.artworkUrl ? (
                          <Image
                            source={{ uri: track.artworkUrl }}
                            style={styles.artworkImage}
                          />
                        ) : (
                          <View style={styles.artworkPlaceholder} />
                        )}
                      </View>
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {track.title}
                        </Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {track.artist} · {formatDuration(track.duration)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => onPlay(track)}
                        style={styles.playButton}
                        hitSlop={6}
                        accessibilityLabel="再生"
                      >
                        <LinearGradient
                          colors={['#a388c8', colors.primary]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFillObject}
                        />
                        <Ionicons
                          name="play"
                          size={14}
                          color={colors.white}
                          style={styles.playIcon}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          void onRemoveTrack(track.id);
                        }}
                        style={styles.removeButton}
                        hitSlop={6}
                        accessibilityLabel="プレイリストから削除"
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  panel: {
    width: 640,
    maxWidth: '94%',
    maxHeight: '88%',
    backgroundColor: colors.backgroundBase,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  kindLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  count: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.backgroundDither,
  },
  artworkImage: {
    width: '100%',
    height: '100%',
  },
  artworkPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.backgroundDither,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    marginLeft: 1,
  },
  removeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 11,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
});
