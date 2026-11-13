import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { playFeedback } from '@/shared/lib/feedback';
import { useState } from 'react'
import { Text, View } from 'dripsy'
import { Switch, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Button, AppInput, Icon } from '@/shared/ui'
import { StepperField, CategorySelector, CategoryChip, PenaltyField, ALL_CATEGORIES } from '@/features/room/ui'
import { getRoomSaveErrorMessage, usePenaltyForm } from '@/features/room/lib'
import { useCreateRoom } from '@/features/room/api'
import { useToastStore, useAuthStore } from '@/shared/model'
import { colors, spacing } from '@/shared/config'
import { GAME_MODE_LABEL } from '@/shared/config/room'
import { MODE2_PLAYER_MIN, ROOM_PLAYER_MIN, type Category } from '@sketch-catch/shared'

export default function RoomCreateScreen() {
  const router = useRouter()
  const showToast = useToastStore((s) => s.show)
  const { mutate, isPending } = useCreateRoom()
  const nickname = useAuthStore.getState().user?.nickname
  const reviewAccess = useAuthStore(s => s.user?.reviewAccess === true)

  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<1 | 2>(1)
  const [playerCountMax, setPlayerCountMax] = useState(6)
  const [roundCount, setRoundCount] = useState(3)
  const [drawTimer, setDrawTimer] = useState(60)
  const [categories, setCategories] = useState<Category[]>([...ALL_CATEGORIES])
  const [locked, setLocked] = useState(false)
  const [password, setPassword] = useState('')
  const playerMin = mode === 2 ? MODE2_PLAYER_MIN : ROOM_PLAYER_MIN
  const penaltyForm = usePenaltyForm({ playerCountMax, roundCount, drawTimer, setRoundCount, setDrawTimer })

  const handleCreate = (review = false): void => {
    let input: Parameters<typeof mutate>[0] = {
      mode,
      playerCountMax,
      roundCount,
      drawTimer,
      categories,
      title: title.trim() || undefined,
      locked,
      password: locked ? password.trim() : undefined,
      penalty: penaltyForm.penalty ?? undefined,
    }
    if (review) {
      input = { mode, review: true, playerCountMax: 3, roundCount: 1, drawTimer: 40, categories: ['ANIMAL'] }
    }
    mutate(
      input,
      {
        onError: (err) => {
          console.error('[createRoom]', err)
          showToast(getRoomSaveErrorMessage(err, '방 만들기에 실패했습니다. 다시 시도해주세요.'), 'error')
        },
      }
    )
  }

  const handleSelectMode = (nextMode: 1 | 2): void => {
    setMode(nextMode)
    if (nextMode === 2) {
      setPlayerCountMax((current) => Math.max(current, MODE2_PLAYER_MIN))
      // 모드 2는 벌칙을 걸 수 없다 — 켜져 있었다면 끄면서 턴·타이머도 되돌린다
      if (penaltyForm.enabled) penaltyForm.toggle(false)
      // 모드 2는 카테고리 칸이 숨겨지므로 비어 있으면 전체로 되돌려 보이지 않는 이유로 버튼이 막히지 않게 한다
      setCategories((current) => (current.length === 0 ? [...ALL_CATEGORIES] : current))
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.DARK_200 }} edges={['top', 'bottom']}>
      <View sx={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.MD, paddingVertical: spacing.SM }}>
        <FeedbackPressable feedback="cancel" onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Icon name="BACK" size={24} />
        </FeedbackPressable>
        <Text variant="T2" sx={{ flex: 1, textAlign: 'center', color: colors.LIGHT_100 }}>방 만들기</Text>
        <View sx={{ width: 32 }} />
      </View>

      <KeyboardAwareScrollView style={{ flex: 1 }} bottomOffset={spacing.LG} contentContainerStyle={{ paddingHorizontal: spacing.MD, paddingTop: spacing.MD, paddingBottom: spacing.LG, gap: spacing.LG }} keyboardShouldPersistTaps="handled">
        <AppInput label="방 제목" placeholder={nickname ? `${nickname}님의 방` : '방 제목을 입력하세요'} value={title} onChangeText={setTitle} maxLength={20} showCounter />
        <View sx={{ gap: spacing.SM }}>
          <Text sx={{ color: colors.LIGHT_500 }}>모드</Text>
          <View sx={{ flexDirection: 'row', gap: spacing.SM }}>
            <CategoryChip label={GAME_MODE_LABEL[1]} active={mode === 1} onPress={() => handleSelectMode(1)} />
            <CategoryChip label={GAME_MODE_LABEL[2]} active={mode === 2} onPress={() => handleSelectMode(2)} />
          </View>
        </View>
        {mode === 1 && (
          <View sx={{ gap: spacing.SM }}>
            <Text sx={{ color: colors.LIGHT_500 }}>카테고리</Text>
            <CategorySelector value={categories} onChange={setCategories} />
          </View>
        )}
        {reviewAccess && (
          <View sx={{ gap: spacing.SM }}>
            <Text sx={{ color: colors.LIGHT_100 }}>심사 체험 · 봇 2명이 준비된 그림과 답변으로 참여해요. 코인 보상은 없어요.</Text>
            <Button label="봇 2명과 체험하기" color="secondary" loading={isPending} onPress={() => handleCreate(true)} />
          </View>
        )}
        <StepperField label="인원" value={playerCountMax} min={playerMin} max={12} onChange={setPlayerCountMax} />
        {mode === 1 && <StepperField label="턴" value={roundCount} min={1} max={5} onChange={setRoundCount} />}
        <StepperField label="타이머" value={drawTimer} min={40} max={90} step={5} onChange={setDrawTimer} />
        {mode === 1 && <PenaltyField form={penaltyForm} />}
        <View sx={{ flexDirection: 'row', alignItems: 'center', gap: spacing.SM }}>
          <Text sx={{ flex: 1, color: colors.LIGHT_500 }}>잠금</Text>
          <Icon name={locked ? 'LOCK' : 'LOCK_OPEN'} size={20} />
          <Switch value={locked} onValueChange={(v) => { playFeedback('select'); setLocked(v); if (!v) setPassword('') }} trackColor={{ false: colors.DARK_100, true: colors.PRIMARY_400 }} />
        </View>
        {locked && (
          <AppInput
            label="비밀번호"
            placeholder="친구에게 알려줄 비밀번호"
            value={password}
            onChangeText={setPassword}
            maxLength={20}
            secureTextEntry
          />
        )}
        <View sx={{ marginTop: spacing.XL, marginBottom: spacing.LG }}>
          <Button
            label="방 만들기"
            color="primary"
            loading={isPending}
            disabled={!penaltyForm.isValid || (locked && !password.trim()) || categories.length === 0}
            onPress={() => handleCreate()}
          />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  backBtn: { padding: spacing.XS },
})
