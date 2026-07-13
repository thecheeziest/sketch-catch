import { useState, useEffect, useRef } from 'react';
import { Text, View } from 'dripsy';
import { colors, spacing, textSizes } from '@/shared/config';
import { Dialog } from '@/shared/ui/Dialog';
import { AppInput } from '@/shared/ui/Input';

const COUNTDOWN_SEC = 10;

type Props = {
  visible: boolean;
  onSubmit: (text: string) => void;
};

export function CustomPromptModal({ visible, onSubmit }: Props) {
  const [text, setText] = useState('');
  const [remaining, setRemaining] = useState(COUNTDOWN_SEC);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      setText('');
      setRemaining(COUNTDOWN_SEC);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    setRemaining(COUNTDOWN_SEC);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible]);

  const handleConfirm = (): void => {
    if (!text.trim()) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    onSubmit(text.trim());
    setText('');
  };

  const isExpired = remaining === 0;

  return (
    <Dialog
      visible={visible}
      onClose={() => {}}
      title="출제 문제"
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
        {isExpired ? '시간 초과! 다음 출제자로 넘어갑니다.' : `${remaining}초 안에 출제 문제를 입력해 주세요!`}
      </Text>
      {!isExpired && (
        <View sx={{ marginTop: spacing.XS }}>
          <AppInput
            placeholder="제시어를 입력하세요"
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
