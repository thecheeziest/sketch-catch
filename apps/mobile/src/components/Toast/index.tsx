import React from 'react';
import styled from 'styled-components/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/stores/toast';

const Host = styled.View<{ $bottom: number }>`
  position: absolute;
  bottom: ${({ $bottom, theme }) => $bottom + theme.spacing.lg}px;
  left: 0;
  right: 0;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

const Bubble = styled.View`
  background-color: #2c2c1e;
  padding-vertical: ${({ theme }) => theme.spacing.sm}px;
  padding-horizontal: ${({ theme }) => theme.spacing.md}px;
`;

const Message = styled.Text`
  color: #fafaf0;
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.body.fontSize}px;
  line-height: ${({ theme }) => theme.typography.body.lineHeight}px;
`;

export function ToastHost(): React.JSX.Element {
  const toasts = useToastStore((s) => s.toasts);
  const insets = useSafeAreaInsets();
  return (
    <Host $bottom={insets.bottom} pointerEvents="none">
      {toasts.map((t) => (
        <Bubble key={t.id}>
          <Message allowFontScaling={false}>{t.message}</Message>
        </Bubble>
      ))}
    </Host>
  );
}
