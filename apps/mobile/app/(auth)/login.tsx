import { View, Image, Text } from 'dripsy'
import { Linking, Platform, Pressable } from 'react-native'
import { useAppDimensions } from '@/shared/lib/useAppDimensions'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, SketchbookLoadingSpinner, SocialButton } from '@/shared/ui'
import { useKakaoLogin, useAppleLogin, useDevLogin, DEV_TEST_SLOTS, isAppleLoginCanceled } from '@/features/auth/lib'
import { getErrorMessage } from '@/shared/lib'
import { useToastStore } from '@/shared/model'
import { colors, icons, POLICY_URL, spacing, textSizes } from '@/shared/config'

export default function LoginScreen() {
  const router = useRouter()
  const { width: screenWidth } = useAppDimensions()
  const logoWidth = (screenWidth - spacing.XL * 2) * 0.55

  const kakaoLogin = useKakaoLogin()
  const appleLogin = useAppleLogin()
  const devLogin = useDevLogin()
  const isLoggingIn = kakaoLogin.isPending || appleLogin.isPending || devLogin.isPending

  const handleLoginSuccess = (needsOnboarding: boolean): void => {
    if (needsOnboarding) {
      router.replace('/(auth)/onboarding/step1')
    } else {
      router.replace('/(tabs)')
    }
  }

  const handleError = (err: Error): void => {
    console.log('[login] failed', err)
    if (isAppleLoginCanceled(err)) return
    useToastStore.getState().show(
      getErrorMessage(err, {
        fallback: '로그인하지 못했어요. 다시 시도해주세요.',
        serverMessage: '서버 문제로 지금은 로그인할 수 없어요. 잠시 후 다시 시도해주세요.',
      }),
      'error',
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.DARK_200, paddingHorizontal: spacing.XL }}>
      <View sx={{ flex: 6, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={icons.LOGO_SPLASH} sx={{ width: logoWidth, height: logoWidth / 3 }} resizeMode="contain" />
      </View>
      <View sx={{ flex: 4, gap: spacing.SM, justifyContent: Platform.OS === 'ios' ? 'center' : 'flex-end' }}>
        <SocialButton
          provider="kakao"
          disabled={isLoggingIn}
          onPress={() => {
            kakaoLogin.mutate(undefined, {
              onSuccess: (data) => handleLoginSuccess(data.needsOnboarding),
              onError: handleError,
            })
          }}
        />
        {Platform.OS === 'ios' && (
          <SocialButton
            provider="apple"
            disabled={isLoggingIn}
            onPress={() => {
              appleLogin.mutate(undefined, {
                onSuccess: (data) => handleLoginSuccess(data.needsOnboarding),
                onError: handleError,
              })
            }}
          />
        )}
        <View sx={sxStyles.consent}>
          <Text variants={['B3']} sx={{ color: colors.GRAY }}>
            로그인하면{' '}
          </Text>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(POLICY_URL.TERMS)}>
            <Text variants={['B3']} sx={sxStyles.consentLink}>
              이용약관
            </Text>
          </Pressable>
          <Text variants={['B3']} sx={{ color: colors.GRAY }}>
            과{' '}
          </Text>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(POLICY_URL.PRIVACY)}>
            <Text variants={['B3']} sx={sxStyles.consentLink}>
              개인정보처리방침
            </Text>
          </Pressable>
          <Text variants={['B3']} sx={{ color: colors.GRAY }}>
            에 동의하게 돼요.
          </Text>
        </View>
        {/* 개발 빌드 전용 테스트 계정 로그인 — 릴리스 빌드에서는 렌더되지 않는다 */}
        {__DEV__ && (
          <View sx={{ flexDirection: 'row', gap: spacing.XS }}>
            {DEV_TEST_SLOTS.map((slot) => (
              <View key={slot} sx={{ flex: 1 }}>
                <Button
                  label={`테스트${slot}`}
                  color="dark"
                  height={36}
                  disabled={isLoggingIn}
                  onPress={() => {
                    devLogin.mutate(slot, {
                      onSuccess: (data) => handleLoginSuccess(data.needsOnboarding),
                      onError: handleError,
                    })
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </View>
      {isLoggingIn && (
        <View sx={sxStyles.loadingOverlay}>
          <SketchbookLoadingSpinner size={200} accessibilityLabel="로그인 중" />
          <Text sx={{ ...textSizes.B2, color: colors.LIGHT_100 }}>로그인하고 있어요...</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const sxStyles = {
  consent: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.XS },
  consentLink: { color: colors.LIGHT_100, textDecorationLine: 'underline' },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.DARK_200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.MD,
  },
} as const
