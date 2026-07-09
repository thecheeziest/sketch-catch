import { ScrollView, Text, View } from 'dripsy'
import { useEffect, useState } from 'react'
import { Switch } from 'react-native'
import type { Category } from '@sketch-catch/shared'
import { useRoomStore, useToastStore } from '@/shared/model'
import { Dialog, Button, AppInput, Icon } from '@/shared/ui'
import { StepperField } from '@/features/room/ui/StepperField'
import { CategorySelector, ALL_CATEGORIES } from '@/features/room/ui/CategorySelector'
import { useUpdateRoom } from '@/features/room/api'
import { colors, spacing } from '@/shared/config'

type Props = {
  visible: boolean
  onClose: () => void
  roomCode: string
}

export function RoomEditModal({ visible, onClose, roomCode }: Props) {
  const roomState = useRoomStore((s) => s.roomState)
  const { mutate, isPending } = useUpdateRoom(roomCode)

  const [title, setTitle] = useState('')
  const [playerCountMax, setPlayerCountMax] = useState(6)
  const [roundCount, setRoundCount] = useState(5)
  const [drawTimer, setDrawTimer] = useState(30)
  const [categories, setCategories] = useState<Category[]>(['CUSTOM', ...ALL_CATEGORIES])
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (visible && roomState) {
      setTitle(roomState.title ?? '')
      setPlayerCountMax(roomState.config.playerCountMax)
      setRoundCount(roomState.config.roundCount)
      setDrawTimer(roomState.config.drawTimer)
      setCategories((roomState.config.categories as Category[]) ?? [...ALL_CATEGORIES])
      setLocked(roomState.locked ?? false)
    }
  }, [visible, roomState])

  const handleSave = (): void => {
    mutate(
      { title: title.trim() || undefined, locked, playerCountMax, roundCount, drawTimer, categories },
      {
        onSuccess: () => { onClose() },
        onError: () => { useToastStore.getState().show('방 설정 변경에 실패했습니다.') },
      }
    )
  }

  return (
    <Dialog visible={visible} onClose={onClose} title="방 설정">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.MD, paddingBottom: spacing.MD }}>
        <AppInput label="방 제목" placeholder={roomState?.title ?? '방 제목'} value={title} onChangeText={setTitle} maxLength={20} showCounter />
        <StepperField label="인원" value={playerCountMax} min={3} max={12} onChange={setPlayerCountMax} />
        <StepperField label="턴" value={roundCount} min={1} max={10} onChange={setRoundCount} />
        <StepperField label="타이머" value={drawTimer} min={10} max={60} step={5} onChange={setDrawTimer} />
        <View sx={{ gap: spacing.SM }}>
          <Text sx={{ color: colors.DARK_100 }}>카테고리</Text>
          <CategorySelector value={categories} onChange={setCategories} />
        </View>
        <View sx={{ flexDirection: 'row', alignItems: 'center', gap: spacing.SM }}>
          <Text sx={{ flex: 1, color: colors.DARK_100 }}>잠금</Text>
          <Icon name={locked ? 'LOCK' : 'LOCK_OPEN'} size={20} />
          <Switch value={locked} onValueChange={setLocked} trackColor={{ false: colors.DARK_100, true: colors.PRIMARY_400 }} />
        </View>
        <Button label="저장" color="primary" disabled={isPending} onPress={handleSave} />
      </ScrollView>
    </Dialog>
  )
}
