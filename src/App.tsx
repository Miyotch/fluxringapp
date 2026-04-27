import type { CSSProperties } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TabNavigator } from './navigation/TabNavigator';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SetupUsernameScreen } from './screens/SetupUsernameScreen';

import { PlaylistScreen } from './screens/PlaylistScreen';
import { ArticlesScreen } from './screens/ArticlesScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AdminScreen } from './screens/admin/AdminScreen';
import { useAuth } from './hooks/useAuth';
import { useUserPlan } from './hooks/useUserPlan';

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { needsUsername, loading: planLoading } = useUserPlan();

  if (authLoading || (user && planLoading)) {
    return <div style={splashStyle} />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (needsUsername) {
    return <SetupUsernameScreen />;
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
          <Route path="admin" element={<AdminScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

const splashStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #E6EBF1 0%, #dde3ed 50%, #E6EBF1 100%)',
};
