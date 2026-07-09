import { useState } from 'react';
import { View } from 'dripsy';
import { useWindowDimensions } from 'react-native';
import { Dialog } from '@/shared/ui/Dialog';
import { CharacterGrid } from '@/shared/ui/CharacterGrid';
import { useUpdateMe } from '@/features/auth/api';

type Props = {
  visible: boolean;
  onClose: () => void;
  currentCharacterId: string;
};

export function CharacterModal({ visible, onClose, currentCharacterId }: Props) {
  const [selectedId, setSelectedId] = useState(currentCharacterId);
  const updateMe = useUpdateMe();
  const { height: screenHeight } = useWindowDimensions();

  const handleClose = (): void => {
    setSelectedId(currentCharacterId);
    onClose();
  };

  const handleSave = (): void => {
    updateMe.mutate(
      { characterId: selectedId },
      { onSuccess: () => { onClose(); } }
    );
  };

  return (
    <Dialog
      visible={visible}
      onClose={handleClose}
      title="캐릭터 변경"
      buttons={[
        { label: '닫기', color: 'light', onPress: handleClose, disabled: updateMe.isPending },
        { label: '캐릭터 저장', color: 'primary', onPress: handleSave, disabled: updateMe.isPending },
      ]}
    >
      <View sx={{ height: screenHeight * 0.42 }}>
        <CharacterGrid selectedId={selectedId} onSelect={setSelectedId} />
      </View>
    </Dialog>
  );
}
