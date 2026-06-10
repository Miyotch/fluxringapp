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
import { DiagnosticsOverlay, diagLog } from '@/components/diagnostics/DiagnosticsOverlay';

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

    // Paint the UIWindow purple so a stuck-white screen can be classified by
    // eye: still white = splash never hid; purple = RN window visible but no
    // content; normal UI = fixed.
    SystemUI.setBackgroundColorAsync('#9178BD')
      .then(() => diagLog('window background set'))
      .catch((err) => diagLog(`window bg failed: ${err instanceof Error ? err.message : String(err)}`));

    // The launch white screen looks like the splash never hiding. Auto-hide
    // is enabled (no preventAutoHideAsync anywhere), and on top of that we
    // retry hideAsync every second for 10s and log each outcome.
    let attempts = 0;
    const splashTimer = setInterval(() => {
      attempts += 1;
      const n = attempts;
      SplashScreen.hideAsync()
        .then(() => diagLog(`splash hide ok (#${n})`))
        .catch((err) =>
          diagLog(`splash hide failed (#${n}): ${err instanceof Error ? err.message : String(err)}`),
        );
      if (n >= 10) clearInterval(splashTimer);
    }, 1000);
    return () => clearInterval(splashTimer);
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
