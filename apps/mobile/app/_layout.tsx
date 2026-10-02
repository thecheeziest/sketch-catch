import { useMe } from '@/features/auth/api';
import { useRegisterPushToken } from '@/features/push/api/useRegisterPushToken';
import { registerForPushNotificationsAsync } from '@/features/push/lib/registerForPushNotificationsAsync';
import { useNotificationListeners } from '@/features/push/lib/useNotificationListeners';
import { NotificationGate } from '@/features/push/ui/NotificationGate';
import { queryClient } from '@/shared/api';
import { colors, icons, theme } from '@/shared/config';
import { hydrateAuthStore, useAuthStore, usePresenceStore } from '@/shared/model';
import { ToastHost } from '@/shared/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { DripsyProvider, Image, Text } from 'dripsy';
import Galmuri11 from '@assets/fonts/Galmuri11.ttf';
import Mona12Bold from '@assets/fonts/Mona12-Bold.ttf';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, LogBox, StyleSheet, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function createWobble(logoRotate: Animated.Value): Animated.CompositeAnimation {
  return Animated.sequence([
    Animated.timing(logoRotate, { toValue: 12, duration: 110, useNativeDriver: true }),
    Animated.timing(logoRotate, { toValue: -9, duration: 130, useNativeDriver: true }),
    Animated.timing(logoRotate, { toValue: 6, duration: 110, useNativeDriver: true }),
    Animated.timing(logoRotate, { toValue: -3, duration: 100, useNativeDriver: true }),
    Animated.timing(logoRotate, { toValue: 0, duration: 100, useNativeDriver: true }),
  ]);
}

function SplashOverlay({
  isAuthenticated,
  onDone,
}: {
  isAuthenticated: boolean;
  onDone: () => void;
}) {
  const { isLoading: userIsLoading } = useMe();
  const { width: screenWidth } = useWindowDimensions();

  const splashOpacity = useRef(new Animated.Value(1)).current;
  const logoX = useRef(new Animated.Value(-screenWidth)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const wobbleLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const userIsLoadingRef = useRef(userIsLoading);
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    userIsLoadingRef.current = userIsLoading;
  }, [userIsLoading]);

  const fadeOut = useCallback(() => {
    Animated.timing(splashOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() =>
      onDone(),
    );
  }, [splashOpacity, onDone]);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(logoX, { toValue: 0, speed: 7, bounciness: 5, useNativeDriver: true }),
      createWobble(logoRotate),
      Animated.delay(1000),
    ]).start(() => {
      if (isAuthenticated && userIsLoadingRef.current) {
        setIsWaiting(true);
      } else {
        fadeOut();
      }
    });
  }, []);

  useEffect(() => {
    if (!isWaiting) return;
    const loop = Animated.loop(Animated.sequence([Animated.delay(2000), createWobble(logoRotate)]));
    loop.start();
    wobbleLoopRef.current = loop;
    return () => {
      loop.stop();
      wobbleLoopRef.current = null;
    };
  }, [isWaiting]);

  useEffect(() => {
    if (!isWaiting) return;
    if (isAuthenticated && userIsLoading) return;
    wobbleLoopRef.current?.stop();
    wobbleLoopRef.current = null;
    setIsWaiting(false);
    fadeOut();
  }, [isWaiting, isAuthenticated, userIsLoading, fadeOut]);

  const rotate = logoRotate.interpolate({
    inputRange: [-12, 12],
    outputRange: ['-12deg', '12deg'],
  });

  return (
    <Animated.View style={[styles.splash, { opacity: splashOpacity }]}>
      <Animated.View style={{ transform: [{ translateX: logoX }, { rotate }] }}>
        <Image
          source={icons.LOGO_SPLASH}
          sx={{ width: screenWidth, height: screenWidth / 3 }}
          resizeMode="contain"
        />
      </Animated.View>
      {isWaiting && (
        <Text
          variant="B4"
          sx={{ position: 'absolute', bottom: 60, color: colors.GRAY }}
        >
          정보를 가져오기 위해 춤추는 중..💃🏻
        </Text>
      )}
    </Animated.View>
  );
}

function PushTokenRegistrar({
  isAuthenticated,
  needsOnboarding,
}: {
  isAuthenticated: boolean;
  needsOnboarding: boolean;
}) {
  const registerPushToken = useRegisterPushToken();

  useEffect(() => {
    // D-13: 온보딩 완료 직후 1회 알림 권한 요청 + 토큰 등록
    if (!isAuthenticated || needsOnboarding) return;
    registerForPushNotificationsAsync().then((token) => {
      if (token) registerPushToken.mutate({ token });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, needsOnboarding]);

  return null;
}

if (__DEV__) {
  // 개발 모드 전용 LogBox 노이즈 억제 (릴리즈 빌드에는 영향 없음)
  // - pending callbacks: SplashOverlay의 legacy Animated.loop이 브릿지 완료 콜백을 누적시켜 발생 (근본 원인은 별도 이슈)
  LogBox.ignoreLogs(['Excessive number of pending callbacks', 'Possible unhandled promise rejection']);
}

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Galmuri11,
    'Mona12-Bold': Mona12Bold,
  });
  const isLoaded = useAuthStore((s) => s.isLoaded);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const needsOnboarding = useAuthStore((s) => s.needsOnboarding);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    hydrateAuthStore().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      usePresenceStore.getState().connect();
    } else {
      usePresenceStore.getState().disconnect();
    }
  }, [isAuthenticated]);

  useNotificationListeners();

  useEffect(() => {
    if ((!fontsLoaded && !fontError) || !isLoaded) return;
    SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, fontError, isLoaded]);

  if ((!fontsLoaded && !fontError) || !isLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PushTokenRegistrar isAuthenticated={isAuthenticated} needsOnboarding={needsOnboarding} />
          <DripsyProvider theme={theme}>
            <Stack screenOptions={{ headerShown: false, fullScreenGestureEnabled: true }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" redirect={isAuthenticated && !needsOnboarding} />
              <Stack.Screen name="(tabs)" redirect={!isAuthenticated || needsOnboarding} />
              <Stack.Screen name="settings" redirect={!isAuthenticated || needsOnboarding} />
              <Stack.Screen name="room" redirect={!isAuthenticated || needsOnboarding} />
            </Stack>
            <ToastHost />
            <NotificationGate />
            {!splashDone && (
              <SplashOverlay isAuthenticated={isAuthenticated} onDone={() => setSplashDone(true)} />
            )}
          </DripsyProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.DARK_200,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    overflow: 'hidden',
  },
});
