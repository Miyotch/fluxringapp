import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { initFirebase } from '@/services/firebase';
import { SearchFiltersProvider } from '@/hooks/useSearchFilters';
import { AudioPlayerProvider } from '@/components/player/AudioPlayerContext';

export default function RootLayout() {
  useEffect(() => {
    try {
      initFirebase();
    } catch (err) {
      console.warn('Firebase init failed:', err);
    }

    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch((err) =>
      console.warn('Orientation lock failed:', err),
    );

    SystemUI.setBackgroundColorAsync('#1b1330').catch(() => {});

    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SearchFiltersProvider>
          <AudioPlayerProvider>
            <StatusBar style="dark" hidden />
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="login" />
              <Stack.Screen name="setup-username" />
            </Stack>
          </AudioPlayerProvider>
        </SearchFiltersProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
