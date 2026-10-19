import { useState } from 'react'
import { Text, View } from 'dripsy'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppInput, Button } from '@/shared/ui'
import { useOnboardingStore, generateRandomFriendCode } from '@/features/auth/model'
import { nicknameSchema, friendCodeInputSchema } from '@sketch-catch/shared'
import { colors, spacing } from '@/shared/config'
import { useNavGuard } from '@/shared/lib'

export default function OnboardingStep1() {
  const router = useRouter()
  const guardNav = useNavGuard()

  const [nickname, setNickname] = useState('')
  const [friendCode, setFriendCode] = useState('')
  const [placeholderCode] = useState(() => generateRandomFriendCode())
  const [nicknameError, setNicknameError] = useState('')
  const [friendCodeError, setFriendCodeError] = useState('')

  // 미입력 시 placeholder 코드가 그대로 친구코드가 된다
  const effectiveFriendCode = friendCode || placeholderCode

  const handleNicknameBlur = (): void => {
    const result = nicknameSchema.safeParse(nickname)
    if (!result.success) {
      setNicknameError(result.error.issues[0]?.message ?? '닉네임을 확인해주세요.')
    } else {
      setNicknameError('')
    }
  }

  const handleFriendCodeBlur = (): void => {
    const result = friendCodeInputSchema.safeParse(effectiveFriendCode)
    if (!result.success) {
      setFriendCodeError('해시태그는 3~5자리 영문/숫자만 입력할 수 있어요.')
    } else {
      setFriendCodeError('')
    }
  }

  const handleNext = (): void => {
    const nicknameResult = nicknameSchema.safeParse(nickname)
    const friendCodeResult = friendCodeInputSchema.safeParse(effectiveFriendCode)

    const newNicknameError = nicknameResult.success
      ? ''
      : (nicknameResult.error.issues[0]?.message ?? '닉네임을 확인해주세요.')
    const newFriendCodeError = friendCodeResult.success
      ? ''
      : '해시태그는 3~5자리 영문/숫자만 입력할 수 있어요.'

    setNicknameError(newNicknameError)
    setFriendCodeError(newFriendCodeError)

    if (!nicknameResult.success || !friendCodeResult.success) return

    useOnboardingStore.getState().setStep1(nickname, effectiveFriendCode.toUpperCase())
    guardNav(() => router.push('/(auth)/onboarding/step2'))
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.DARK_200, paddingHorizontal: spacing.XL }}>
      <Text variant="B4" sx={{ color: colors.GRAY, textAlign: 'right', marginTop: spacing.MD }}>1 / 2</Text>
      <Text variant="T2" sx={{ color: colors.LIGHT_100, marginTop: spacing.XXL, marginBottom: spacing.LG }}>캐릭터 이름을 정해주세요</Text>
      <View sx={{ gap: spacing.MD }}>
        <AppInput
          label="닉네임"
          hint="2~10자, 띄어쓰기 포함 가능"
          error={nicknameError}
          value={nickname}
          onChangeText={(text) => {
            setNickname(text)
            if (nicknameError) setNicknameError('')
          }}
          maxLength={10}
          showCounter
          autoFocus
          onBlur={handleNicknameBlur}
        />
        <AppInput
          label="해시태그"
          hint="3~5자리 영문/숫자 (영문 대소문자 구분 없음)"
          error={friendCodeError}
          value={friendCode}
          placeholder={placeholderCode}
          onChangeText={(text) => {
            setFriendCode(text)
            if (friendCodeError) setFriendCodeError('')
          }}
          maxLength={5}
          autoCapitalize="characters"
          onBlur={handleFriendCodeBlur}
        />
      </View>
      <Button label="다음" color="primary" onPress={handleNext} style={{ marginTop: 32 }} />
    </SafeAreaView>
  )
}
