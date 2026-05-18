import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { PixelButton } from '@/shared/ui/PixelButton'
import { PixelInput } from '@/shared/ui/PixelInput'
import { StepperField } from '@/features/room/ui/StepperField'
import { CategoryChip } from '@/features/room/ui/CategoryChip'
import { useCreateRoom } from '@/features/room/api/useCreateRoom'
import { useToastStore } from '@/shared/model/toast'
import { colors, spacing, typography, fontFamily } from '@/shared/config/theme'
import type { Category } from '@sketch-catch/shared'

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

export default function RoomCreateScreen(): React.JSX.Element {
  const router = useRouter()
  const showToast = useToastStore((s) => s.show)
  const { mutate, isPending } = useCreateRoom()

  // D-04 기본값
  const [title, setTitle] = useState('')
  const [playerCountMax, setPlayerCountMax] = useState(6)
  const [roundCount, setRoundCount] = useState(5)
  const [drawTimer, setDrawTimer] = useState(30)
  const [categories, setCategories] = useState<Category[]>([...ALL_CATEGORIES])
  const [locked, setLocked] = useState(false)

  const isAllSelected = categories.length === ALL_CATEGORIES.length

  const toggleAll = (): void => {
    if (isAllSelected) {
      // 최소 1개 보장: 전체 선택 해제 시 첫 번째 항목만 남김
      setCategories(['ANIMAL'])
    } else {
      setCategories([...ALL_CATEGORIES])
    }
  }

  const toggleCategory = (cat: Category): void => {
    if (categories.includes(cat)) {
      // 마지막 1개는 해제 방지
      if (categories.length === 1) return
      setCategories(categories.filter((c) => c !== cat))
    } else {
      setCategories([...categories, cat])
    }
  }

  const handleCreate = (): void => {
    mutate(
      {
        mode: 1,
        playerCountMax,
        roundCount,
        drawTimer,
        categories,
        title: title.trim() || undefined,
        locked,
      },
      {
        onError: () => {
          showToast('방 만들기에 실패했습니다. 다시 시도해주세요.')
        },
      }
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} allowFontScaling={false}>방 만들기</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 방 제목 */}
        <PixelInput
          label="방 제목"
          placeholder="닉네임의 방"
          value={title}
          onChangeText={setTitle}
          maxLength={20}
          showCounter
        />

        {/* 인원 */}
        <StepperField
          label="인원"
          value={playerCountMax}
          min={3}
          max={12}
          onChange={setPlayerCountMax}
        />

        {/* 모드 (고정) */}
        <View style={styles.modeRow}>
          <Text style={styles.modeLabel} allowFontScaling={false}>모드</Text>
          <Text style={styles.modeValue} allowFontScaling={false}>모드 1 — 클래식</Text>
        </View>

        {/* 라운드 */}
        <StepperField
          label="라운드"
          value={roundCount}
          min={3}
          max={10}
          onChange={setRoundCount}
        />

        {/* 타이머 */}
        <StepperField
          label="타이머"
          value={drawTimer}
          min={10}
          max={60}
          step={5}
          onChange={setDrawTimer}
        />

        {/* 카테고리 */}
        <View style={styles.categorySection}>
          <Text style={styles.sectionLabel} allowFontScaling={false}>카테고리</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
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

        {/* 잠금 */}
        <View style={styles.lockRow}>
          <Text style={styles.lockLabel} allowFontScaling={false}>잠금</Text>
          <Ionicons
            name={locked ? 'lock-closed' : 'lock-open'}
            size={20}
            color={colors.textPrimary}
          />
          <Switch
            value={locked}
            onValueChange={setLocked}
            trackColor={{ false: colors.border, true: colors.accentPrimary }}
          />
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <PixelButton
            label="방 만들기"
            variant="primary"
            disabled={isPending}
            onPress={handleCreate}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamily.regular,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 32,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeLabel: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.textPrimary,
  },
  modeValue: {
    fontFamily: fontFamily.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
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
  cta: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
})
