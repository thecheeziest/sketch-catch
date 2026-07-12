import { useState } from 'react';
import { Text, View } from 'dripsy';
import { colors, spacing, textSizes } from '@/shared/config';
import { Button } from '@/shared/ui/Button';

type Props = {
  isOwner: boolean;
  onJudge: (ok: boolean) => void;
};

const JUDGE_BUTTON_HEIGHT = 56;

export function FinalJudgeButton({ isOwner, onJudge }: Props) {
  const [selected, setSelected] = useState<'ok' | 'ng' | null>(null);

  if (!isOwner) {
    return (
      <View sx={{ paddingVertical: spacing.LG, alignItems: 'center', justifyContent: 'center' }}>
        <Text sx={{ ...textSizes.B1, color: colors.GRAY, textAlign: 'center' }}>원작자가 판정 중이에요...</Text>
      </View>
    );
  }

  const handlePress = (ok: boolean): void => {
    if (selected !== null) return;
    setSelected(ok ? 'ok' : 'ng');
    onJudge(ok);
  };

  return (
    <View sx={{ flexDirection: 'row', gap: spacing.SM, paddingHorizontal: spacing.MD }}>
      <View sx={{ flex: 1 }}>
        <Button
          label="찰떡같이 통했어요 ⭕"
          color="secondary"
          height={JUDGE_BUTTON_HEIGHT}
          disabled={selected !== null}
          onPress={() => handlePress(true)}
        />
      </View>
      <View sx={{ flex: 1 }}>
        <Button
          label="완전히 다른 얘기가 됐어요 ❌"
          color="dark"
          height={JUDGE_BUTTON_HEIGHT}
          disabled={selected !== null}
          onPress={() => handlePress(false)}
        />
      </View>
    </View>
  );
}
