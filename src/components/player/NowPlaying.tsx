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
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useAudioPlayerContext } from './AudioPlayerContext';
import { useAuth } from '../../hooks/useAuth';
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

/** Centered player width on iPad landscape. */
const PLAYER_MAX_WIDTH = 480;

export function NowPlaying({
  visible,
  track,
  onClose,
  // onAddToPlaylist intentionally unused in the new layout — kept on the
  // prop type so existing call-sites still type-check.
}: NowPlayingProps) {
  const { width } = useWindowDimensions();
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
  } = useAudioPlayerContext();
  const { user } = useAuth();

  const [premiumOpen, setPremiumOpen] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);

  // ── Auto-play on open ─────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !track) return;
    if (currentTrack?.id !== track.id) {
      void playTrack(track);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, track?.id]);

  // ── Progress bar (thin) with draggable scrubber ───────────────────
  const [barWidth, setBarWidth] = useState(0);
  const dragX = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const progress =
    duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
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
    const ratio =
      barWidth > 0 ? Math.max(0, Math.min(1, e.x / barWidth)) : 0;
    runOnJS(commitSeek)(ratio);
  });

  const scrubGesture = Gesture.Race(panGesture, tapGesture);

  const fillStyle = useAnimatedStyle(() => {
    const w = isDragging.value ? dragX.value : fillWidth;
    return { width: Math.max(0, w) };
  });
  const knobStyle = useAnimatedStyle(() => {
    const x = isDragging.value ? dragX.value : fillWidth;
    return { transform: [{ translateX: Math.max(0, x) - 4 }] };
  });

  // ── Favorite (kept for analytics / future surface — no UI here) ───
  // The new screenshot-driven design intentionally drops the heart from
  // NowPlaying. The handler stays so we don't lose the wiring; favorites
  // are now toggled from TrackCard / PlaylistDetail.
  const _handleToggleFavorite = useCallback(async () => {
    if (!user || !track || favoritePending) return;
    setFavoritePending(true);
    try {
      await toggleFavorite(user.uid, track.id);
    } catch (err) {
      console.warn('toggleFavorite failed:', err);
    } finally {
      setFavoritePending(false);
    }
  }, [user, track, favoritePending]);

  if (!visible || !track) return null;

  // Center the player block within a sensible max width for iPad landscape.
  const playerWidth = Math.min(PLAYER_MAX_WIDTH, width - spacing.xxl * 2);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <Animated.View
        style={styles.root}
        entering={FadeIn.duration(420)}
      >
        {/* ── Background: full-screen artwork + subtle dark overlay ── */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {track.artworkUrl ? (
            <Image
              source={{ uri: track.artworkUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: '#1a1a2e' },
              ]}
            />
          )}
          <View style={styles.darkOverlay} />
        </View>

        {/* ── Top bar ────────────────────────────────────────────── */}
        <View style={styles.topBar} pointerEvents="box-none">
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="閉じる"
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="chevron-back" size={28} color={colors.white} />
          </Pressable>

          <View style={styles.topCenter} pointerEvents="none">
            <Text style={styles.premiumNotice} numberOfLines={1}>
              商用利用はプレミアム機能限定です
            </Text>
          </View>

          <Pressable
            onPress={() => setPremiumOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="プレミアム特典を見る"
            style={({ pressed }) => [
              styles.crownBtnWrap,
              pressed && styles.pressed,
            ]}
          >
            <LinearGradient
              colors={[colors.premium, colors.premiumDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.crownBtn}
            >
              <Ionicons name="trophy" size={22} color="#3a2a08" />
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── Bottom player block ───────────────────────────────── */}
        <View style={styles.bottomWrap} pointerEvents="box-none">
          <View style={[styles.player, { width: playerWidth }]}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {track.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1} ellipsizeMode="tail">
              {track.artist}
            </Text>

            {/* Progress bar — thin */}
            <View style={styles.progressBlock}>
              <GestureDetector gesture={scrubGesture}>
                <View
                  style={styles.progressTrack}
                  onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
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
                  {formatDuration(Math.max(0, Math.floor(duration)))}
                </Text>
              </View>
            </View>

            {/* Transport row */}
            <View style={styles.transportRow}>
              <Pressable
                onPress={() => {
                  void toggleRepeat();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  repeat ? 'リピートをオフ' : 'リピートをオン'
                }
                style={({ pressed }) => [
                  styles.transportSmall,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="repeat"
                  size={22}
                  color={
                    repeat ? colors.white : 'rgba(255,255,255,0.7)'
                  }
                />
              </Pressable>

              <Pressable
                onPress={() => {
                  // TODO: queue navigation — previous track.
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="前の曲"
                style={({ pressed }) => [
                  styles.transportMed,
                  pressed && styles.pressed,
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
                <BlurView intensity={40} tint="light" style={styles.playBtnBlur}>
                  <View style={styles.playBtnInner}>
                    {isPlaying ? (
                      <Ionicons
                        name="pause"
                        size={28}
                        color="#2a2240"
                      />
                    ) : (
                      <Ionicons
                        name="play"
                        size={28}
                        color="#2a2240"
                        style={{ marginLeft: 3 }}
                      />
                    )}
                  </View>
                </BlurView>
              </Pressable>

              <Pressable
                onPress={() => {
                  // TODO: queue navigation — next track.
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="次の曲"
                style={({ pressed }) => [
                  styles.transportMed,
                  pressed && styles.pressed,
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
                  styles.transportSmall,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="shuffle"
                  size={22}
                  color="rgba(255,255,255,0.7)"
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Premium popup ─────────────────────────────────────── */}
        {premiumOpen && (
          <PremiumPopup onClose={() => setPremiumOpen(false)} />
        )}
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Premium popup
// ─────────────────────────────────────────────────────────────────────

function PremiumPopup({ onClose }: { onClose: () => void }) {
  const handleCta = useCallback(() => {
    // TODO: open custom production landing — wire to in-app browser or
    // external link once the marketing URL is finalized.
    console.log('TODO: open custom production');
    onClose();
  }, [onClose]);

  return (
    <Animated.View
      style={StyleSheet.absoluteFill}
      entering={FadeIn.duration(420)}
      pointerEvents="box-none"
    >
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill}>
        <Pressable
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.popupBackdrop]}
          accessibilityRole="button"
          accessibilityLabel="閉じる"
        />
        <View style={styles.popupCenter} pointerEvents="box-none">
          <Animated.View
            style={styles.popupCard}
            entering={FadeIn.duration(420).delay(80)}
          >
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="閉じる"
              style={({ pressed }) => [
                styles.popupClose,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>

            <View style={styles.popupCrown}>
              <View style={styles.popupCrownGlow} />
              <Ionicons name="trophy" size={56} color={colors.premium} />
            </View>

            <Text style={styles.popupTitle}>
              {'アプリで探せない\n『究極の1曲』を。'}
            </Text>
            <Text style={styles.popupSubtitle}>
              あなたのブランド専用の周波数制作はこちら
            </Text>

            <Pressable
              onPress={handleCta}
              accessibilityRole="button"
              accessibilityLabel="カスタム制作を見る"
              style={({ pressed }) => [
                styles.popupCtaWrap,
                pressed && styles.pressed,
              ]}
            >
              <LinearGradient
                colors={[colors.premium, colors.premiumDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.popupCta}
              >
                <Text style={styles.popupCtaText}>カスタム制作を見る →</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </BlurView>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a14',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  pressed: {
    opacity: 0.7,
  },

  // ── Top bar ──
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  premiumNotice: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  crownBtnWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    shadowColor: colors.premium,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  crownBtn: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },

  // ── Bottom player ──
  bottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 88,
    alignItems: 'center',
  },
  player: {
    alignItems: 'stretch',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  artist: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ── Progress bar (thin) ──
  progressBlock: {
    marginTop: 16,
  },
  progressTrack: {
    height: 16,
    justifyContent: 'center',
  },
  progressBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.white,
  },
  progressKnob: {
    position: 'absolute',
    left: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontVariant: ['tabular-nums'],
  },

  // ── Transport row ──
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 32,
  },
  transportSmall: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transportMed: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 10,
  },
  playBtnPressed: {
    opacity: 0.85,
  },
  playBtnBlur: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 28,
  },

  // ── Premium popup ──
  popupBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  popupCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  popupCard: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.xl,
    borderRadius: 20,
    backgroundColor: 'rgba(35, 30, 50, 0.85)',
    borderWidth: 1,
    borderColor: colors.premiumGlow,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 16,
  },
  popupClose: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  popupCrown: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  popupCrownGlow: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.premiumGlow,
    shadowColor: colors.premium,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 24,
    elevation: 12,
    opacity: 0.7,
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    lineHeight: 26,
  },
  popupSubtitle: {
    marginTop: spacing.sm + 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  popupCtaWrap: {
    marginTop: spacing.lg - 4,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    shadowColor: colors.premium,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  popupCta: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3a2a08',
    letterSpacing: 0.4,
  },
});
