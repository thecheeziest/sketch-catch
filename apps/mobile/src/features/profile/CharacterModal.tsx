import React, { useState } from 'react';
import { View } from 'react-native';
import { PixelModal } from '@/components/PixelModal';
import { PixelButton } from '@/components/PixelButton';
import { CharacterGrid } from '@/components/CharacterGrid';
import { useUpdateMe } from '@/features/auth/useUpdateMe';

type Props = {
  visible: boolean;
  onClose: () => void;
  currentCharacterId: string;
};

export function CharacterModal({ visible, onClose, currentCharacterId }: Props): React.JSX.Element {
  const [selectedId, setSelectedId] = useState(currentCharacterId);
  const updateMe = useUpdateMe();

  const handleClose = (): void => {
    setSelectedId(currentCharacterId);
    onClose();
  };

  const handleSave = (): void => {
    updateMe.mutate(
      { characterId: selectedId },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <PixelModal visible={visible} onClose={handleClose} title="캐릭터 변경">
      {/* UI-SPEC: 하단 sheet 전체 높이 60% — PixelModal이 flex-end justify이므로 children에서 maxHeight 제어 */}
      <View style={{ maxHeight: '60%' }}>
        <CharacterGrid selectedId={selectedId} onSelect={setSelectedId} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <PixelButton
            label="닫기"
            variant="secondary"
            onPress={handleClose}
            disabled={updateMe.isPending}
          />
        </View>
        <View style={{ flex: 1 }}>
          <PixelButton
            label="캐릭터 저장"
            variant="primary"
            onPress={handleSave}
            disabled={updateMe.isPending}
            style={updateMe.isPending ? { opacity: 0.6 } : undefined}
          />
        </View>
      </View>
    </PixelModal>
  );
}
