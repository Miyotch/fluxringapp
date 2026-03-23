import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { PlaylistScreen } from '../screens/PlaylistScreen';
import { ArticlesScreen } from '../screens/ArticlesScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: Array<{
  name: string;
  label: string;
  icon: TabIconName;
  iconOutline: TabIconName;
  component: React.ComponentType;
}> = [
  { name: 'Home', label: 'ホーム', icon: 'home', iconOutline: 'home-outline', component: HomeScreen },
  { name: 'Search', label: '検索', icon: 'search', iconOutline: 'search-outline', component: SearchScreen },
  { name: 'Playlist', label: 'プレイリスト', icon: 'list', iconOutline: 'list-outline', component: PlaylistScreen },
  { name: 'Articles', label: '記事を読む', icon: 'document-text', iconOutline: 'document-text-outline', component: ArticlesScreen },
  { name: 'Notifications', label: 'お知らせ', icon: 'notifications', iconOutline: 'notifications-outline', component: NotificationsScreen },
  { name: 'Settings', label: '設定', icon: 'settings', iconOutline: 'settings-outline', component: SettingsScreen },
];

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarLabel: tab.label,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.icon : tab.iconOutline}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.tabBarBackground,
    borderTopColor: colors.tabBarBorder,
    borderTopWidth: 1,
    paddingBottom: 4,
    paddingTop: 4,
    height: 56,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});
