import { useState, useEffect } from 'react';
import { PROMPT_DURATION_SEC } from '@sketch-catch/shared';
import { Text, View } from 'dripsy';
import { colors, spacing, textSizes } from '@/shared/config';
import { Dialog } from '@/shared/ui/Dialog';
import { AppInput } from '@/shared/ui/Input';

const COUNTDOWN_SEC = PROMPT_DURATION_SEC;

type Props = {
  visible: boolean;
  endsAt?: number | null;
  onSubmit: (text: string) => boolean;
};

export function CustomPromptModal({ visible, endsAt, onSubmit }: Props) {
  const [text, setText] = useState('');
  const [remaining, setRemaining] = useState(COUNTDOWN_SEC);
  useEffect(() => {
    if (!visible) {
      setText('');
      setRemaining(COUNTDOWN_SEC);
      return;
    }
    const deadline = endsAt ?? Date.now() + COUNTDOWN_SEC * 1000;
    const tick = (): void => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [visible, endsAt]);

  const handleConfirm = (): void => {
    if (!text.trim() || remaining === 0) return;
    if (onSubmit(text.trim())) setText('');
  };

  const isExpired = remaining === 0;

  return (
    <Dialog
      visible={visible}
      onClose={() => {}}
      dismissible={false}
      title="제시어를 직접 입력해 주세요"
      buttons={
        isExpired
          ? []
          : [
              {
                label: '확인',
                color: 'primary',
                onPress: handleConfirm,
                disabled: !text.trim(),
              },
            ]
      }
    >
      <Text sx={{ ...textSizes.B2, color: isExpired ? colors.ERROR_400 : colors.LIGHT_300 }}>
        {isExpired
          ? '시간 초과! 다음 출제자로 넘어갑니다.'
          : `${remaining}초 안에 친구들이 맞힐 제시어를 입력해 주세요`}
      </Text>
      {!isExpired && (
        <View sx={{ marginTop: spacing.XS }}>
          <AppInput
            placeholder="예: 빨간 사과"
            value={text}
            onChangeText={setText}
            maxLength={20}
            showCounter
            color="SECONDARY"
          />
        </View>
      )}
    </Dialog>
  );
}
