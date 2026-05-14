import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from 'styled-components/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from '@/theme';
// shared 패키지 import 검증 — 모바일 ↔ shared resolution 확인
import { SHARED_PACKAGE_VERSION } from '@sketch-catch/shared';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* noop */
});

export default function RootLayout(): React.JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts({
    Galmuri11: require('../assets/fonts/Galmuri11.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // eslint-disable-next-line no-console
      console.log('[mobile] shared package version:', SHARED_PACKAGE_VERSION);
      SplashScreen.hideAsync().catch(() => {
        /* noop */
      });
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider theme={theme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(home)" />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
