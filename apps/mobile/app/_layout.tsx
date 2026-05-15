import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from 'styled-components/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { theme } from '@/theme';
import { queryClient } from '@/services/queryClient';
import { hydrateAuthStore, useAuthStore } from '@/stores/auth';
import { ToastHost } from '@/components/Toast';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout(): React.JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Galmuri11: require('../assets/fonts/Galmuri11.ttf'),
  });
  const isLoaded = useAuthStore((s) => s.isLoaded);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    hydrateAuthStore().catch(() => undefined);
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && isLoaded) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError, isLoaded]);

  // Pitfall 6: isLoaded=false면 null 반환 — SplashScreen 유지, redirect 루프 차단
  if ((!fontsLoaded && !fontError) || !isLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" redirect={isAuthenticated} />
              <Stack.Screen name="(tabs)" redirect={!isAuthenticated} />
            </Stack>
            <ToastHost />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
