import { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { TrackList } from '@/components/track/TrackList';
import { FluxRingDial } from '@/components/ring/FluxRingDial';
import { useAudioPlayer } from '@/components/player/useAudioPlayer';
import { useTracks } from '@/hooks/useTracks';
import { usePlaylists } from '@/hooks/usePlaylists';
import { useUserPlan } from '@/hooks/useUserPlan';
import { amplitudeToLevel } from '@/designs/levelMath';
import type { Track } from '@/types/track';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const { tracks, loading } = useTracks();
  const {
    currentTrack,
    isPlaying,
    level,
    playTrack,
  } = useAudioPlayer();
  const { addTrack } = usePlaylists();
  const { planId } = useUserPlan();
  const [amplitude, setAmplitude] = useState(1.0);

  const lockedTrackIds = useMemo(() => {
    if (planId !== 'free') return undefined;
    return new Set(tracks.filter((t) => t.paidMusic).map((t) => t.id));
  }, [tracks, planId]);

  const currentLevel = amplitudeToLevel(amplitude);
  const displayTracks = useMemo(
    () => tracks.filter((t) => t.order === currentLevel),
    [tracks, currentLevel],
  );

  const handlePlay = useCallback(
    (track: Track) => {
      void playTrack(track);
    },
    [playTrack],
  );

  const handlePreview = useCallback(
    (track: Track) => {
      void playTrack(track, track.previewUrl || track.audioUrl);
    },
    [playTrack],
  );

  const handleAdd = useCallback(
    (track: Track) => {
      addTrack('favorites', track.id);
    },
    [addTrack],
  );

  const dialSize = Math.min(560, width * 0.42, height - 100);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.row}>
          <View style={styles.listColumn}>
            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <>
                <View style={styles.levelBar}>
                  <Text style={styles.levelText}>Lv.{currentLevel}</Text>
                  <Text style={styles.levelCount}>{displayTracks.length} 曲</Text>
                </View>
                <TrackList
                  tracks={displayTracks}
                  currentTrackId={currentTrack?.id ?? null}
                  isPlaying={isPlaying}
                  level={level}
                  lockedTrackIds={lockedTrackIds}
                  onPlayTrack={handlePlay}
                  onPreviewTrack={handlePreview}
                  onAddTrack={handleAdd}
                />
              </>
            )}
          </View>
          <View style={styles.dialColumn}>
            <FluxRingDial
              size={dialSize}
              amplitude={amplitude}
              onAmplitudeChange={setAmplitude}
            />
          </View>
        </View>
      </SafeAreaView>
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
    justifyContent: 'center',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    color: colors.textSecondary,
  },
});
