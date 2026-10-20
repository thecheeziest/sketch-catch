import { Text, View } from 'dripsy';
import { Switch } from 'react-native';
import { PENALTY_TEXT_MAX_LENGTH } from '@sketch-catch/shared';
import { AppInput } from '@/shared/ui';
import { StepperField } from '@/features/room/ui/StepperField';
import type { PenaltyForm } from '@/features/room/lib/usePenaltyForm';
import { playFeedback } from '@/shared/lib/feedback';
import { colors, spacing } from '@/shared/config';

type Props = {
  form: PenaltyForm;
  labelColor?: string;
};

export function PenaltyField({ form, labelColor = colors.LIGHT_500 }: Props) {
  return (
    <View sx={{ gap: spacing.SM }}>
      <View sx={{ flexDirection: 'row', alignItems: 'center', gap: spacing.SM }}>
        <Text sx={{ flex: 1, color: labelColor }}>벌칙</Text>
        <Switch
          value={form.enabled}
          onValueChange={value => {
            playFeedback('select');
            form.toggle(value);
          }}
          trackColor={{ false: colors.DARK_100, true: colors.PRIMARY_400 }}
        />
      </View>
      {form.enabled && (
        <>
          <StepperField
            label="벌칙 인원"
            value={form.loserCount}
            min={1}
            max={form.maxLoserCount}
            onChange={form.setLoserCount}
          />
          <AppInput
            label="벌칙은?"
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
