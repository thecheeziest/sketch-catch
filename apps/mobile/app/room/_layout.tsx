import { useEffect } from 'react'
import { Stack, useNavigation, useSegments } from 'expo-router'

export default function RoomLayout() {
  const navigation = useNavigation()
  const segments = useSegments()
  // 방 만들기 화면만 스와이프 뒤로가기 허용. 대기실·게임·시상식(room/[code])은 나가기 확인을 거쳐야 하므로 막는다.
  // 루트 스택의 'room' 라우트 옵션이라 여기서 현재 하위 화면에 맞춰 바꾼다 (기본값은 루트 _layout에서 false).
  const isCreateScreen = segments[segments.length - 1] === 'create'

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: isCreateScreen })
  }, [navigation, isCreateScreen])

  return <Stack screenOptions={{ headerShown: false }} />
}
