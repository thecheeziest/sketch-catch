import { View, Image } from 'dripsy'
import { Platform, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, SocialButton } from '@/shared/ui'
import { useKakaoLogin, useAppleLogin, useDevLogin, DEV_TEST_SLOTS } from '@/features/auth/lib'
import { useToastStore } from '@/shared/model'
import { colors, icons, spacing } from '@/shared/config'

export default function LoginScreen() {
  const router = useRouter()
  const { width: screenWidth } = useWindowDimensions()
  const logoWidth = (screenWidth - spacing.XL * 2) * 0.55

  const kakaoLogin = useKakaoLogin()
  const appleLogin = useAppleLogin()
  const devLogin = useDevLogin()

  const handleLoginSuccess = (needsOnboarding: boolean): void => {
    if (needsOnboarding) {
      router.replace('/(auth)/onboarding/step1')
    } else {
      router.replace('/(tabs)')
    }
  }

  const handleError = (err: Error): void => {
    useToastStore.getState().show(err.message || '연결에 실패했어요. 잠시 후 다시 시도해주세요.')
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.DARK_200, paddingHorizontal: spacing.XL }}>
      <View sx={{ flex: 6, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={icons.LOGO_SPLASH} sx={{ width: logoWidth, height: logoWidth / 3 }} resizeMode="contain" />
      </View>
      <View sx={{ flex: 4, gap: spacing.SM, justifyContent: Platform.OS === 'ios' ? 'center' : 'flex-end' }}>
        <SocialButton
          provider="kakao"
          disabled={kakaoLogin.isPending}
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
            disabled={appleLogin.isPending}
            onPress={() => {
              appleLogin.mutate(undefined, {
                onSuccess: (data) => handleLoginSuccess(data.needsOnboarding),
                onError: handleError,
              })
            }}
          />
        )}
        {/* 개발 빌드 전용 테스트 계정 로그인 — 릴리스 빌드에서는 렌더되지 않는다 */}
        {__DEV__ && (
          <View sx={{ flexDirection: 'row', gap: spacing.XS }}>
            {DEV_TEST_SLOTS.map((slot) => (
              <View key={slot} sx={{ flex: 1 }}>
                <Button
                  label={`테스트${slot}`}
                  color="dark"
                  height={36}
                  disabled={devLogin.isPending}
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
    </SafeAreaView>
  )
}
