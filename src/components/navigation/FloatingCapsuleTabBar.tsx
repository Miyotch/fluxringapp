import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

type IconName = keyof typeof Ionicons.glyphMap;

interface IconPair {
  active: IconName;
  inactive: IconName;
}

/**
 * Maps each tab route name to its Ionicons pair.
 * The route names must match the file names under `app/(tabs)/`.
 */
const ROUTE_ICONS: Record<string, IconPair> = {
  index: { active: 'home', inactive: 'home-outline' },
  search: { active: 'search', inactive: 'search-outline' },
  playlist: { active: 'albums', inactive: 'albums-outline' },
  articles: { active: 'document-text', inactive: 'document-text-outline' },
  notifications: { active: 'notifications', inactive: 'notifications-outline' },
  settings: { active: 'settings', inactive: 'settings-outline' },
};

const FALLBACK_ICONS: IconPair = {
  active: 'ellipse',
  inactive: 'ellipse-outline',
};

/**
 * Floating glassmorphic pill-shaped tab bar.
 *
 * Mirrors the legacy web `TabNavigator.module.css` neumorphic capsule:
 *   - 165deg white→lavender gradient
 *   - backdrop blur
 *   - layered drop + highlight shadow
 *   - 6 evenly-spaced tabs with stacked icon + label
 *
 * Pass via expo-router's `<Tabs tabBar={...} />`.
 */
export function FloatingCapsuleTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const bottomOffset = useMemo(
    () => Math.max(insets.bottom, spacing.md),
    [insets.bottom],
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outer, { bottom: bottomOffset }]}
    >
      {/*
       * RN supports only one shadow per View. The spec calls for a layered
       * shadow stack:
       *   - drop:      8px 8px 24px rgba(155,141,255,0.25)
       *   - highlight: -6px -6px 18px rgba(255,255,255,0.95)
       *   - inset top: inset 0 1px 1px rgba(255,255,255,0.8)
       *   - inset bot: inset 0 -1px 1px rgba(200,190,220,0.08)
       *
       * We render two stacked wrappers: the outer carries the white
       * highlight shadow, the inner carries the purple drop shadow. The
       * inset edges are emulated as 1px slivers inside the rounded clip.
       */}
      <View style={styles.highlightShadowWrap}>
        <View style={styles.shadowWrap}>
          <View style={styles.capsule}>
            <BlurView
              intensity={20}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={[
                colors.tabBarCapsuleStart,
                colors.tabBarCapsuleMid,
                colors.tabBarCapsuleEnd,
              ]}
              locations={[0, 0.4, 1]}
              // 165deg in CSS ≈ start near top-left, end near bottom-right.
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Inset top highlight — emulates `inset 0 1px 1px rgba(255,255,255,0.8)` */}
            <View pointerEvents="none" style={styles.insetTop} />
            {/* Inset bottom shade — emulates `inset 0 -1px 1px rgba(200,190,220,0.08)` */}
            <View pointerEvents="none" style={styles.insetBottom} />
            <View style={styles.row}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const isFocused = state.index === index;

              const label =
                typeof options.tabBarLabel === 'string'
                  ? options.tabBarLabel
                  : typeof options.title === 'string'
                  ? options.title
                  : route.name;

              const icons = ROUTE_ICONS[route.name] ?? FALLBACK_ICONS;
              const iconName = isFocused ? icons.active : icons.inactive;
              const tint = isFocused ? colors.tabActive : colors.tabInactive;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate({
                    name: route.name,
                    params: route.params,
                    merge: true,
                  } as never);
                }
              };

              const onLongPress = () => {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              };

              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={options.tabBarAccessibilityLabel}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={styles.item}
                  hitSlop={8}
                >
                  <Ionicons name={iconName} size={22} color={tint} />
                  <Text
                    numberOfLines={1}
                    style={[styles.label, { color: tint }]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Outer wrapper carries the upper-left white highlight shadow
  // (matches `-6px -6px 18px rgba(255,255,255,0.95)`).
  // RN allows only one shadow per View, so the purple drop shadow lives
  // on the inner `shadowWrap`.
  highlightShadowWrap: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 34,
    backgroundColor: 'transparent',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: -6, height: -6 },
    shadowOpacity: 0.95,
    shadowRadius: 18,
    // Android cannot tint elevation — fall back to the purple drop only.
    elevation: 0,
  },
  // Shadow must live on a non-overflow-clipping wrapper so it renders
  // outside the rounded capsule.
  shadowWrap: {
    width: '100%',
    borderRadius: 34,
    backgroundColor: 'transparent',
    // Layered drop shadow (matches `8px 8px 24px rgba(155,141,255,0.25)`).
    shadowColor: colors.tabBarCapsuleShadow,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  capsule: {
    height: 68,
    width: '100%',
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.tabBarCapsuleBorder,
  },
  // 1px sliver pinned to the top inner edge of the capsule.
  // Emulates `inset 0 1px 1px rgba(255,255,255,0.8)`.
  insetTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  // 1px sliver pinned to the bottom inner edge of the capsule.
  // Emulates `inset 0 -1px 1px rgba(200,190,220,0.08)`.
  insetBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(200,190,220,0.08)',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm + 4, // 12 — matches CSS `padding: 0 12px`
  },
  item: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: borderRadius.sm / 2, // 4
    paddingVertical: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
  },
});
