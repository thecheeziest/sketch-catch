import React from 'react';
import { Modal, Pressable } from 'react-native';
import styled from 'styled-components/native';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

const Overlay = styled(Pressable)`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.5);
  justify-content: flex-end;
`;

const Container = styled.View`
  background-color: ${({ theme }) => theme.colors.surface};
  border-width: 2px;
  border-color: ${({ theme }) => theme.colors.textPrimary};
  padding: ${({ theme }) => theme.spacing.lg}px;
  gap: ${({ theme }) => theme.spacing.md}px;
`;

const Title = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.heading.fontSize}px;
  line-height: ${({ theme }) => theme.typography.heading.lineHeight}px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

export function PixelModal({ visible, onClose, title, children }: Props): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Overlay onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Container>
            <Title allowFontScaling={false}>{title}</Title>
            {children}
          </Container>
        </Pressable>
      </Overlay>
    </Modal>
  );
}
