import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { AmbientOrbs } from '@/components/ui/AmbientOrbs';
import { TrackList } from '@/components/track/TrackList';
import { FluxRingDial } from '@/components/ring/FluxRingDial';
import { NowPlaying } from '@/components/player/NowPlaying';
import { useAudioPlayer } from '@/components/player/useAudioPlayer';
import { useTracks, filterTracks } from '@/hooks/useTracks';
import { useSearchFilters } from '@/hooks/useSearchFilters';
import { useUserPlan } from '@/hooks/useUserPlan';
import { amplitudeToLevel } from '@/designs/levelMath';
import type { Track } from '@/types/track';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const TAB_BAR_OFFSET = 68;

/**
 * Home screen — iPad landscape only.
 *
 * Layout mirrors the legacy web HomeScreen:
 *   • Left column: Lv badge + track count + filter banner + TrackList
 *   • Right column: FluxRingDial centered, with a "プレビュー" / "+" action
 *     row above it.
 *
 * Tapping a track opens the full-screen NowPlaying overlay.
 */
export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { tracks, loading } = useTracks();
  const {
    currentTrack,
    isPlaying,
    level,
    playTrack,
  } = useAudioPlayer();
  const { planId } = useUserPlan();
  const { filters, hasActiveFilters, resetFilters } = useSearchFilters();

  // Dial amplitude: user-set "intensity" driven by rotation of the FluxRing.
  // The Lv badge reads from this (not from the audio player) since the dial
  // is what the user is actively controlling.
  const [amplitude, setAmplitude] = useState(0.2);

  // NowPlaying modal state.
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  // Lv badge: derived from the dial amplitude (1..5).
  const dialLevel = useMemo(() => amplitudeToLevel(amplitude), [amplitude]);

  // Free-tier locks all paid tracks.
  const lockedTrackIds = useMemo(() => {
    if (planId !== 'free') return undefined;
    return new Set(tracks.filter((t) => t.paidMusic).map((t) => t.id));
  }, [tracks, planId]);

  // Apply the shared SearchFilters context to the track list.
  const filteredTracks = useMemo(
    () => filterTracks(tracks, filters),
    [tracks, filters],
  );

  // Tapping a track opens NowPlaying. If it's a different track, start it.
  const handlePlayTrack = useCallback(
    (track: Track) => {
      setSelectedTrack(track);
      setShowNowPlaying(true);
      if (currentTrack?.id !== track.id) {
        void playTrack(track);
      }
    },
    [currentTrack, playTrack],
  );

  // Preview button: play the short preview audio without opening NowPlaying.
  const handlePreviewTrack = useCallback(
    (track: Track) => {
      const url = track.previewUrl || track.audioUrl;
      void playTrack(track, url);
    },
    [playTrack],
  );

  // + button on a row: would normally open the playlist picker modal.
  // TODO: wire to PlaylistPickerModal once that component is restored.
  const handleAddTrack = useCallback((_track: Track) => {
    // no-op placeholder
  }, []);

  // Top-right "プレビュー" + "+" controls. The preview action plays the
  // currently selected (or first filtered) track's preview; the + opens the
  // playlist picker.
  const headerTrack = selectedTrack ?? filteredTracks[0] ?? null;

  const handleHeaderPreview = useCallback(() => {
    if (!headerTrack) return;
    handlePreviewTrack(headerTrack);
  }, [headerTrack, handlePreviewTrack]);

  const handleHeaderAdd = useCallback(() => {
    if (!headerTrack) return;
    // TODO: open PlaylistPickerModal once available.
    handleAddTrack(headerTrack);
  }, [headerTrack, handleAddTrack]);

  const handleCloseNowPlaying = useCallback(() => {
    setShowNowPlaying(false);
  }, []);

  const dialSize = Math.min(560, width * 0.42, height - 120);

  const listPaddingBottom = insets.bottom + TAB_BAR_OFFSET + spacing.md;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.row}>
          {/* ── Left column: list + badges ─────────────────────────────── */}
          <View style={styles.listColumn}>
            <View style={styles.levelBar}>
              <Text style={styles.levelText}>Lv.{dialLevel}</Text>
              <Text style={styles.levelCount}>{filteredTracks.length}曲</Text>
            </View>

            {hasActiveFilters && (
              <View style={styles.filterBanner}>
                <Text style={styles.filterBannerText}>検索フィルター適用中</Text>
                <Pressable
                  onPress={resetFilters}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="検索フィルターをクリア"
                  style={styles.filterClearBtn}
                >
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
            )}

            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <TrackList
                tracks={filteredTracks}
                currentTrackId={currentTrack?.id ?? null}
                isPlaying={isPlaying}
                level={level}
                lockedTrackIds={lockedTrackIds}
                onPlayTrack={handlePlayTrack}
                onPreviewTrack={handlePreviewTrack}
                onAddTrack={handleAddTrack}
              />
            )}
            {/* Spacer so the floating tab bar doesn't cover the last row. */}
            <View style={{ height: listPaddingBottom }} />
          </View>

          {/* ── Right column: dial + preview action row ────────────────── */}
          <View style={styles.dialColumn}>
            <View style={styles.previewRow}>
              <Pressable
                onPress={handleHeaderPreview}
                disabled={!headerTrack}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="プレビューを再生"
                style={({ pressed }) => [
                  styles.previewBtn,
                  pressed && styles.previewBtnPressed,
                  !headerTrack && styles.previewBtnDisabled,
                ]}
              >
                <Ionicons name="play" size={14} color={colors.primary} />
              </Pressable>
              <Text style={styles.previewLabel}>プレビュー</Text>
              <Pressable
                onPress={handleHeaderAdd}
                disabled={!headerTrack}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="プレイリストに追加"
                style={({ pressed }) => [
                  styles.addBtn,
                  pressed && styles.previewBtnPressed,
                  !headerTrack && styles.previewBtnDisabled,
                ]}
              >
                <Ionicons name="add" size={18} color={colors.primary} />
              </Pressable>
            </View>

            <View style={styles.dialWrap}>
              <FluxRingDial
                size={dialSize}
                amplitude={amplitude}
                onAmplitudeChange={setAmplitude}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Full-screen NowPlaying overlay. Rendered outside SafeAreaView so it
          can cover the entire screen including the tab bar. */}
      <NowPlaying
        visible={showNowPlaying}
        track={selectedTrack}
        onClose={handleCloseNowPlaying}
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  listColumn: {
    flex: 1,
    minWidth: 0,
  },
  dialColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.md,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },

  // ── Lv / count badge row ──
  levelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginHorizontal: spacing.sm,
  },
  levelText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  levelCount: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },

  // ── Search-filter-applied banner ──
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(145, 120, 189, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(145, 120, 189, 0.18)',
  },
  filterBannerText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.primary,
  },
  filterClearBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },

  // ── Preview row above the dial ──
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  previewBtn: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  previewBtnPressed: {
    opacity: 0.65,
  },
  previewBtnDisabled: {
    opacity: 0.4,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  // ── Dial wrapper ──
  dialWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});
