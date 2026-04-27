import type { CSSProperties } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TabNavigator } from './navigation/TabNavigator';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';

import { PlaylistScreen } from './screens/PlaylistScreen';
import { ArticlesScreen } from './screens/ArticlesScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={splashStyle} />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<TabNavigator />}>
          <Route index element={<HomeScreen />} />
          <Route path="search" element={<HomeScreen searchOpen />} />
          <Route path="playlist" element={<PlaylistScreen />} />
          <Route path="articles" element={<ArticlesScreen />} />
          <Route path="notifications" element={<NotificationsScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

const splashStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #E6EBF1 0%, #dde3ed 50%, #E6EBF1 100%)',
};
