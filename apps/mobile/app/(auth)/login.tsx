import { View, Image } from 'dripsy'
import { Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SocialButton } from '@/shared/ui'
import { useKakaoLogin, useAppleLogin } from '@/features/auth/lib'
import { useToastStore } from '@/shared/model'
import { colors, spacing } from '@/shared/config'
import LOGO from '@assets/sketchcatch-logo.png'

export default function LoginScreen() {
  const router = useRouter()

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
        <Image source={LOGO} sx={{ width: '70%', height: 120 }} resizeMode="contain" />
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
