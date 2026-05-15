import React from 'react';
import { View } from 'react-native';
import styled from 'styled-components/native';
import { PixelModal } from '@/components/PixelModal';
import { PixelButton } from '@/components/PixelButton';
import { useDeleteMe } from '@/features/auth/useDeleteMe';
import { Pressable } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const BodyText = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.body.fontSize}px;
  line-height: ${({ theme }) => theme.typography.body.lineHeight}px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

// 탈퇴하기 버튼 — destructive 스타일 직접 구현 (PixelButton이 destructive variant 미지원)
const DestructiveButton = styled(Pressable)`
  height: 48px;
  background-color: ${({ theme }) => theme.colors.destructive};
  border-width: 2px;
  border-color: ${({ theme }) => theme.colors.textPrimary};
  align-items: center;
  justify-content: center;
  flex: 1;
`;

const DestructiveLabel = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.label.fontSize}px;
  line-height: ${({ theme }) => theme.typography.label.lineHeight}px;
  color: ${({ theme }) => theme.colors.background};
`;

export function DeleteAccountModal({ visible, onClose }: Props): React.JSX.Element {
  const deleteMe = useDeleteMe();

  const handleDelete = (): void => {
    deleteMe.mutate(undefined, {
      onSuccess: () => {
        onClose();
        // clearAuth가 isAuthenticated=false로 만들어 AuthGate가 자동으로 (auth)/login으로 라우팅
      },
    });
  };

  return (
    <PixelModal visible={visible} onClose={onClose} title="정말 탈퇴하시겠어요?">
      <BodyText allowFontScaling={false}>
        탈퇴하면 모든 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없어요.
      </BodyText>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <PixelButton
            label="계속 이용하기"
            variant="secondary"
            onPress={onClose}
            disabled={deleteMe.isPending}
          />
        </View>
        <DestructiveButton
          onPress={handleDelete}
          disabled={deleteMe.isPending}
          style={({ pressed }) => [
            pressed ? { opacity: 0.7 } : null,
            deleteMe.isPending ? { opacity: 0.6 } : null,
          ]}
        >
          <DestructiveLabel allowFontScaling={false}>탈퇴하기</DestructiveLabel>
        </DestructiveButton>
      </View>
    </PixelModal>
  );
}
