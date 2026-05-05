import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { OrbSphere } from '@/components/ui/OrbSphere';
import { TrackCard } from '@/components/track/TrackCard';
import { PlaylistEditModal } from '@/components/playlist/PlaylistEditModal';
import { PlaylistDetailModal } from '@/components/playlist/PlaylistDetailModal';
import { useTracks } from '@/hooks/useTracks';
import { usePlaylists, type Playlist } from '@/hooks/usePlaylists';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useAudioPlayer } from '@/components/player/useAudioPlayer';
import type { Track } from '@/types/track';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

type EditModalState =
  | { mode: 'create' }
  | { mode: 'edit'; playlist: Playlist }
  | null;

export default function PlaylistScreen() {
  const { tracks } = useTracks();
  const {
    playlists,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addTrack,
    removeTrack,
  } = usePlaylists();
  const { planId } = useUserPlan();
  const {
    currentTrack,
    isPlaying,
    level,
    playTrack,
    togglePlayPause,
  } = useAudioPlayer();

  const [editModal, setEditModal] = useState<EditModalState>(null);
  const [detailPlaylistId, setDetailPlaylistId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  // Resolve detail playlist live so it stays fresh as the user edits / removes.
  const detailPlaylist = useMemo(
    () =>
      detailPlaylistId
        ? playlists.find((p) => p.id === detailPlaylistId) ?? null
        : null,
    [detailPlaylistId, playlists],
  );

  // Section 1: top 10 tracks
  const recentTracks = useMemo(() => tracks.slice(0, 10), [tracks]);

  // Section 2: paid / custom tracks (only relevant for premium users)
  const customTracks = useMemo(
    () => tracks.filter((t) => t.paidMusic),
    [tracks],
  );

  const isPremium = planId === 'premium';

  const handlePlay = useCallback(
    (track: Track) => {
      if (currentTrack?.id === track.id) {
        void togglePlayPause();
      } else {
        void playTrack(track);
      }
    },
    [currentTrack, togglePlayPause, playTrack],
  );

  const handlePreview = useCallback(
    (track: Track) => {
      void playTrack(track, track.previewUrl || track.audioUrl);
    },
    [playTrack],
  );

  const handleAddToFavorites = useCallback(
    (track: Track) => {
      addTrack('favorites', track.id);
    },
    [addTrack],
  );

  const handleSavePlaylist = useCallback(
    async ({ name, hue }: { name: string; hue: number }) => {
      if (editModal?.mode === 'edit') {
        updatePlaylist(editModal.playlist.id, name, hue);
      } else {
        createPlaylist(name, hue);
      }
      setEditModal(null);
    },
    [editModal, createPlaylist, updatePlaylist],
  );

  const handleDeletePlaylist = useCallback(async () => {
    if (editModal?.mode !== 'edit') return;
    const id = editModal.playlist.id;
    deletePlaylist(id);
    if (detailPlaylistId === id) setDetailPlaylistId(null);
    setEditModal(null);
  }, [editModal, deletePlaylist, detailPlaylistId]);

  const handleRemoveFromPlaylist = useCallback(
    async (trackId: string) => {
      if (detailPlaylistId) {
        removeTrack(detailPlaylistId, trackId);
      }
    },
    [detailPlaylistId, removeTrack],
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            paddingBottom: insets.bottom + 68 + 16,
          }}
        >
          {/* Heading */}
          <View>
            <Text style={styles.heading}>ライブラリ</Text>
            <Text style={styles.subheading}>
              コードやプレイリストを管理できるページ
            </Text>
          </View>

          {/* ── Section 1: Recently played ── */}
          <Section title="最近再生した曲">
            {recentTracks.length === 0 ? (
              <Text style={styles.emptyText}>まだ再生履歴がありません</Text>
            ) : (
              recentTracks.map((track) => {
                const isCurrent = currentTrack?.id === track.id;
                return (
                  <TrackCard
                    key={track.id}
                    track={track}
                    isPlaying={isCurrent && isPlaying}
                    level={isCurrent && isPlaying ? level : 0}
                    onPlay={() => handlePlay(track)}
                    onPreview={() => handlePreview(track)}
                    onAdd={() => handleAddToFavorites(track)}
                  />
                );
              })
            )}
          </Section>

          {/* ── Section 2: Custom production ── */}
          <Section title="カスタム制作">
            {isPremium ? (
              customTracks.length === 0 ? (
                <Text style={styles.emptyText}>
                  カスタム制作の曲はまだありません
                </Text>
              ) : (
                customTracks.map((track) => {
                  const isCurrent = currentTrack?.id === track.id;
                  return (
                    <TrackCard
                      key={track.id}
                      track={track}
                      isPlaying={isCurrent && isPlaying}
                      level={isCurrent && isPlaying ? level : 0}
                      onPlay={() => handlePlay(track)}
                      onPreview={() => handlePreview(track)}
                      onAdd={() => handleAddToFavorites(track)}
                    />
                  );
                })
              )
            ) : (
              <View style={styles.lockCard}>
                <View style={styles.lockIconCircle}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={32}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.lockTitle}>
                  カスタム制作はプレミアム機能です
                </Text>
                <Text style={styles.lockDesc}>
                  あなただけのオリジナル楽曲を作成するには、プレミアムプランへの
                  アップグレードが必要です
                </Text>
                <Pressable
                  // TODO: subscription flow
                  onPress={() => {}}
                  style={styles.upgradeButton}
                >
                  <LinearGradient
                    colors={['#a388c8', colors.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text style={styles.upgradeText}>
                    プレミアムにアップグレード
                  </Text>
                </Pressable>
              </View>
            )}
          </Section>

          {/* ── Section 3: Created playlists ── */}
          <Section title="作成したプレイリスト">
            <View style={styles.grid}>
              {playlists.map((pl) => (
                <Pressable
                  key={pl.id}
                  onPress={() => setDetailPlaylistId(pl.id)}
                  onLongPress={() =>
                    setEditModal({ mode: 'edit', playlist: pl })
                  }
                  style={({ pressed }) => [
                    styles.gridCell,
                    pressed && styles.gridCellPressed,
                  ]}
                >
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      setEditModal({ mode: 'edit', playlist: pl });
                    }}
                    style={styles.gearButton}
                    hitSlop={6}
                    accessibilityLabel="プレイリスト設定"
                  >
                    <Ionicons
                      name="settings-outline"
                      size={14}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                  <OrbSphere size={72} hue={pl.hue} />
                  <Text style={styles.gridName} numberOfLines={1}>
                    {pl.name}
                  </Text>
                  <Text style={styles.gridCount}>
                    {pl.trackIds.length} 曲
                  </Text>
                </Pressable>
              ))}

              {/* "+" cell — opens the create modal. */}
              <Pressable
                onPress={() => setEditModal({ mode: 'create' })}
                style={({ pressed }) => [
                  styles.gridCell,
                  styles.gridCellAdd,
                  pressed && styles.gridCellPressed,
                ]}
              >
                <View style={styles.addOrb}>
                  <Ionicons name="add" size={32} color={colors.primary} />
                </View>
                <Text style={styles.gridName}>新規作成</Text>
                <Text style={styles.gridCount}>プレイリスト</Text>
              </Pressable>
            </View>
          </Section>
        </ScrollView>
      </SafeAreaView>

      {/* Modals */}
      <PlaylistEditModal
        visible={editModal !== null}
        mode={editModal?.mode === 'edit' ? 'edit' : 'create'}
        playlist={editModal?.mode === 'edit' ? editModal.playlist : undefined}
        onClose={() => setEditModal(null)}
        onSave={handleSavePlaylist}
        onDelete={
          editModal?.mode === 'edit' &&
          editModal.playlist.id !== 'favorites'
            ? handleDeletePlaylist
            : undefined
        }
      />
      <PlaylistDetailModal
        visible={detailPlaylist !== null}
        playlist={detailPlaylist}
        onClose={() => setDetailPlaylistId(null)}
        onEdit={() =>
          detailPlaylist &&
          setEditModal({ mode: 'edit', playlist: detailPlaylist })
        }
        onPlay={handlePlay}
        onRemoveTrack={handleRemoveFromPlaylist}
      />
    </GradientBackground>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  section: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sectionBody: {
    gap: spacing.xs,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },

  // Locked card — single big centered card
  lockCard: {
    width: '100%',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  lockIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(145,120,189,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  lockTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  lockDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 420,
    marginBottom: spacing.md,
  },
  upgradeButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },

  // Playlist grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridCell: {
    width: '32%',
    minHeight: 140,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  gridCellPressed: {
    backgroundColor: colors.cardActiveBackground,
  },
  gridCellAdd: {
    borderStyle: 'dashed',
    borderColor: 'rgba(145,120,189,0.35)',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  addOrb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(145,120,189,0.08)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(145,120,189,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 6,
  },
  gridCount: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  gearButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});

