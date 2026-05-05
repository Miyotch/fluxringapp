import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';

type IconName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  focused: boolean;
  color: string;
  size: number;
  active: IconName;
  inactive: IconName;
}

function TabIcon({ focused, color, size, active, inactive }: TabIconProps) {
  return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: (p) => <TabIcon {...p} active="home" inactive="home-outline" />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '検索',
          tabBarIcon: (p) => <TabIcon {...p} active="search" inactive="search-outline" />,
        }}
      />
      <Tabs.Screen
        name="playlist"
        options={{
          title: 'プレイリスト',
          tabBarIcon: (p) => <TabIcon {...p} active="albums" inactive="albums-outline" />,
        }}
      />
      <Tabs.Screen
        name="articles"
        options={{
          title: '記事',
          tabBarIcon: (p) => <TabIcon {...p} active="document-text" inactive="document-text-outline" />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'お知らせ',
          tabBarIcon: (p) => <TabIcon {...p} active="notifications" inactive="notifications-outline" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: (p) => <TabIcon {...p} active="settings" inactive="settings-outline" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.tabBarBackground,
    borderTopColor: colors.tabBarBorder,
    height: Platform.OS === 'ios' ? 78 : 68,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 22 : 10,
  },
  tabItem: {
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
