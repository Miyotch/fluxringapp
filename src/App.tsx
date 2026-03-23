import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TabNavigator } from './navigation/TabNavigator';
import { HomeScreen } from './screens/HomeScreen';
import { SearchScreen } from './screens/SearchScreen';
import { PlaylistScreen } from './screens/PlaylistScreen';
import { ArticlesScreen } from './screens/ArticlesScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<TabNavigator />}>
          <Route index element={<HomeScreen />} />
          <Route path="search" element={<SearchScreen />} />
          <Route path="playlist" element={<PlaylistScreen />} />
          <Route path="articles" element={<ArticlesScreen />} />
          <Route path="notifications" element={<NotificationsScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
