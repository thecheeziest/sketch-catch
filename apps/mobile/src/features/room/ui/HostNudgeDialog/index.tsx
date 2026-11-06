import { Text } from 'dripsy';
import { colors, textSizes } from '@/shared/config';
import { Dialog } from '@/shared/ui/Dialog';

type Props = {
  visible: boolean;
  onClose: () => void;
  onEnter: () => void;
  onExit: () => void;
};

// 시상식에 남은 방장에게 대기실 인원이 재촉했을 때 — 입장하기(= 한번 더) 또는 나가기를 고른다
export function HostNudgeDialog({ visible, onClose, onEnter, onExit }: Props) {
  const handleEnter = (): void => {
    onEnter();
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="방장을 기다리고 있어요!"
      buttons={[
        { label: '나가기', color: 'light', onPress: onExit },
        { label: '입장하기', color: 'primary', onPress: handleEnter },
      ]}
    >
      <Text sx={{ ...textSizes.B2, color: colors.LIGHT_100, textAlign: 'center' }}>
        친구들이 대기실에서 기다리고 있어요
      </Text>
    </Dialog>
  );
}
