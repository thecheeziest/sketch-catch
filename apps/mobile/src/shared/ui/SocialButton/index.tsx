import { Text, View } from 'dripsy'
import { Pressable, StyleSheet } from 'react-native'
import { spacing } from '@/shared/config'

type Provider = 'kakao' | 'apple'
type Props = {
  provider: Provider
  onPress: () => void
  disabled?: boolean
}

const BG: Record<Provider, string> = { kakao: '#FEE500', apple: '#000000' }
const FG: Record<Provider, string> = { kakao: '#191919', apple: '#FFFFFF' }
const LABEL: Record<Provider, string> = {
  kakao: '카카오로 시작하기',
  apple: 'Apple로 시작하기',
}

export function SocialButton({ provider, onPress, disabled }: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: BG[provider] },
        disabled && { opacity: 0.6 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View sx={{ width: 20, height: 20, marginRight: spacing.SM, opacity: 0.85, backgroundColor: FG[provider] }} />
      <Text sx={{ color: FG[provider] }}>
        {LABEL[provider]}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    borderWidth: 2,
    borderColor: '#2C2C1E',
    paddingHorizontal: spacing.LG,
    flexDirection: 'row',
    alignItems: 'center',
  },
})
