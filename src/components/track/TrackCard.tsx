import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
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
  /** True when the track is in the user's favorites — drives heart icon fill. */
  favorited?: boolean;
  onPlay: () => void;
  onPreview: () => void;
  /** Legacy "+ to favorites" handler (kept for backwards compat with existing screens). */
  onAdd: () => void;
  /** Heart toggle — falls back to `onAdd` when not provided so old call sites still work. */
  onToggleFavorite?: () => void;
  /** Plus button — opens the playlist picker. Falls back to `onAdd` when not provided. */
  onAddToPlaylist?: () => void;
  onLockTap?: () => void;
}

const DOT_COUNT = 8;
const ARTWORK_SIZE = 76;          // Spec: clamp(56px, 12vw, 96px) — iPad-tuned to 76.
const ARTWORK_RADIUS = ARTWORK_SIZE / 2;
const GLOW_SIZE = 96;             // Slightly larger than artwork for the breathing glow halo.
const GLOW_RADIUS = GLOW_SIZE / 2;
const PLAY_BTN_SIZE = 34;
const ICON_BTN_SIZE = 30;

/**
 * Deterministic 32-bit string hash. Used to give every track its own
 * breathing-glow period and phase so a list of tracks doesn't pulse in
 * lockstep.
 */
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

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
  favorited = false,
  onPlay,
  onPreview,
  onAdd,
  onToggleFavorite,
  onAddToPlaylist,
  onLockTap,
}: TrackCardProps) {
  const handlePress = () => {
    if (locked && onLockTap) {
      onLockTap();
      return;
    }
    onPlay();
  };

  // ─── Breathing glow behind artwork (8000–9000ms period, hash-randomized) ───
  const seed = useMemo(() => hashSeed(track.id), [track.id]);
  const breathPeriod = 8000 + (seed % 1000);
  const breathPhase = seed % 1000;
  const breath = useSharedValue(0);

  // ─── Icon glow on heart + plus (6500–7500ms, separately phased) ───
  const heartIconPeriod = 6500 + (seed % 1000);
  const heartIconPhase = (seed * 7) % 1000;
  const plusIconPeriod = 6500 + ((seed * 13) % 1000);
  const plusIconPhase = (seed * 17) % 1000;
  const heartPulse = useSharedValue(0);
  const plusPulse = useSharedValue(0);

  useEffect(() => {
    breath.value = withDelay(
      breathPhase,
      withRepeat(
        withTiming(1, { duration: breathPeriod, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    heartPulse.value = withDelay(
      heartIconPhase,
      withRepeat(
        withTiming(1, { duration: heartIconPeriod, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    plusPulse.value = withDelay(
      plusIconPhase,
      withRepeat(
        withTiming(1, { duration: plusIconPeriod, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [
    breath,
    heartPulse,
    plusPulse,
    breathPeriod,
    breathPhase,
    heartIconPeriod,
    heartIconPhase,
    plusIconPeriod,
    plusIconPhase,
  ]);

  const breathStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(breath.value, [0, 1], [0.12, 0.55]),
    shadowRadius: interpolate(breath.value, [0, 1], [6, 20]),
  }));

  const heartGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(heartPulse.value, [0, 1], [0.18, 0.5]),
    shadowRadius: interpolate(heartPulse.value, [0, 1], [6, 14]),
  }));

  const plusGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(plusPulse.value, [0, 1], [0.18, 0.5]),
    shadowRadius: interpolate(plusPulse.value, [0, 1], [6, 14]),
  }));

  const handleHeart = onToggleFavorite ?? onAdd;
  const handlePlus = onAddToPlaylist ?? onAdd;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        isPlaying && styles.cardActive,
        pressed && styles.cardPressed,
      ]}
    >
      {/* ── Artwork stack: breathing glow → gradient ring → inner shadow → image → lock ── */}
      <View style={styles.artworkStack}>
        <Animated.View
          pointerEvents="none"
          style={[styles.breathingGlow, breathStyle]}
        />
        <LinearGradient
          // Spec: linear-gradient(135deg, #ffffff → #ece6f8) — neumorphic ring.
          colors={['#ffffff', '#ece6f8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.artworkRing}
        >
          <View style={styles.artworkInnerShadow}>
            {track.artworkUrl ? (
              <Image
                source={{ uri: track.artworkUrl }}
                style={styles.artwork}
              />
            ) : (
              <View style={[styles.artwork, styles.artworkPlaceholder]} />
            )}
            {locked && (
              <>
                {/* Grayscale-ish overlay — RN can't apply a CSS grayscale
                    filter, so we wash the artwork with a neutral gray. */}
                <View pointerEvents="none" style={styles.artworkGrayscale} />
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={22} color="#fff" />
                </View>
              </>
            )}
          </View>
        </LinearGradient>
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
            {/* ── Play / pause button ── */}
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              hitSlop={6}
              style={styles.playButtonShadow}
            >
              <LinearGradient
                // Spec: linear-gradient(145deg, #a388c8, #9178BD)
                colors={['#a388c8', '#9178BD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.playButton}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={16}
                  color="#fff"
                  style={isPlaying ? undefined : { marginLeft: 1 }}
                />
              </LinearGradient>
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

            {/* ── Heart button ── */}
            <Animated.View style={[styles.iconButtonGlow, heartGlowStyle]}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handleHeart();
                }}
                hitSlop={6}
              >
                <LinearGradient
                  colors={['#f5f2fb', '#e6e0f2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconButton}
                >
                  <Ionicons
                    name={favorited ? 'heart' : 'heart-outline'}
                    size={16}
                    color={colors.textPrimary}
                  />
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* ── Plus button ── */}
            <Animated.View style={[styles.iconButtonGlow, plusGlowStyle]}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handlePlus();
                }}
                hitSlop={6}
              >
                <LinearGradient
                  colors={['#f5f2fb', '#e6e0f2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconButton}
                >
                  <Ionicons name="add" size={16} color={colors.textPrimary} />
                </LinearGradient>
              </Pressable>
            </Animated.View>
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
    // Neumorphic drop shadow added on the playing state.
    shadowColor: colors.neumorphShadowDark,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  cardPressed: {
    opacity: 0.85,
  },
  // ── Artwork stack ────────────────────────────────────────────────
  artworkStack: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathingGlow: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_RADIUS,
    // Skia/RN can't render the CSS `box-shadow` blur on a transparent View,
    // so we paint a faint lavender disc and animate the shadow on iOS.
    backgroundColor: 'rgba(180,140,255,0.06)',
    shadowColor: 'rgba(180,140,255,1)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    // Android cannot tint elevation — keep it 0 so we don't get a gray box.
    elevation: 0,
  },
  artworkRing: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: ARTWORK_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2, // Thickness of the gradient ring.
  },
  artworkInnerShadow: {
    width: ARTWORK_SIZE - 4,
    height: ARTWORK_SIZE - 4,
    borderRadius: ARTWORK_RADIUS - 2,
    overflow: 'hidden',
    backgroundColor: colors.backgroundDither,
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle inner-shadow stand-in: a faint border highlights the inner edge.
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  artworkPlaceholder: {
    backgroundColor: colors.backgroundDither,
  },
  artworkGrayscale: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(180,180,180,0.55)',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Content ─────────────────────────────────────────────────────
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
  // ── Play button ─────────────────────────────────────────────────
  playButtonShadow: {
    width: PLAY_BTN_SIZE,
    height: PLAY_BTN_SIZE,
    borderRadius: PLAY_BTN_SIZE / 2,
    // Neumorphic drop (purple-gray). RN limits us to one shadow; the
    // companion white highlight from the spec is approximated by the
    // light gradient stop on the gradient itself.
    shadowColor: 'rgba(174,164,204,1)',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  playButton: {
    width: PLAY_BTN_SIZE,
    height: PLAY_BTN_SIZE,
    borderRadius: PLAY_BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  // ── Heart / plus icon buttons ───────────────────────────────────
  iconButtonGlow: {
    width: ICON_BTN_SIZE,
    height: ICON_BTN_SIZE,
    borderRadius: ICON_BTN_SIZE / 2,
    // Lavender glow — animated via reanimated's shadowOpacity / radius.
    shadowColor: 'rgba(180,140,255,1)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  iconButton: {
    width: ICON_BTN_SIZE,
    height: ICON_BTN_SIZE,
    borderRadius: ICON_BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Waveform ────────────────────────────────────────────────────
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
