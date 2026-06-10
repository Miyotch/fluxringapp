import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { initFirebase } from '@/services/firebase';
import { SearchFiltersProvider } from '@/hooks/useSearchFilters';
import { AudioPlayerProvider } from '@/components/player/AudioPlayerContext';
import { DiagnosticsOverlay, diagLog } from '@/components/diagnostics/DiagnosticsOverlay';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    diagLog('root layout mounted');
    try {
      initFirebase();
      diagLog('firebase initialized');
    } catch (err) {
      diagLog(`firebase init failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
      .then(() => diagLog('orientation locked'))
      .catch((err) => diagLog(`orientation lock failed: ${err instanceof Error ? err.message : String(err)}`));
    SplashScreen.hideAsync()
      .then(() => diagLog('splash hidden'))
      .catch((err) => diagLog(`splash hide failed: ${err instanceof Error ? err.message : String(err)}`));
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
            <DiagnosticsOverlay />
          </AudioPlayerProvider>
        </SearchFiltersProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
