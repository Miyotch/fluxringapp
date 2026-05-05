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
  // Shadow must live on a non-overflow-clipping wrapper so it renders
  // outside the rounded capsule.
  shadowWrap: {
    width: '100%',
    maxWidth: 480,
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
