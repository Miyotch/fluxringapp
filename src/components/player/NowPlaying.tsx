import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

import { useAudioPlayer } from './useAudioPlayer';
import { useAuth } from '../../hooks/useAuth';
import { useUserPlan } from '../../hooks/useUserPlan';
import { toggleFavorite } from '../../services/firestore';
import type { Track } from '../../types/track';
import { formatDuration } from '../../types/track';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

export interface NowPlayingProps {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
  /** Optional hook to launch the playlist picker. No-op if absent. */
  onAddToPlaylist?: (track: Track) => void;
}

const ARTWORK_MAX = 360;

export function NowPlaying({
  visible,
  track,
  onClose,
  onAddToPlaylist,
}: NowPlayingProps) {
  const { width, height } = useWindowDimensions();
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    repeat,
    playTrack,
    togglePlayPause,
    seekTo,
    toggleRepeat,
  } = useAudioPlayer();
  const { user } = useAuth();
  const { planId } = useUserPlan();
  const isPremium = planId === 'premium';

  const [favoritePending, setFavoritePending] = useState(false);
  const [favorited, setFavorited] = useState(false);

  // ── Auto-play on open ─────────────────────────────────────────────
  // When the modal opens with a different track than the engine is
  // currently playing, kick off playback. We only fire when `visible`
  // flips on, so re-renders don't restart the track.
  useEffect(() => {
    if (!visible || !track) return;
    if (currentTrack?.id !== track.id) {
      void playTrack(track);
    }
    // We intentionally exclude playTrack/currentTrack to avoid re-firing on
    // every status update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, track?.id]);

  // ── Progress bar with draggable scrubber ──────────────────────────
  const [barWidth, setBarWidth] = useState(0);
  const dragX = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const progress = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
  const fillWidth = barWidth * progress;

  const commitSeek = useCallback(
    (ratio: number) => {
      if (duration <= 0) return;
      const target = Math.max(0, Math.min(duration, ratio * duration));
      void seekTo(target);
    },
    [duration, seekTo],
  );

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      isDragging.value = true;
      dragX.value = Math.max(0, Math.min(barWidth, e.x));
    })
    .onUpdate((e) => {
      dragX.value = Math.max(0, Math.min(barWidth, e.x));
    })
    .onEnd(() => {
      const ratio = barWidth > 0 ? dragX.value / barWidth : 0;
      isDragging.value = false;
      runOnJS(commitSeek)(ratio);
    });

  const tapGesture = Gesture.Tap().onEnd((e) => {
    const ratio = barWidth > 0 ? Math.max(0, Math.min(1, e.x / barWidth)) : 0;
    runOnJS(commitSeek)(ratio);
  });

  const scrubGesture = Gesture.Race(panGesture, tapGesture);

  const fillStyle = useAnimatedStyle(() => {
    const w = isDragging.value ? dragX.value : fillWidth;
    return { width: Math.max(0, w) };
  });
  const knobStyle = useAnimatedStyle(() => {
    const x = isDragging.value ? dragX.value : fillWidth;
    return { transform: [{ translateX: Math.max(0, x) - 6 }] };
  });

  // ── Favorite toggle ───────────────────────────────────────────────
  const handleToggleFavorite = useCallback(async () => {
    if (!user || !track || favoritePending) return;
    setFavoritePending(true);
    // Optimistic UI flip; we don't have a live favorites subscription here so
    // we just track the in-modal heart state.
    setFavorited((prev) => !prev);
    try {
      await toggleFavorite(user.uid, track.id);
    } catch (err) {
      console.warn('toggleFavorite failed:', err);
      // Revert on failure
      setFavorited((prev) => !prev);
    } finally {
      setFavoritePending(false);
    }
  }, [user, track, favoritePending]);

  // Reset favorited indicator when the track changes.
  useEffect(() => {
    setFavorited(false);
  }, [track?.id]);

  const handleAddToPlaylist = useCallback(() => {
    if (!track) return;
    onAddToPlaylist?.(track);
    // TODO: queue navigation — open PlaylistPickerModal once available.
  }, [track, onAddToPlaylist]);

  if (!visible || !track) return null;

  // iPad-landscape sizing: artwork is square, capped at 360, but also
  // shouldn't exceed ~45% of either viewport axis on smaller iPads.
  const artworkSize = Math.min(ARTWORK_MAX, height * 0.55, width * 0.4);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.root}>
        {/* ── Background: blurred artwork + dark overlay ─────────────── */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {track.artworkUrl ? (
            <Image
              source={{ uri: track.artworkUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              blurRadius={20}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: '#1a1a2e' },
              ]}
            />
          )}
          <BlurView
            intensity={70}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.darkOverlay} />
        </View>

        {/* ── Top bar ────────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="閉じる"
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.iconBtnPressed,
            ]}
          >
            <Ionicons name="close" size={26} color={colors.white} />
          </Pressable>

          {track.paidMusic ? (
            isPremium ? (
              <View style={styles.vipBadge}>
                <Ionicons name="diamond-outline" size={14} color={colors.white} />
                <Text style={styles.vipLabel}>VIP</Text>
              </View>
            ) : (
              <View style={styles.crownBtn}>
                <FontAwesome5 name="crown" size={16} color="#FFD54A" solid />
              </View>
            )
          ) : (
            // Empty spacer to keep close button left-aligned
            <View style={styles.topRightSpacer} />
          )}
        </View>

        {/* ── Center: artwork + meta + transport, two-column on iPad ─ */}
        <View style={styles.body}>
          {/* Artwork */}
          <View style={styles.artworkColumn}>
            <View
              style={[
                styles.artworkWrap,
                { width: artworkSize, height: artworkSize },
              ]}
            >
              {track.artworkUrl ? (
                <Image
                  source={{ uri: track.artworkUrl }}
                  style={styles.artwork}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.artwork,
                    { backgroundColor: 'rgba(255,255,255,0.08)' },
                  ]}
                />
              )}
            </View>
          </View>

          {/* Right column: title / progress / transport / bottom row */}
          <View style={styles.controlsColumn}>
            <View style={styles.titleBlock}>
              <Text
                style={styles.title}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {track.title}
              </Text>
              <Text
                style={styles.artist}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {track.artist}
              </Text>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBlock}>
              <GestureDetector gesture={scrubGesture}>
                <View
                  style={styles.progressTrack}
                  onLayout={(e) =>
                    setBarWidth(e.nativeEvent.layout.width)
                  }
                >
                  <View style={styles.progressBg} />
                  <Animated.View style={[styles.progressFill, fillStyle]} />
                  <Animated.View style={[styles.progressKnob, knobStyle]} />
                </View>
              </GestureDetector>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>
                  {formatDuration(Math.floor(position))}
                </Text>
                <Text style={styles.timeText}>
                  -
                  {formatDuration(
                    Math.max(0, Math.floor(duration - position)),
                  )}
                </Text>
              </View>
            </View>

            {/* Transport row: repeat / prev / play / next / shuffle */}
            <View style={styles.transportRow}>
              <Pressable
                onPress={() => {
                  void toggleRepeat();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={repeat ? 'リピートをオフ' : 'リピートをオン'}
                style={({ pressed }) => [
                  styles.iconBtn,
                  pressed && styles.iconBtnPressed,
                ]}
              >
                <Ionicons
                  name="repeat"
                  size={22}
                  color={
                    repeat ? colors.white : 'rgba(255,255,255,0.5)'
                  }
                />
                {repeat && <View style={styles.repeatDot} />}
              </Pressable>

              <Pressable
                onPress={() => {
                  // TODO: queue navigation — previous track.
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="前の曲"
                style={({ pressed }) => [
                  styles.iconBtn,
                  pressed && styles.iconBtnPressed,
                ]}
              >
                <Ionicons
                  name="play-skip-back"
                  size={26}
                  color={colors.white}
                />
              </Pressable>

              <Pressable
                onPress={() => {
                  void togglePlayPause();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? '一時停止' : '再生'}
                style={({ pressed }) => [
                  styles.playBtnWrap,
                  pressed && styles.playBtnPressed,
                ]}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.10)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.playBtn}
                >
                  {isPlaying ? (
                    <Ionicons
                      name="pause"
                      size={32}
                      color={colors.white}
                    />
                  ) : (
                    <Ionicons
                      name="play"
                      size={32}
                      color={colors.white}
                      style={{ marginLeft: 3 }}
                    />
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => {
                  // TODO: queue navigation — next track.
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="次の曲"
                style={({ pressed }) => [
                  styles.iconBtn,
                  pressed && styles.iconBtnPressed,
                ]}
              >
                <Ionicons
                  name="play-skip-forward"
                  size={26}
                  color={colors.white}
                />
              </Pressable>

              <Pressable
                onPress={() => {
                  // TODO: queue navigation — shuffle toggle.
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="シャッフル"
                style={({ pressed }) => [
                  styles.iconBtn,
                  pressed && styles.iconBtnPressed,
                ]}
              >
                <Ionicons
                  name="shuffle"
                  size={22}
                  color="rgba(255,255,255,0.5)"
                />
              </Pressable>
            </View>

            {/* Bottom row: heart / playlist add / share */}
            <View style={styles.bottomRow}>
              <Pressable
                onPress={() => {
                  void handleToggleFavorite();
                }}
                disabled={!user || favoritePending}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="お気に入り"
                style={({ pressed }) => [
                  styles.bottomIconBtn,
                  pressed && styles.iconBtnPressed,
                  !user && styles.bottomIconBtnDisabled,
                ]}
              >
                <Ionicons
                  name={favorited ? 'heart' : 'heart-outline'}
                  size={22}
                  color={
                    favorited ? '#FF6B8E' : 'rgba(255,255,255,0.85)'
                  }
                />
              </Pressable>

              <Pressable
                onPress={handleAddToPlaylist}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="プレイリストに追加"
                style={({ pressed }) => [
                  styles.bottomIconBtn,
                  pressed && styles.iconBtnPressed,
                ]}
              >
                <Ionicons
                  name="add"
                  size={24}
                  color="rgba(255,255,255,0.85)"
                />
              </Pressable>

              <Pressable
                onPress={() => {
                  // TODO: share intent — wire to RN Share API.
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="共有"
                style={({ pressed }) => [
                  styles.bottomIconBtn,
                  pressed && styles.iconBtnPressed,
                ]}
              >
                <Ionicons
                  name="share-outline"
                  size={22}
                  color="rgba(255,255,255,0.85)"
                />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a14',
  },

  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconBtnPressed: {
    opacity: 0.6,
  },
  topRightSpacer: {
    width: 40,
    height: 40,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  vipLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.white,
  },
  crownBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,213,74,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,213,74,0.5)',
  },

  // ── Body: two columns (artwork + controls) ──
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xxl,
  },
  artworkColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkWrap: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 12,
  },
  artwork: {
    width: '100%',
    height: '100%',
  },

  controlsColumn: {
    flex: 1,
    maxWidth: 480,
    justifyContent: 'center',
  },

  // ── Title / artist ──
  titleBlock: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: 6,
  },
  artist: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ── Progress bar ──
  progressBlock: {
    marginBottom: spacing.lg,
  },
  progressTrack: {
    height: 28,
    justifyContent: 'center',
  },
  progressBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.white,
  },
  progressKnob: {
    position: 'absolute',
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontVariant: ['tabular-nums'],
  },

  // ── Transport row ──
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  repeatDot: {
    position: 'absolute',
    bottom: 6,
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.white,
  },
  playBtnWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  playBtnPressed: {
    opacity: 0.85,
  },
  playBtn: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 32,
  },

  // ── Bottom row: favorite / playlist / share ──
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  bottomIconBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  bottomIconBtnDisabled: {
    opacity: 0.4,
  },
});
