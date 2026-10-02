import { useState } from 'react'
import { ScrollView, Text, View } from 'dripsy'
import { Pressable, Switch, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Button, AppInput, Icon } from '@/shared/ui'
import { StepperField, CategorySelector, CategoryChip, ALL_CATEGORIES } from '@/features/room/ui'
import { useCreateRoom } from '@/features/room/api'
import { useToastStore, useAuthStore } from '@/shared/model'
import { colors, spacing } from '@/shared/config'
import { MODE2_PLAYER_MIN, ROOM_PLAYER_MIN, type Category } from '@sketch-catch/shared'

export default function RoomCreateScreen() {
  const router = useRouter()
  const showToast = useToastStore((s) => s.show)
  const { mutate, isPending } = useCreateRoom()
  const nickname = useAuthStore.getState().user?.nickname

  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<1 | 2>(1)
  const [playerCountMax, setPlayerCountMax] = useState(6)
  const [roundCount, setRoundCount] = useState(3)
  const [drawTimer, setDrawTimer] = useState(30)
  const [categories, setCategories] = useState<Category[]>(['CUSTOM', ...ALL_CATEGORIES])
  const [locked, setLocked] = useState(false)
  const [password, setPassword] = useState('')
  const playerMin = mode === 2 ? MODE2_PLAYER_MIN : ROOM_PLAYER_MIN

  const handleCreate = (): void => {
    mutate(
      { mode, playerCountMax, roundCount, drawTimer, categories, title: title.trim() || undefined, locked, password: locked && password.trim() ? password.trim() : undefined },
      { onError: (err) => { console.error('[createRoom]', err); showToast('방 만들기에 실패했습니다. 다시 시도해주세요.') } }
    )
  }

  const handleSelectMode = (nextMode: 1 | 2): void => {
    setMode(nextMode)
    if (nextMode === 2) {
      setPlayerCountMax((current) => Math.max(current, MODE2_PLAYER_MIN))
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.DARK_200 }} edges={['top', 'bottom']}>
      <View sx={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.MD, paddingVertical: spacing.SM }}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Icon name="BACK" size={24} />
        </Pressable>
        <Text variant="T2" sx={{ flex: 1, textAlign: 'center', color: colors.LIGHT_100 }}>방 만들기</Text>
        <View sx={{ width: 32 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.MD, paddingTop: spacing.MD, paddingBottom: spacing.LG, gap: spacing.LG }} keyboardShouldPersistTaps="handled">
        <AppInput label="방 제목" placeholder={nickname ? `${nickname}님의 방` : '방 제목을 입력하세요'} value={title} onChangeText={setTitle} maxLength={20} showCounter />
        <View sx={{ gap: spacing.SM }}>
          <Text sx={{ color: colors.LIGHT_500 }}>모드</Text>
          <View sx={{ flexDirection: 'row', gap: spacing.SM }}>
            <CategoryChip label="맞혀 볼래?" active={mode === 1} onPress={() => handleSelectMode(1)} />
            <CategoryChip label="이어 그리자!" active={mode === 2} onPress={() => handleSelectMode(2)} />
          </View>
        </View>
        {mode === 1 && (
          <>
            <StepperField label="턴" value={roundCount} min={1} max={5} onChange={setRoundCount} />
            <View sx={{ gap: spacing.SM }}>
              <Text sx={{ color: colors.LIGHT_500 }}>카테고리</Text>
              <CategorySelector value={categories} onChange={setCategories} />
            </View>
          </>
        )}
        <StepperField label="인원" value={playerCountMax} min={playerMin} max={12} onChange={setPlayerCountMax} />
        <StepperField label="타이머" value={drawTimer} min={10} max={60} step={5} onChange={setDrawTimer} />
        <View sx={{ flexDirection: 'row', alignItems: 'center', gap: spacing.SM }}>
          <Text sx={{ flex: 1, color: colors.LIGHT_500 }}>잠금</Text>
          <Icon name={locked ? 'LOCK' : 'LOCK_OPEN'} size={20} />
          <Switch value={locked} onValueChange={(v) => { setLocked(v); if (!v) setPassword('') }} trackColor={{ false: colors.DARK_100, true: colors.PRIMARY_400 }} />
        </View>
        {locked && (
          <AppInput
            label="비밀번호 (선택)"
            placeholder="친구에게 알려줄 비밀번호"
            value={password}
            onChangeText={setPassword}
            maxLength={20}
            secureTextEntry
          />
        )}
        <View sx={{ marginTop: spacing.XL, marginBottom: spacing.LG }}>
          <Button label="방 만들기" color="primary" disabled={isPending} onPress={handleCreate} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  backBtn: { padding: spacing.XS },
})
