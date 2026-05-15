import React from 'react';
import { Pressable } from 'react-native';
import styled from 'styled-components/native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  label: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
};

const Row = styled(Pressable)<{ $disabled: boolean }>`
  height: 56px;
  padding-horizontal: ${({ theme }) => theme.spacing.md}px;
  background-color: ${({ theme }) => theme.colors.background};
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  opacity: ${({ $disabled }) => ($disabled ? 0.4 : 1)};
`;

const LabelText = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.label.fontSize}px;
  line-height: ${({ theme }) => theme.typography.label.lineHeight}px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const RightArea = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs}px;
`;

const ValueText = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.body.fontSize}px;
  line-height: ${({ theme }) => theme.typography.body.lineHeight}px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

export function ProfileRow({ label, value, onPress, disabled = false }: Props): React.JSX.Element {
  return (
    <Row
      $disabled={disabled}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => (!disabled && pressed ? { opacity: 0.7 } : null)}
    >
      <LabelText allowFontScaling={false}>{label}</LabelText>
      <RightArea>
        <ValueText allowFontScaling={false}>{value}</ValueText>
        {!disabled && <Ionicons name="chevron-forward" size={16} color="#C8C4A8" />}
      </RightArea>
    </Row>
  );
}
