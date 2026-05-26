import { useState } from 'react';
import { Text, View } from 'dripsy';
import { colors, textSizes } from '@/shared/config';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';

type Props = {
  selectedUserId: string | null;
  selectedNickname: string;
  lastChatText: string;
  onApprove: (userId: string) => void;
};

export function AnswerApprovalButton({ selectedUserId, selectedNickname, lastChatText, onApprove }: Props) {
  const [dialogVisible, setDialogVisible] = useState(false);

  const isActive = selectedUserId !== null;

  const handlePress = (): void => {
    if (!isActive) return;
    setDialogVisible(true);
  };

  const handleApprove = (): void => {
    if (selectedUserId == null) return;
    onApprove(selectedUserId);
    setDialogVisible(false);
  };

  return (
    <>
      <View style={{ opacity: isActive ? 1 : 0.3 }}>
        <Button
          label="정답 인정"
          color="secondary"
          height={40}
          onPress={handlePress}
          disabled={!isActive}
        />
      </View>

      <Dialog
        visible={dialogVisible}
        onClose={() => setDialogVisible(false)}
        title="정답 인정"
        buttons={[
          {
            label: '인정하기',
            color: 'primary',
            onPress: handleApprove,
          },
        ]}
      >
        <Text sx={{ ...textSizes.B1, color: colors.LIGHT_100 }}>
          {selectedNickname + '님 정답 \'' + lastChatText + '\' 을 인정하시겠습니까?'}
        </Text>
      </Dialog>
    </>
  );
}
