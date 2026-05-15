import React from 'react';
import { Pressable } from 'react-native';
import styled from 'styled-components/native';

type Provider = 'kakao' | 'apple';
type Props = {
  provider: Provider;
  onPress: () => void;
  disabled?: boolean;
};

const BG: Record<Provider, string> = { kakao: '#FEE500', apple: '#000000' };
const FG: Record<Provider, string> = { kakao: '#191919', apple: '#FFFFFF' };
const LABEL: Record<Provider, string> = {
  kakao: '카카오로 시작하기',
  apple: 'Apple로 시작하기',
};

const Container = styled(Pressable)<{ $provider: Provider; $disabled: boolean }>`
  height: 48px;
  border-width: 2px;
  border-color: #2c2c1e;
  background-color: ${({ $provider }) => BG[$provider]};
  padding-left: ${({ theme }) => theme.spacing.lg}px;
  padding-right: ${({ theme }) => theme.spacing.lg}px;
  flex-direction: row;
  align-items: center;
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
`;

// SVG 에셋 미존재 시 단색 블록 placeholder — 실 SVG 추가 시 교체
const Logo = styled.View<{ $provider: Provider }>`
  width: 20px;
  height: 20px;
  background-color: ${({ $provider }) => FG[$provider]};
  margin-right: ${({ theme }) => theme.spacing.sm}px;
  opacity: 0.85;
`;

const Label = styled.Text<{ $provider: Provider }>`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.label.fontSize}px;
  color: ${({ $provider }) => FG[$provider]};
`;

export function SocialButton({ provider, onPress, disabled }: Props): React.JSX.Element {
  return (
    <Container
      $provider={provider}
      $disabled={!!disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
    >
      <Logo $provider={provider} />
      <Label $provider={provider} allowFontScaling={false}>
        {LABEL[provider]}
      </Label>
    </Container>
  );
}
