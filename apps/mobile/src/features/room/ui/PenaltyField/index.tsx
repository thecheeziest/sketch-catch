import { Text, View } from 'dripsy';
import { Switch } from 'react-native';
import { PENALTY_PRESET, PENALTY_TEXT_MAX_LENGTH } from '@sketch-catch/shared';
import { AppInput } from '@/shared/ui';
import { CategoryChip } from '@/features/room/ui/CategoryChip';
import type { PenaltyForm } from '@/features/room/lib/usePenaltyForm';
import { playFeedback } from '@/shared/lib/feedback';
import { colors, spacing, textSizes } from '@/shared/config';

type Props = {
  form: PenaltyForm;
  // 모드 2는 점수가 없어 꼴찌를 가릴 수 없다
  unavailable: boolean;
  labelColor?: string;
};

export function PenaltyField({ form, unavailable, labelColor = colors.LIGHT_500 }: Props) {
  const isOn = form.enabled && !unavailable;

  return (
    <View sx={{ gap: spacing.SM }}>
      <View sx={{ flexDirection: 'row', alignItems: 'center', gap: spacing.SM }}>
        <Text sx={{ flex: 1, color: unavailable ? colors.GRAY : labelColor }}>벌칙</Text>
        <Switch
          value={isOn}
          disabled={unavailable}
          onValueChange={value => {
            playFeedback('select');
            form.toggle(value);
          }}
          trackColor={{ false: colors.DARK_100, true: colors.PRIMARY_400 }}
        />
      </View>
      {unavailable && (
        <Text sx={{ ...textSizes.B3, color: colors.GRAY }}>벌칙은 '맞혀 볼래?' 모드에서만 걸 수 있어요</Text>
      )}
      {isOn && (
        <>
          <Text sx={{ ...textSizes.B3, color: colors.GRAY }}>
            턴 {PENALTY_PRESET.roundCount}번 · 타이머 {PENALTY_PRESET.drawTimer}초 단판으로 맞춰 뒀어요
          </Text>
          <View sx={{ flexDirection: 'row', alignItems: 'center', gap: spacing.SM }}>
            <Text sx={{ flex: 1, color: labelColor }}>꼴찌</Text>
            <CategoryChip label="1명" active={form.loserCount === 1} onPress={() => form.setLoserCount(1)} />
            {form.canPickTwo && (
              <CategoryChip label="2명" active={form.loserCount === 2} onPress={() => form.setLoserCount(2)} />
            )}
          </View>
          <AppInput
            label="무엇을 걸까요?"
            placeholder="예) 아이스크림 쏘기"
            value={form.text}
            onChangeText={form.setText}
            maxLength={PENALTY_TEXT_MAX_LENGTH}
            showCounter
          />
        </>
      )}
    </View>
  );
}
