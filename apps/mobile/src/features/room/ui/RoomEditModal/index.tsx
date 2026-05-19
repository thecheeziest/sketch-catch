import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import type { Category } from '@sketch-catch/shared'
import { useRoomStore } from '@/shared/model/room'
import { useToastStore } from '@/shared/model/toast'
import { PixelModal } from '@/shared/ui/PixelModal'
import { PixelButton } from '@/shared/ui/PixelButton'
import { PixelInput } from '@/shared/ui/PixelInput'
import { StepperField } from '@/features/room/ui/StepperField'
import { CategoryChip } from '@/features/room/ui/CategoryChip'
import { useUpdateRoom } from '@/features/room/api/useUpdateRoom'
import { colors, spacing, typography, fontFamily } from '@/shared/config/theme'
import { Ionicons } from '@expo/vector-icons'

const ALL_CATEGORIES: Category[] = ['ANIMAL', 'FOOD', 'OBJECT', 'NATURE', 'PLACE', 'ACTION', 'JOB']

const CATEGORY_LABEL: Record<Category, string> = {
  ANIMAL: '동물',
  FOOD: '음식',
  OBJECT: '사물',
  NATURE: '자연',
  PLACE: '장소',
  ACTION: '행동',
  JOB: '직업',
}

type Props = {
  visible: boolean
  onClose: () => void
  roomCode: string
}

export function RoomEditModal({ visible, onClose, roomCode }: Props): React.JSX.Element {
  const roomState = useRoomStore((s) => s.roomState)
  const { mutate, isPending } = useUpdateRoom(roomCode)

  const [title, setTitle] = useState('')
  const [playerCountMax, setPlayerCountMax] = useState(6)
  const [roundCount, setRoundCount] = useState(5)
  const [drawTimer, setDrawTimer] = useState(30)
  const [categories, setCategories] = useState<Category[]>([...ALL_CATEGORIES])
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

  const isAllSelected = categories.length === ALL_CATEGORIES.length

  const toggleAll = (): void => {
    setCategories(isAllSelected ? ['ANIMAL'] : [...ALL_CATEGORIES])
  }

  const toggleCategory = (cat: Category): void => {
    if (categories.includes(cat)) {
      if (categories.length === 1) return
      setCategories(categories.filter((c) => c !== cat))
    } else {
      setCategories([...categories, cat])
    }
  }

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
    <PixelModal visible={visible} onClose={onClose} title="방 설정">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <PixelInput
          label="방 제목"
          placeholder={roomState?.title ?? '방 제목'}
          value={title}
          onChangeText={setTitle}
          maxLength={20}
          showCounter
        />

        <StepperField label="인원" value={playerCountMax} min={3} max={12} onChange={setPlayerCountMax} />
        <StepperField label="라운드" value={roundCount} min={3} max={10} onChange={setRoundCount} />
        <StepperField label="타이머" value={drawTimer} min={10} max={60} step={5} onChange={setDrawTimer} />

        <View style={styles.categorySection}>
          <Text style={styles.sectionLabel} allowFontScaling={false}>카테고리</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <CategoryChip label="전체" active={isAllSelected} onPress={toggleAll} />
            {ALL_CATEGORIES.map((cat) => (
              <CategoryChip
                key={cat}
                label={CATEGORY_LABEL[cat]}
                active={categories.includes(cat)}
                onPress={() => toggleCategory(cat)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.lockRow}>
          <Text style={styles.lockLabel} allowFontScaling={false}>잠금</Text>
          <Ionicons name={locked ? 'lock-closed' : 'lock-open'} size={20} color={colors.textPrimary} />
          <Switch
            value={locked}
            onValueChange={setLocked}
            trackColor={{ false: colors.border, true: colors.accentPrimary }}
          />
        </View>

        <PixelButton label="저장" variant="primary" disabled={isPending} onPress={handleSave} />
      </ScrollView>
    </PixelModal>
  )
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  categorySection: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.textPrimary,
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lockLabel: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.textPrimary,
  },
})
