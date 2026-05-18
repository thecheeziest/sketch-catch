import { useState } from 'react'
import { Dimensions, Image, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { PixelButton } from '@/shared/ui/PixelButton'
import { ProfileHeader } from '@/shared/ui/ProfileHeader'
import { CodeJoinModal } from '@/features/room/ui/CodeJoinModal'
import { useRoomStore } from '@/shared/model/room'
import { colors, spacing } from '@/shared/config/theme'
import { icons } from '@/shared/config/assets'

const LOGO_WIDTH = Dimensions.get('window').width * 0.6

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter()
  const isMatchmaking = useRoomStore((s) => s.isMatchmaking)
  const [codeModalVisible, setCodeModalVisible] = useState(false)

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ProfileHeader />
      <View style={styles.content}>
        <Image source={icons.LOGO} style={styles.logo} resizeMode="contain" />
        <View style={styles.buttons}>
          <View style={[isMatchmaking && styles.dimmed]}>
            <PixelButton
              label="방 만들기"
              variant="primary"
              disabled={isMatchmaking}
              onPress={() => router.push('/room/create')}
            />
          </View>
          <PixelButton
            label="랜덤 매칭"
            variant="secondary"
            onPress={() => router.push('/room/match')}
          />
          <View style={[isMatchmaking && styles.dimmed]}>
            <PixelButton
              label="코드로 입장"
              variant="outline"
              disabled={isMatchmaking}
              onPress={() => setCodeModalVisible(true)}
            />
          </View>
        </View>
      </View>
      <CodeJoinModal visible={codeModalVisible} onClose={() => setCodeModalVisible(false)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_WIDTH,
  },
  buttons: {
    width: '100%',
    gap: spacing.md,
  },
  dimmed: {
    opacity: 0.3,
  },
})
