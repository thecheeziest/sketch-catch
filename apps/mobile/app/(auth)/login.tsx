import { View, Image } from 'dripsy'
import { Platform, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SocialButton } from '@/shared/ui'
import { useKakaoLogin, useAppleLogin } from '@/features/auth/lib'
import { useToastStore } from '@/shared/model'
import { colors, icons, spacing } from '@/shared/config'

export default function LoginScreen() {
  const router = useRouter()
  const { width: screenWidth } = useWindowDimensions()
  const logoWidth = (screenWidth - spacing.XL * 2) * 0.55

  const kakaoLogin = useKakaoLogin()
  const appleLogin = useAppleLogin()

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
      <View sx={{ flex: 4, gap: spacing.SM, justifyContent: 'center' }}>
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
      </View>
    </SafeAreaView>
  )
}
