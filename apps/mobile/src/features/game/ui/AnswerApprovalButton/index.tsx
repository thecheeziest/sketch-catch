import { useState } from 'react';
import { Text, View, ScrollView } from 'dripsy';
import { Pressable, StyleSheet } from 'react-native';
import type { ChatMessage } from '@sketch-catch/shared';
import { colors, spacing, textSizes } from '@/shared/config';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { PixelFrame } from '@/shared/ui/PixelFrame';

const MAX_MESSAGES = 10;

type Props = {
  selectedUserId: string | null;
  selectedNickname: string;
  chatMessages: ChatMessage[];
  onApprove: (messageId: string) => void;
  onDeselect: () => void;
};

export function AnswerApprovalButton({ selectedUserId, selectedNickname, chatMessages, onApprove, onDeselect }: Props) {
  const [panelVisible, setPanelVisible] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const isActive = selectedUserId !== null;

  const playerMessages = selectedUserId != null
    ? [...chatMessages].filter((m) => m.userId === selectedUserId).slice(-MAX_MESSAGES).reverse()
    : [];

  const handleOpenPanel = (): void => {
    if (!isActive) return;
    setSelectedMessageId(null);
    setPanelVisible(true);
  };

  const handleApprove = (): void => {
    if (selectedMessageId == null) return;
    onApprove(selectedMessageId);
    setPanelVisible(false);
    setSelectedMessageId(null);
  };

  const handleClose = (): void => {
    setPanelVisible(false);
    setSelectedMessageId(null);
  };

  return (
    <>
      <View style={{ opacity: isActive ? 1 : 0.3 }}>
        <Button
          label="정답 인정"
          color="secondary"
          height={40}
          onPress={handleOpenPanel}
          disabled={!isActive}
        />
      </View>

      <Dialog
        visible={panelVisible}
        onClose={handleClose}
        title={`${selectedNickname}님의 채팅`}
        buttons={[
          {
            label: '취소',
            color: 'secondary',
            onPress: handleClose,
          },
          {
            label: '답안 인정',
            color: 'primary',
            onPress: handleApprove,
            disabled: selectedMessageId == null,
          },
        ]}
      >
        {playerMessages.length === 0 ? (
          <Text sx={{ ...textSizes.B2, color: colors.LIGHT_500 }}>아직 채팅이 없습니다.</Text>
        ) : (
          <ScrollView style={sxStyles.list} showsVerticalScrollIndicator={false}>
            <View sx={{ gap: spacing.XS }}>
              {playerMessages.map((msg) => {
                const isSelected = msg.id === selectedMessageId;
                return (
                  <Pressable key={msg.id} onPress={() => setSelectedMessageId(msg.id)}>
                    <View style={styles.bubbleWrapper}>
                      <PixelFrame
                        borderColor={isSelected ? colors.PRIMARY_400 : colors.DARK_200}
                        borderWidth={2}
                        style={StyleSheet.absoluteFillObject}
                      >
                        <View
                          style={[
                            StyleSheet.absoluteFillObject,
                            { backgroundColor: isSelected ? colors.PRIMARY_100 : colors.DARK_100 },
                          ]}
                        />
                      </PixelFrame>
                      <View sx={{ paddingHorizontal: spacing.SM, paddingVertical: spacing.XS }}>
                        <Text sx={{ ...textSizes.B2, color: isSelected ? colors.PRIMARY_400 : colors.LIGHT_100 }}>
                          {msg.text}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </Dialog>
    </>
  );
}

const sxStyles = {
  list: { maxHeight: 220 },
};

const styles = StyleSheet.create({
  bubbleWrapper: { position: 'relative' },
});
