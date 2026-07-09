import { Text } from 'dripsy'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CharacterGrid, Button } from '@/shared/ui'
import { useOnboard } from '@/features/auth/api'
import { useOnboardingStore } from '@/features/auth/model'
import { useToastStore, useAuthStore } from '@/shared/model'
import { ApiError } from '@/shared/api'
import { colors, spacing } from '@/shared/config'

export default function OnboardingStep2() {
  const router = useRouter()
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const onboard = useOnboard()

  const handleStart = (): void => {
    if (!selectedCharacterId) return

    const { nickname, friendCode } = useOnboardingStore.getState()

    onboard.mutate(
      { nickname, friendCode, characterId: selectedCharacterId },
      {
        onSuccess: () => {
          useOnboardingStore.getState().reset()
          useAuthStore.getState().setNeedsOnboarding(false)
          router.replace('/(tabs)')
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'NICKNAME_CODE_CONFLICT') {
            useToastStore
              .getState()
              .show('이미 사용 중인 닉네임+코드 조합이에요. 코드를 바꿔보세요.')
            router.back()
          } else {
            useToastStore.getState().show('연결에 실패했어요. 잠시 후 다시 시도해주세요.')
          }
        },
      }
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.DARK_200, paddingHorizontal: spacing.XL }}>
      <Text variant="B4" sx={{ color: colors.GRAY, textAlign: 'right', marginTop: spacing.MD }}>2 / 2</Text>
      <Text variant="T2" sx={{ color: colors.LIGHT_100, marginTop: spacing.XXL, marginBottom: spacing.LG }}>캐릭터를 선택해주세요</Text>
      <CharacterGrid selectedId={selectedCharacterId} onSelect={setSelectedCharacterId} />
      <Button
        label="시작하기"
        color="primary"
        disabled={!selectedCharacterId || onboard.isPending}
        onPress={handleStart}
        style={{ marginTop: 32 }}
      />
    </SafeAreaView>
  )
}
